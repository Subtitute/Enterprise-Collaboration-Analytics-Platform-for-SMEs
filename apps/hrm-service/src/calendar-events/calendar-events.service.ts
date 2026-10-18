import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { CalendarEventCreatedPayload, CalendarEventDeletedPayload, CalendarEventType, ERROR_CODES, EVENT_TYPES, PERMISSIONS } from '@app/common-dto';
import { toGmt7DateString } from '../attendance/attendance-date.util';
import { CalendarEvent } from '../entities/calendar-event.entity';
import { OutboxService } from '../outbox/outbox.service';
import { computeCallerCalendarRank } from './calendar-event-rank.util';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { CalendarEventQueryDto } from './dto/calendar-event-query.dto';

const PRODUCER = 'hrm-service';

/**
 * Lich cong ty (HRM-lite mo rong) - ngay le (HOLIDAY) + su kien/dat lich (EVENT).
 *
 * 03/10/2026: mo rong phan quyen (truoc day ca CRUD deu doi hoi CALENDAR_MANAGE, chi Org Admin xem/
 * sua duoc). Quy tac moi:
 * - Xem (findAll): moi thanh vien to chuc da dang nhap.
 * - Tao EVENT: moi thanh vien. Tao HOLIDAY: doi hoi CALENDAR_MANAGE (Org Admin/Manager) - kiem tra
 *   trong create() vi phu thuoc dto.type (body), khong the gan @RequirePermissions tinh o controller.
 * - Sua/xoa: chu cua muc lich (createdByUserId) LUON duoc, HOAC nguoi giu CALENDAR_MANAGE co
 *   "tham quyen" (computeCallerCalendarRank - xem calendar-event-rank.util.ts) CAO HON tham quyen
 *   DA CHOT luc tao (CalendarEvent.createdByRank) cua muc lich do. RIENG voi HOLIDAY (dang hien tai
 *   hoac dang doi SANG qua PATCH): bat buoc phai giu CALENDAR_MANAGE, BAT KE chu so huu/tham quyen -
 *   day la "san choi rieng" cua nhom quan ly lich (Org Admin+Manager), khong ap dung so sanh tham
 *   quyen tung nguoi (vd 1 Manager van sua/xoa duoc HOLIDAY do Org Admin tao, mien la giu
 *   CALENDAR_MANAGE - khac voi EVENT, noi tham quyen THAP HON khong dung duoc vao muc do nguoi
 *   tham quyen CAO HON tao).
 */
