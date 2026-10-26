import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import {
  CustomerCreatedPayload,
  CustomerDeletedPayload,
  DealDeletedPayload,
  DealStage,
  ERROR_CODES,
  EVENT_TYPES,
  PaginatedResponse,
  PERMISSIONS,
  paginate,
} from '@app/common-dto';
import { Customer } from '../entities/customer.entity';
import { Deal } from '../entities/deal.entity';
import { OutboxService } from '../outbox/outbox.service';
// 26/10/2026: pham vi xem 3 cap (Org Admin/Manager theo phong ban/Employee) - xem resolveScopeUserIds().
import { ScopeCaller, resolveScopeUserIds } from '../user-directory/user-directory';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';

const PRODUCER = 'crm-service';

/** Khach hang kem thong tin tong hop cho danh sach (Wireframe.md muc 12). */
export interface CustomerListItem extends Customer {
  /** So deal DANG hoat dong (chua WON/LOST) cua khach hang. */
  openDealCount: number;
  /** Tong gia tri cac deal dang hoat dong. */
  openDealValue: number;
}

interface CustomerStats {
  openDealCount: number;
  openDealValue: number;
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Deal) private readonly dealRepo: Repository<Deal>,
    private readonly outboxService: OutboxService,
  ) {}

  /**
   * Danh sach khach hang (Wireframe.md muc 12): ho tro tim kiem theo ten (khong phan biet hoa/
   * thuong), tra ve kem openDealCount/openDealValue tinh gop theo trang hien tai (1 truy van
   * aggregate GROUP BY customer_id, tranh N+1 - mirror ProjectsService.computeProjectStats()).
   *
   * 17/09/2026: gioi han pham vi xem theo ownerUserId - Employee (co CUSTOMER_VIEW nhung KHONG co
   * CUSTOMER_CREATE, xem DEFAULT_ROLE_PERMISSIONS trong permission.enum.ts) chi thay khach hang
   * minh phu trach; Manager/Org Admin (co ca 2 quyen) van thay toan bo khach hang trong to chuc nhu
   * truoc gio. Dung CUSTOMER_CREATE lam tin hieu ranh gioi "quan ly danh muc khach hang" (Manager)
   * vs "chi thao tac Deal cua minh tren khach hang co san" (Employee) da co san trong RBAC, tranh
   * phai them 1 permission constant rieng chi de phuc vu 1 dieu kien nay.
   *
   * 26/10/2026: Manager KHONG con thay toan bo khach hang nhu Org Admin - chi khach hang do chinh
   * minh HOAC thanh vien phong ban minh phu trach (ownerUserId thuoc phong ban, tra tu read-model
   * dim_user). Org Admin (USER_MANAGE) van thay tat ca; Employee giu nguyen "chi khach cua minh".
   */
  async findAll(
    organizationId: string,
    query: CustomerQueryDto,
    callerId: string,
    callerPermissions: string[],
    departmentId: string | null = null,
  ): Promise<PaginatedResponse<CustomerListItem>> {
    const where = await this.scopedWhere(organizationId, { userId: callerId, permissions: callerPermissions, departmentId });
    if (query.search) where.name = ILike(`%${query.search}%`);

    const [data, total] = await this.customerRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    const stats = await this.computeCustomerStats(data.map((customer) => customer.id));
    const enriched: CustomerListItem[] = data.map((customer) => {
      const stat = stats.get(customer.id) ?? { openDealCount: 0, openDealValue: 0 };
      return { ...customer, ...stat };
    });

    return paginate(enriched, total, query.page, query.limit);
  }

  // 17/09/2026: ap dung CUNG quy tac pham vi xem nhu findAll() o tren - neu khong, Employee van co
  // the xem chi tiet 1 khach hang khong phai minh phu trach chi bang cach doan/nhan duoc UUID cua
  // no truc tiep (vd. tu URL chia se), du danh sach da loc dung. Tra ve CUNG 1 NotFoundException
  // nhu truong hop khach hang khong ton tai (khong dung ForbiddenException rieng) de khong lam lo
  // su ton tai cua ban ghi cho nguoi khong co quyen xem no.
  // 26/10/2026: cung pham vi 3 cap voi findAll() (xem scopedWhere()).
  async findById(
    organizationId: string,
    id: string,
    callerId: string,
    callerPermissions: string[],
    departmentId: string | null = null,
  ): Promise<CustomerListItem> {
    const customer = await this.findScopedOrFail(organizationId, id, { userId: callerId, permissions: callerPermissions, departmentId });

    const stats = await this.computeCustomerStats([id]);
    const stat = stats.get(id) ?? { openDealCount: 0, openDealValue: 0 };
    return { ...customer, ...stat };
  }

  async create(organizationId: string, actorId: string, dto: CreateCustomerDto): Promise<Customer> {
    return this.dataSource.transaction(async (manager) => {
      const customer = await manager.save(
        manager.create(Customer, {
          organizationId,
          name: dto.name,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          company: dto.company ?? null,
          notes: dto.notes ?? null,
          ownerUserId: actorId,
        }),
      );

      const payload: CustomerCreatedPayload = { customerId: customer.id, name: customer.name, actorId };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.CUSTOMER_CREATED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      return customer;
    });
  }

  // 26/10/2026: `caller` (tuy chon) - Manager chi sua duoc khach hang nam trong pham vi phong ban
  // (truoc day sua duoc BAT KY khach hang nao cua to chuc neu biet UUID).
  async update(organizationId: string, id: string, dto: UpdateCustomerDto, caller?: ScopeCaller): Promise<Customer> {
    const customer = await this.findScopedOrFail(organizationId, id, caller);

    if (dto.name !== undefined) customer.name = dto.name;
    if (dto.email !== undefined) customer.email = dto.email;
    if (dto.phone !== undefined) customer.phone = dto.phone;
    if (dto.company !== undefined) customer.company = dto.company;
    if (dto.notes !== undefined) customer.notes = dto.notes;
    // 17/09/2026: cho phep doi nguoi phu trach (ownerUserId) - chi nguoi co CUSTOMER_UPDATE (Manager/
    // Org Admin, xem DEFAULT_ROLE_PERMISSIONS) moi goi duoc PATCH nay (da gate san boi
    // @RequirePermissions tren CustomersController.update()) nen khong can kiem tra quyen rieng cho
    // truong nay. Xem chu thich tai UpdateCustomerDto.ownerUserId ve gioi han KHONG validate
    // ownerUserId thuc su thuoc organizationId cua nguoi goi (mirror Project.leadUserId).
    if (dto.ownerUserId !== undefined) customer.ownerUserId = dto.ownerUserId;
    return this.customerRepo.save(customer);
  }

  /**
   * Xoa khach hang cascade xoa toan bo Deal cua ho (FK onDelete: CASCADE, xem deal.entity.ts).
   * Khoa pessimistic_write + xoa idempotent + phat du event cho ca Customer lan tung Deal bi
   * cascade - mirror CHINH XAC ProjectsService.remove() (apps/project-task-service).
   */
  // 26/10/2026: `caller` (tuy chon) - cung pham vi voi update() o tren.
  async remove(organizationId: string, actorId: string, id: string, caller?: ScopeCaller): Promise<void> {
    await this.findScopedOrFail(organizationId, id, caller);

    await this.dataSource.transaction(async (manager) => {
      const customer = await manager.findOne(Customer, {
        where: { id, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!customer) return;

      const orphanedDealIds = (
        await manager.find(Deal, { where: { customerId: id }, select: ['id'] })
      ).map((deal) => deal.id);

      // Cascade xoa toan bo Deal cua khach hang nay qua FK onDelete: CASCADE.
      await manager.remove(customer);

      const payload: CustomerDeletedPayload = { customerId: customer.id, actorId };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.CUSTOMER_DELETED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      for (const dealId of orphanedDealIds) {
        const dealPayload: DealDeletedPayload = { dealId, customerId: id, actorId };
        await this.outboxService.record(manager, {
          eventType: EVENT_TYPES.DEAL_DELETED,
          organizationId,
          producer: PRODUCER,
          payload: dealPayload as unknown as Record<string, unknown>,
        });
      }
    });
  }

  /**
   * 26/10/2026: dieu kien WHERE theo pham vi xem cua nguoi goi - khong co caller (goi noi bo/test cu)
   * hoac Org Admin -> chi loc theo to chuc; nguoc lai ownerUserId phai thuoc tap nguoi dai dien
   * (chinh minh, hoac chinh minh + thanh vien phong ban voi Manager).
   */
  async scopedWhere(organizationId: string, caller?: ScopeCaller): Promise<FindOptionsWhere<Customer>> {
    if (!caller) return { organizationId };
    const ownerIds = await resolveScopeUserIds(
      this.dataSource,
      organizationId,
      caller.userId,
      caller.permissions ?? [],
      PERMISSIONS.CUSTOMER_CREATE,
      caller.departmentId,
    );
    return ownerIds ? { organizationId, ownerUserId: In(ownerIds) } : { organizationId };
  }

  /** 26/10/2026: NotFoundException CUNG errorCode voi "khong ton tai" de khong lo su ton tai cua ban ghi ngoai pham vi. */
  private async findScopedOrFail(organizationId: string, id: string, caller?: ScopeCaller): Promise<Customer> {
    const where = await this.scopedWhere(organizationId, caller);
    const customer = await this.customerRepo.findOne({ where: { ...where, id } });
    if (!customer) throw new NotFoundException({ message: 'Khong tim thay khach hang', errorCode: ERROR_CODES.CUSTOMER_NOT_FOUND });
    return customer;
  }

  /** Tinh openDealCount/openDealValue cho 1 tap customerId (trang hien tai) bang 1 query GROUP BY, tranh N+1. */
  private async computeCustomerStats(customerIds: string[]): Promise<Map<string, CustomerStats>> {
    const stats = new Map<string, CustomerStats>();
    if (customerIds.length === 0) return stats;
    for (const id of customerIds) stats.set(id, { openDealCount: 0, openDealValue: 0 });

    const rows = await this.dealRepo
      .createQueryBuilder('deal')
      .select('deal.customerId', 'customerId')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(deal.value), 0)', 'sum')
      .where('deal.customerId IN (:...customerIds)', { customerIds })
      .andWhere('deal.stage NOT IN (:...closedStages)', {
        closedStages: [DealStage.WON, DealStage.LOST],
      })
      .groupBy('deal.customerId')
      .getRawMany<{ customerId: string; count: string; sum: string }>();

    for (const row of rows) {
      stats.set(row.customerId, {
        openDealCount: parseInt(row.count, 10),
        openDealValue: parseFloat(row.sum),
      });
    }
    return stats;
  }
}
