import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';
import {
  DealCreatedPayload,
  DealDeletedPayload,
  DealStage,
  DealStageChangedPayload,
  ERROR_CODES,
  EVENT_TYPES,
  PaginatedResponse,
  PERMISSIONS,
  paginate,
} from '@app/common-dto';
import { Customer } from '../entities/customer.entity';
import { Deal } from '../entities/deal.entity';
import { OutboxService } from '../outbox/outbox.service';
// 26/10/2026: pham vi xem 3 cap (Org Admin/Manager theo phong ban/Employee) - xem scopedWhere().
import { ScopeCaller, resolveScopeUserIds } from '../user-directory/user-directory';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { UpdateDealStageDto } from './dto/update-deal-stage.dto';
import { DealQueryDto } from './dto/deal-query.dto';
import { isValidDealStageTransition } from './deal-stage.util';

const PRODUCER = 'crm-service';

@Injectable()
export class DealsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Deal) private readonly dealRepo: Repository<Deal>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    private readonly outboxService: OutboxService,
  ) {}

  /**
   * 26/10/2026: truoc ngay nay MOI nguoi co DEAL_VIEW (ke ca Employee) doc duoc TOAN BO deal cua to
   * chuc (khong co loc nao) - lech han voi Customer (Employee chi thay khach cua minh). Nay ap pham vi
   * 3 cap: Org Admin thay tat ca; Manager thay deal do chinh minh/thanh vien phong ban phu trach HOAC
   * thuoc khach hang do ho phu trach; Employee chi deal cua minh hoac cua khach hang minh phu trach.
   * `caller` tuy chon (goi noi bo/test cu khong truyen = chi loc to chuc).
   */
  async findAll(organizationId: string, query: DealQueryDto, caller?: ScopeCaller): Promise<PaginatedResponse<Deal>> {
    const filter: FindOptionsWhere<Deal> = {};
    if (query.customerId) filter.customerId = query.customerId;
    if (query.stage) filter.stage = query.stage;
    const clauses = (await this.scopedWhere(organizationId, caller)).map((clause) => ({ ...clause, ...filter }));

    const [data, total] = await this.dealRepo.findAndCount({
      where: clauses.length === 1 ? clauses[0] : clauses,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
  }

  async findById(organizationId: string, id: string, caller?: ScopeCaller): Promise<Deal> {
    return this.findDealOrFail(organizationId, id, caller);
  }

  /**
   * Tao deal moi cho 1 khach hang. QUAN TRONG (mirror TasksService.create(), Technical_Spec.md
   * muc 6): phai xac minh dto.customerId thuoc dung organizationId cua nguoi goi truoc khi tao
   * Deal, neu khong 1 to chuc co the tao Deal gan vao Customer cua to chuc KHAC chi bang cach
   * doan UUID. Kiem tra nay chay BEN TRONG cung transaction voi viec tao Deal + ghi Outbox.
   *
   * 26/10/2026: `caller` (tuy chon) - khach hang phai nam trong pham vi xem khach hang cua nguoi goi
   * (cung quy tac CustomersService, quyen cap Manager CUSTOMER_CREATE): khong them deal vao khach
   * hang minh khong duoc xem.
   */
  async create(organizationId: string, actorId: string, dto: CreateDealDto, caller?: ScopeCaller): Promise<Deal> {
    const ownerIds = caller
      ? await resolveScopeUserIds(this.dataSource, organizationId, caller.userId, caller.permissions ?? [], PERMISSIONS.CUSTOMER_CREATE, caller.departmentId)
      : null;
    return this.dataSource.transaction(async (manager) => {
      const customer = await manager.findOne(Customer, {
        where: { id: dto.customerId, organizationId, ...(ownerIds ? { ownerUserId: In(ownerIds) } : {}) },
      });
      if (!customer) {
        throw new NotFoundException({
          message: 'Khong tim thay khach hang trong to chuc cua ban',
          errorCode: ERROR_CODES.CUSTOMER_NOT_FOUND_IN_ORG,
        });
      }

      const deal = await manager.save(
        manager.create(Deal, {
          organizationId,
          customerId: dto.customerId,
          title: dto.title,
          value: dto.value ?? 0,
          stage: DealStage.NEW,
          expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : null,
          ownerUserId: actorId,
        }),
      );

      const payload: DealCreatedPayload = {
        dealId: deal.id,
        customerId: deal.customerId,
        title: deal.title,
        actorId,
      };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.DEAL_CREATED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      return deal;
    });
  }

  // 26/10/2026: `caller` (tuy chon) - chi sua deal nam trong pham vi xem (truoc day sua duoc deal bat ky
  // cua to chuc neu biet UUID). Quyen DEAL_UPDATE giu nguyen.
  async update(organizationId: string, id: string, dto: UpdateDealDto, caller?: ScopeCaller): Promise<Deal> {
    const deal = await this.findDealOrFail(organizationId, id, caller);

    if (dto.title !== undefined) deal.title = dto.title;
    if (dto.value !== undefined) deal.value = dto.value;
    if (dto.expectedCloseDate !== undefined) {
      deal.expectedCloseDate = dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : null;
    }
    return this.dealRepo.save(deal);
  }

  /**
   * Endpoint keo-tha Kanban pipeline ban hang (Wireframe.md muc 12). Validate theo
   * DEAL_STAGE_TRANSITIONS roi phat EVENT_TYPES.DEAL_STAGE_CHANGED qua Outbox trong CUNG
   * transaction voi thay doi stage - mirror CHINH XAC TasksService.updateStatus()
   * (apps/project-task-service): pre-check fail-fast, roi doc LAI ben trong transaction voi
   * pessimistic write lock, re-validate mot lan nua truoc khi apply - tranh 2 request doi giai
   * doan dong thoi cung "vuot qua" pre-check dua tren snapshot cu.
   */
  async updateStage(
    organizationId: string,
    id: string,
    actorId: string,
    dto: UpdateDealStageDto,
    // 26/10/2026: xem update() o tren.
    caller?: ScopeCaller,
  ): Promise<Deal> {
    const existing = await this.findDealOrFail(organizationId, id, caller);
    const toStage = dto.stage;

    if (!isValidDealStageTransition(existing.stage, toStage)) {
      throw new BadRequestException({
        message: `Khong the chuyen giai doan deal tu ${existing.stage} sang ${toStage}`,
        errorCode: ERROR_CODES.DEAL_STAGE_TRANSITION_INVALID,
        errorParams: { from: existing.stage, to: toStage },
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const deal = await manager.findOneOrFail(Deal, {
        where: { id, organizationId },
        lock: { mode: 'pessimistic_write' },
      });

      // Re-validate dua tren giai doan vua duoc khoa (khong dung bien `existing` da co the stale).
      const fromStage = deal.stage;
      if (!isValidDealStageTransition(fromStage, toStage)) {
        throw new BadRequestException({
          message: `Khong the chuyen giai doan deal tu ${fromStage} sang ${toStage}`,
          errorCode: ERROR_CODES.DEAL_STAGE_TRANSITION_INVALID,
          errorParams: { from: fromStage, to: toStage },
        });
      }

      deal.stage = toStage;
      if (toStage === DealStage.WON || toStage === DealStage.LOST) {
        deal.closedAt = new Date();
      }
      const updated = await manager.save(deal);

      const payload: DealStageChangedPayload = {
        dealId: updated.id,
        customerId: updated.customerId,
        fromStage,
        toStage,
        actorId,
      };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.DEAL_STAGE_CHANGED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      return updated;
    });
  }

  /**
   * Xoa idempotent + pessimistic write lock - mirror CHINH XAC TasksService.remove()
   * (apps/project-task-service, tranh double-emit DEAL_DELETED khi 2 request xoa dong thoi).
   */
  // 26/10/2026: xem update() o tren - Manager chi xoa deal trong pham vi phong ban.
  async remove(organizationId: string, actorId: string, id: string, caller?: ScopeCaller): Promise<void> {
    await this.findDealOrFail(organizationId, id, caller);

    await this.dataSource.transaction(async (manager) => {
      const deal = await manager.findOne(Deal, {
        where: { id, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!deal) return;

      await manager.remove(deal);

      const payload: DealDeletedPayload = { dealId: deal.id, customerId: deal.customerId, actorId };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.DEAL_DELETED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });
    });
  }

  // 26/10/2026: them `caller` - ban ghi ngoai pham vi tra CUNG NotFoundException voi "khong ton tai".
  private async findDealOrFail(organizationId: string, id: string, caller?: ScopeCaller): Promise<Deal> {
    const clauses = (await this.scopedWhere(organizationId, caller)).map((clause) => ({ ...clause, id }));
    const deal = await this.dealRepo.findOne({ where: clauses.length === 1 ? clauses[0] : clauses });
    if (!deal) throw new NotFoundException({ message: 'Khong tim thay deal', errorCode: ERROR_CODES.DEAL_NOT_FOUND });
    return deal;
  }

  /**
   * 26/10/2026: cac menh de OR theo pham vi - nguoi phu trach deal HOAC nguoi phu trach khach hang
   * cua deal thuoc tap nguoi dai dien (resolveScopeUserIds(), quyen cap Manager DEAL_DELETE).
   */
  private async scopedWhere(organizationId: string, caller?: ScopeCaller): Promise<FindOptionsWhere<Deal>[]> {
    if (!caller) return [{ organizationId }];
    const ownerIds = await resolveScopeUserIds(
      this.dataSource,
      organizationId,
      caller.userId,
      caller.permissions ?? [],
      PERMISSIONS.DEAL_DELETE,
      caller.departmentId,
    );
    if (!ownerIds) return [{ organizationId }];
    return [
      { organizationId, ownerUserId: In(ownerIds) },
      { organizationId, customer: { ownerUserId: In(ownerIds) } },
    ];
  }
}