@Injectable()
export class CalendarEventsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(CalendarEvent) private readonly calendarEventRepo: Repository<CalendarEvent>,
    private readonly outboxService: OutboxService,
  ) {}

  private assertValidRange(startDate: string, endDate: string): void {
    if (new Date(startDate) > new Date(endDate)) {
      throw new BadRequestException({
        message: 'Ngày bắt đầu không được sau ngày kết thúc',
        errorCode: ERROR_CODES.CALENDAR_EVENT_DATE_RANGE_INVALID,
      });
    }
  }

  // 05/10/2026: phat hien qua bao loi thuc te (nguoi dung) - CompanyCalendar.tsx (chuyen vao
  // LeaveRequestsPage.tsx dot "Major update" 03/10/2026) cho tao/doi mot muc lich (EVENT lan
  // HOLIDAY) voi ngay bat dau o QUA KHU, CUNG mot loi logic da tung sua cho don nghi phep
  // (LeaveRequestsService.create(), 15/09/2026) nhung o day CHUA tung co kiem tra nao ca. So sanh
  // dang chuoi 'YYYY-MM-DD' neo theo GMT+7 (mirror dung leave-requests.service.ts), khong parse ve
  // Date object de tranh moi rui ro lech gio/timezone.
  private assertStartDateNotInPast(startDate: string): void {
    const todayGmt7 = toGmt7DateString(new Date());
    if (startDate.slice(0, 10) < todayGmt7) {
      throw new BadRequestException({
        message: 'Ngày bắt đầu không được ở trong quá khứ',
        errorCode: ERROR_CODES.CALENDAR_EVENT_START_DATE_IN_PAST,
      });
    }
  }

  /**
   * Quyet dinh co duoc SUA/XOA 1 muc lich hay khong - dung chung cho update()/delete(). `nextType`
   * la type SAU KHI doi (neu PATCH co doi type), de trong (delete, hoac PATCH khong doi type) =
   * giu nguyen existing.type.
   */
  private assertCanModify(
    existing: CalendarEvent,
    callerUserId: string,
    permissions: string[],
    nextType?: CalendarEventType,
  ): void {
    const hasCalendarManage = permissions.includes(PERMISSIONS.CALENDAR_MANAGE);
    const targetType = nextType ?? existing.type;
    const touchesHoliday = existing.type === CalendarEventType.HOLIDAY || targetType === CalendarEventType.HOLIDAY;

    // Dung toi mot HOLIDAY (dang la HOLIDAY, HOAC dang doi SANG/giu HOLIDAY qua PATCH) deu doi hoi
    // CALENDAR_MANAGE - "san choi rieng" cua Org Admin/Manager, BAT KE chu so huu/tham quyen.
    if (touchesHoliday && !hasCalendarManage) {
      throw new ForbiddenException({
        message: 'Bạn không đủ quyền thao tác với ngày nghỉ lễ công ty',
        errorCode: ERROR_CODES.CALENDAR_EVENT_FORBIDDEN_HOLIDAY,
      });
    }

    // Da la HOLIDAY tu truoc: vua xac nhan CALENDAR_MANAGE o tren la DU, khong so sanh tham quyen
    // tung nguoi nua (ke ca dang "ha cap" ve EVENT qua PATCH - van la thao tac tren 1 HOLIDAY).
    if (existing.type === CalendarEventType.HOLIDAY) return;

    // Tu day tro di existing CHAC CHAN la EVENT. QUAN TRONG: van phai ap dung dung quy tac EVENT
    // (chu so huu HOAC tham quyen cao hon) ngay ca khi dang doi SANG HOLIDAY qua PATCH - da xac
    // nhan CALENDAR_MANAGE cho viec "tao HOLIDAY" o nhanh tren roi, nhung do KHONG dong nghia voi
    // "duoc phep sua 1 EVENT cua nguoi khac". Sua loi leo thang quyen phat hien qua rieng soat
    // 03/10/2026: ban cu dung 1 dieu kien OR gop ca 2 truong hop (existing HOAC next la HOLIDAY)
    // roi return ngay khi co CALENDAR_MANAGE, khien 1 Manager co the "lach" qua check tham quyen
    // bang cach gui kem `type: HOLIDAY` trong PATCH 1 EVENT do Org Admin tao - sua toan bo cac
    // truong khac (title, ngay...) cua ban ghi do ma khong can la chu so huu/tham quyen cao hon.
    if (existing.createdByUserId === callerUserId) return;

    if (!hasCalendarManage) {
      throw new ForbiddenException({
        message: 'Bạn không đủ quyền sửa/xóa mục lịch này',
        errorCode: ERROR_CODES.CALENDAR_EVENT_FORBIDDEN_NOT_OWNER,
      });
    }
    const callerRank = computeCallerCalendarRank(permissions);
    if (callerRank <= existing.createdByRank) {
      throw new ForbiddenException({
        message: 'Không thể sửa/xóa mục lịch do người có thẩm quyền cao hơn tạo',
        errorCode: ERROR_CODES.CALENDAR_EVENT_FORBIDDEN_LOWER_RANK,
      });
    }
  }

  async create(organizationId: string, userId: string, permissions: string[], dto: CreateCalendarEventDto): Promise<CalendarEvent> {
    // 03/10/2026: tao HOLIDAY doi hoi CALENDAR_MANAGE - kiem tra o day (khong phai decorator tinh
    // tren controller) vi phu thuoc dto.type (body cua request).
    if (dto.type === CalendarEventType.HOLIDAY && !permissions.includes(PERMISSIONS.CALENDAR_MANAGE)) {
      throw new ForbiddenException({
        message: 'Bạn không đủ quyền tạo ngày nghỉ lễ công ty',
        errorCode: ERROR_CODES.CALENDAR_EVENT_FORBIDDEN_HOLIDAY,
      });
    }

    // 15/09/2026: endDate tuy chon o DTO - mac dinh = startDate (muc lich 1 ngay, truong hop pho
    // bien nhat: 1 ngay le don le hoac 1 su kien trong ngay).
    const endDate = dto.endDate ?? dto.startDate;
    this.assertValidRange(dto.startDate, endDate);
    this.assertStartDateNotInPast(dto.startDate);
    const createdByRank = computeCallerCalendarRank(permissions);

    return this.dataSource.transaction(async (manager) => {
      const calendarEvent = await manager.save(
        manager.create(CalendarEvent, {
          organizationId,
          title: dto.title,
          description: dto.description ?? null,
          type: dto.type,
          startDate: dto.startDate,
          endDate,
          createdByUserId: userId,
          createdByRank,
        }),
      );

      const payload: CalendarEventCreatedPayload = {
        calendarEventId: calendarEvent.id,
        title: calendarEvent.title,
        type: calendarEvent.type,
        startDate: calendarEvent.startDate,
        endDate: calendarEvent.endDate,
        actorId: userId,
      };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.CALENDAR_EVENT_CREATED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      return calendarEvent;
    });
  }

  /**
   * Loc theo khoang thoi gian dang xem (vd 1 thang tren luoi lich) - tra ve moi muc lich CHONG LAN
   * voi khoang [startDate, endDate] da cho (khong chi cac muc BAT DAU trong khoang do, vi 1 muc
   * lich nhieu ngay - vd Tet - co the bat dau TRUOC khoang dang xem nhung van con "dang dien ra"
   * trong khoang do). De trong ca 2 tham so = tra ve toan bo (xem chu thich tai CalendarEventQueryDto).
   *
   * 03/10/2026: tra ve nguyen entity (gom ca createdByUserId LAN createdByRank moi them) - frontend
   * tu tinh duoc co duoc hien nut sua/xoa hay khong (so sanh voi user/permissions dang dang nhap)
   * ma khong can goi API rieng de kiem tra quyen tung muc lich.
   */
  async findAll(organizationId: string, query: CalendarEventQueryDto): Promise<CalendarEvent[]> {
    const where: Record<string, unknown> = { organizationId };
    if (query.startDate) where.endDate = MoreThanOrEqual(query.startDate);
    if (query.endDate) where.startDate = LessThanOrEqual(query.endDate);

    return this.calendarEventRepo.find({ where, order: { startDate: 'ASC' } });
  }

  /**
   * 17/09/2026: tra ve muc lich HOLIDAY dang "hieu luc" tai 1 ngay cu the (startDate <= dateStr <=
   * endDate), hoac null neu khong co - dung boi AttendanceService.checkIn() de chan cham cong vao
   * ngay nghi le cong ty (Org Admin khai bao qua Lich cong ty, xem chu thich tai attendance.service.ts).
   */
  async findHolidayForDate(organizationId: string, dateStr: string): Promise<CalendarEvent | null> {
    return this.calendarEventRepo.findOne({
      where: {
        organizationId,
        type: CalendarEventType.HOLIDAY,
        startDate: LessThanOrEqual(dateStr),
        endDate: MoreThanOrEqual(dateStr),
      },
    });
  }

  async update(
    organizationId: string,
    userId: string,
    permissions: string[],
    id: string,
    dto: UpdateCalendarEventDto,
  ): Promise<CalendarEvent> {
    const existing = await this.calendarEventRepo.findOne({ where: { id, organizationId } });
    if (!existing) {
      throw new NotFoundException({ message: 'Không tìm thấy mục lịch', errorCode: ERROR_CODES.CALENDAR_EVENT_NOT_FOUND });
    }
    this.assertCanModify(existing, userId, permissions, dto.type);

    const nextStartDate = dto.startDate ?? existing.startDate;
    const nextEndDate = dto.endDate ?? existing.endDate;
    this.assertValidRange(nextStartDate, nextEndDate);
    // Chi chan khi ngay bat dau THAT SU doi sang 1 gia tri khac (vd doi lich sang qua khu) - khong
    // chan viec sua cac truong khac (tieu de, mo ta...) cua 1 muc lich co san ma ngay bat dau da
    // troi qua tu truoc (startDate khong doi), tranh khoa nguoi dung khoi sua loi chinh ta tren 1
    // muc lich qua khu hop le.
    if (nextStartDate !== existing.startDate) {
      this.assertStartDateNotInPast(nextStartDate);
    }

    if (dto.title !== undefined) existing.title = dto.title;
    if (dto.description !== undefined) existing.description = dto.description;
    if (dto.type !== undefined) existing.type = dto.type;
    existing.startDate = nextStartDate;
    existing.endDate = nextEndDate;

    return this.calendarEventRepo.save(existing);
  }

  async delete(organizationId: string, userId: string, permissions: string[], id: string): Promise<void> {
    const existing = await this.calendarEventRepo.findOne({ where: { id, organizationId } });
    if (!existing) {
      throw new NotFoundException({ message: 'Không tìm thấy mục lịch', errorCode: ERROR_CODES.CALENDAR_EVENT_NOT_FOUND });
    }
    this.assertCanModify(existing, userId, permissions);

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(CalendarEvent, { id, organizationId });

      const payload: CalendarEventDeletedPayload = {
        calendarEventId: existing.id,
        title: existing.title,
        actorId: userId,
      };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.CALENDAR_EVENT_DELETED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });
    });
  }
}
