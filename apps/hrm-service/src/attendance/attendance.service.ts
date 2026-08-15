import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import {
  AttendanceCheckedInPayload,
  AttendanceCheckedOutPayload,
  EVENT_TYPES,
  PERMISSIONS,
  PaginatedResponse,
  paginate,
} from '@app/common-dto';
import { Attendance } from '../entities/attendance.entity';
import { OutboxService } from '../outbox/outbox.service';
import { MinioService } from '../minio/minio.service';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { toGmt7DateString } from './attendance-date.util';
import { buildAttendancePhotoObjectKey } from './object-key.util';
import { verifyPhotoContentMatchesMimeType } from './allowed-photo-mime-types';
import { haversineDistanceMeters } from './geo-distance.util';

const PRODUCER = 'hrm-service';
/** Ma loi Postgres cho vi pham rang buoc unique (@Unique(['organizationId','userId','workDate'])). */
const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Attendance) private readonly attendanceRepo: Repository<Attendance>,
    private readonly outboxService: OutboxService,
    private readonly minioService: MinioService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Gan co "on-site"/"off-site" - CHI la 1 tin hieu THEM hien canh anh cham cong de Manager tu
   * doi chieu (Technical_Spec.md muc 17), KHONG dung de chan check-in/out. Ly do khong chan:
   * GPS trong nha co the lech vai chuc met, va vi tri tren Android co the gia mao qua ung dung
   * gia lap khi bat Tuy chon nha phat trien - chan cung dua tren tin hieu khong dang tin cay
   * nay se tao ra 2 loai sai: chan nham nhan vien that dang o van phong (GPS lech), va khong
   * chan duoc nguoi co chu dinh gia mao (biet cach bypass). Tra ve `null` (khac `false`) khi
   * thieu toa do van phong (chua cau hinh) hoac thieu toa do thiet bi (nguoi dung tu choi quyen) -
   * ca 2 truong hop nay co nghia "khong co du lieu de danh gia", khac han "da xac nhan la off-site".
   */
  private computeIsOnSite(latitude?: number, longitude?: number): boolean | null {
    if (latitude === undefined || longitude === undefined) return null;
    const officeLat = this.configService.get<number>('office.latitude');
    const officeLng = this.configService.get<number>('office.longitude');
    if (officeLat === undefined || officeLng === undefined) return null;
    const radiusMeters = this.configService.get<number>('office.geofenceRadiusMeters')!;
    return haversineDistanceMeters(latitude, longitude, officeLat, officeLng) <= radiusMeters;
  }

  /**
   * Photo-proof check-in - nguoi dung da dang nhap (danh tinh xac dinh qua JWT nhu moi endpoint
   * khac), camera CHI chup 1 anh lam bang chung dinh kem, KHONG nhan dien khuon mat (xem
   * Technical_Spec.md muc 17). 1 ban ghi/nguoi/ngay lam viec theo
   * lich GMT+7.
   */
  async checkIn(
    organizationId: string,
    userId: string,
    file: Express.Multer.File,
    latitude?: number,
    longitude?: number,
  ): Promise<Attendance> {
    verifyPhotoContentMatchesMimeType(file);
    const workDate = toGmt7DateString(new Date());

    const existing = await this.attendanceRepo.findOne({ where: { organizationId, userId, workDate } });
    if (existing) {
      throw new BadRequestException('Bạn đã chấm công vào làm hôm nay rồi');
    }

    const objectKey = buildAttendancePhotoObjectKey(organizationId, userId, workDate, 'checkin', file.mimetype);
    await this.minioService.putObject(objectKey, file.buffer, file.size, file.mimetype);
    const isOnSite = this.computeIsOnSite(latitude, longitude);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const attendance = await manager.save(
          manager.create(Attendance, {
            organizationId,
            userId,
            workDate,
            checkInAt: new Date(),
            checkInPhotoObjectKey: objectKey,
            checkInLatitude: latitude ?? null,
            checkInLongitude: longitude ?? null,
            checkInIsOnSite: isOnSite,
          }),
        );

        const payload: AttendanceCheckedInPayload = { attendanceId: attendance.id, userId, workDate };
        await this.outboxService.record(manager, {
          eventType: EVENT_TYPES.ATTENDANCE_CHECKED_IN,
          organizationId,
          producer: PRODUCER,
          payload: payload as unknown as Record<string, unknown>,
        });

        return attendance;
      });
    } catch (error) {
      // Xu ly race condition 2 request check-in dong thoi cung ngay - mirror
      // TasksService.assign() (apps/project-task-service): bat QueryFailedError ma Postgres code
      // 23505 (vi pham @Unique) va coi day la truong hop idempotent hop le - tra ve ban ghi da
      // duoc tao boi request thang cuoc, thay vi de loi 500 chung chung bubble len. Anh vua upload
      // cua request thua cuoc bi bo phi (chap nhan duoc - truong hop hiem, khong dang de them
      // logic don dep object MinIO mo coi cho 1 race condition rat hiem xay ra).
      const pgErrorCode =
        error instanceof QueryFailedError
          ? (error.driverError as { code?: string } | undefined)?.code
          : undefined;
      if (pgErrorCode === POSTGRES_UNIQUE_VIOLATION) {
        const race = await this.attendanceRepo.findOne({ where: { organizationId, userId, workDate } });
        if (race) return race;
      }
      throw error;
    }
  }

  async checkOut(
    organizationId: string,
    userId: string,
    file: Express.Multer.File,
    latitude?: number,
    longitude?: number,
  ): Promise<Attendance> {
    verifyPhotoContentMatchesMimeType(file);
    const workDate = toGmt7DateString(new Date());

    const attendance = await this.attendanceRepo.findOne({ where: { organizationId, userId, workDate } });
    if (!attendance) {
      throw new BadRequestException('Bạn chưa chấm công vào làm hôm nay, không thể chấm công ra về');
    }
    if (attendance.checkOutAt) {
      throw new BadRequestException('Bạn đã chấm công ra về hôm nay rồi');
    }

    const objectKey = buildAttendancePhotoObjectKey(organizationId, userId, workDate, 'checkout', file.mimetype);
    await this.minioService.putObject(objectKey, file.buffer, file.size, file.mimetype);
    const isOnSite = this.computeIsOnSite(latitude, longitude);

    return this.dataSource.transaction(async (manager) => {
      attendance.checkOutAt = new Date();
      attendance.checkOutPhotoObjectKey = objectKey;
      attendance.checkOutLatitude = latitude ?? null;
      attendance.checkOutLongitude = longitude ?? null;
      attendance.checkOutIsOnSite = isOnSite;
      const updated = await manager.save(attendance);

      const payload: AttendanceCheckedOutPayload = { attendanceId: updated.id, userId, workDate };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.ATTENDANCE_CHECKED_OUT,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      return updated;
    });
  }

  /** Lich su cham cong CUA CHINH NGUOI GOI - khong yeu cau permission dac biet, mirror Profile ("ai cung tu xem duoc chinh minh"). */
  async findMine(organizationId: string, userId: string, query: AttendanceQueryDto): Promise<PaginatedResponse<Attendance>> {
    const [data, total] = await this.attendanceRepo.findAndCount({
      where: { organizationId, userId },
      order: { workDate: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
  }

  /** Danh sach cham cong TOAN TO CHUC (Manager/Org Admin, PERMISSIONS.ATTENDANCE_VIEW) - loc duoc theo userId. */
  async findAll(organizationId: string, query: AttendanceQueryDto): Promise<PaginatedResponse<Attendance>> {
    const where: { organizationId: string; userId?: string } = { organizationId };
    if (query.userId) where.userId = query.userId;

    const [data, total] = await this.attendanceRepo.findAndCount({
      where,
      order: { workDate: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
  }

  /**
   * Presigned URL xem anh cham cong - chinh chu (userId trung voi ban ghi) hoac nguoi co
   * PERMISSIONS.ATTENDANCE_VIEW (Manager/Org Admin) moi xem duoc, mirror kiem tra quyen truy cap
   * cua FilesService.getDownloadUrl() (apps/document-service).
   */
  async getPhotoUrl(
    organizationId: string,
    id: string,
    kind: 'checkin' | 'checkout',
    requesterUserId: string,
    requesterPermissions: string[],
  ): Promise<{ url: string }> {
    const attendance = await this.attendanceRepo.findOne({ where: { id, organizationId } });
    if (!attendance) throw new NotFoundException('Không tìm thấy bản ghi chấm công');

    const isOwner = attendance.userId === requesterUserId;
    const canViewAll = requesterPermissions.includes(PERMISSIONS.ATTENDANCE_VIEW);
    if (!isOwner && !canViewAll) {
      throw new ForbiddenException('Bạn không có quyền xem ảnh chấm công này');
    }

    const objectKey = kind === 'checkin' ? attendance.checkInPhotoObjectKey : attendance.checkOutPhotoObjectKey;
    if (!objectKey) throw new NotFoundException('Chưa có ảnh cho thao tác này');

    const url = await this.minioService.presignedGetObject(objectKey);
    return { url };
  }
}
