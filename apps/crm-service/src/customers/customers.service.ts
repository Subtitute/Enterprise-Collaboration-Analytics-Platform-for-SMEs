import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, ILike, Repository } from 'typeorm';
import {
  CustomerCreatedPayload,
  CustomerDeletedPayload,
  DealDeletedPayload,
  DealStage,
  ERROR_CODES,
  EVENT_TYPES,
  PaginatedResponse,
  paginate,
} from '@app/common-dto';
import { Customer } from '../entities/customer.entity';
import { Deal } from '../entities/deal.entity';
import { OutboxService } from '../outbox/outbox.service';
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
   */
  async findAll(
    organizationId: string,
    query: CustomerQueryDto,
  ): Promise<PaginatedResponse<CustomerListItem>> {
    const where: FindOptionsWhere<Customer> = { organizationId };
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

  async findById(organizationId: string, id: string): Promise<CustomerListItem> {
    const customer = await this.customerRepo.findOne({ where: { id, organizationId } });
    if (!customer) throw new NotFoundException({ message: 'Khong tim thay khach hang', errorCode: ERROR_CODES.CUSTOMER_NOT_FOUND });

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

  async update(organizationId: string, id: string, dto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.customerRepo.findOne({ where: { id, organizationId } });
    if (!customer) throw new NotFoundException({ message: 'Khong tim thay khach hang', errorCode: ERROR_CODES.CUSTOMER_NOT_FOUND });

    if (dto.name !== undefined) customer.name = dto.name;
    if (dto.email !== undefined) customer.email = dto.email;
    if (dto.phone !== undefined) customer.phone = dto.phone;
    if (dto.company !== undefined) customer.company = dto.company;
    if (dto.notes !== undefined) customer.notes = dto.notes;
    return this.customerRepo.save(customer);
  }

  /**
   * Xoa khach hang cascade xoa toan bo Deal cua ho (FK onDelete: CASCADE, xem deal.entity.ts).
   * Khoa pessimistic_write + xoa idempotent + phat du event cho ca Customer lan tung Deal bi
   * cascade - mirror CHINH XAC ProjectsService.remove() (apps/project-task-service).
   */
  async remove(organizationId: string, actorId: string, id: string): Promise<void> {
    const existing = await this.customerRepo.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException({ message: 'Khong tim thay khach hang', errorCode: ERROR_CODES.CUSTOMER_NOT_FOUND });

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
