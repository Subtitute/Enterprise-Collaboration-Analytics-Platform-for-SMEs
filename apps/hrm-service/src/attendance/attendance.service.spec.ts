import { QueryFailedError } from 'typeorm';
import { ERROR_CODES, EVENT_TYPES } from '@app/common-dto';
import { AttendanceService } from './attendance.service';

/**
 * Unit test cho AttendanceService - tap trung vao 2 logic nhay cam concurrency/du lieu chua duoc
 * test o muc service (audit phat hien thieu): (1) checkIn() xu ly race condition 2 request cham
 * cong dong thoi cung ngay bang cach bat QueryFailedError ma Postgres 23505 (vi pham @Unique),
 * mirror TasksService.assign() (apps/project-task-service/src/tasks/tasks.service.spec.ts) - xem
 * test tuong tu tai do; (2) computeIsOnSite() - co "on-site"/"off-site" dua tren geofencing, dung
 * haversineDistanceMeters THAT (khong mock, vi la ham thuan tuy da co test rieng tai
 * geo-distance.util.spec.ts) de kiem tra ca luong tinh toan trong checkIn()/checkOut().
 *
 * Mock thu cong DataSource/Repository/ConfigService/MinioService/OutboxService, khong boot NestJS
 * module hay DB that (tuong tu apps/project-task-service/src/tasks/tasks.service.spec.ts).
 */
describe('AttendanceService', () => {
  const organizationId = 'org-1';
  const userId = 'user-1';

  /** File anh JPEG hop le (magic bytes FF D8 FF) de qua duoc verifyPhotoContentMatchesMimeType(). */
  function validJpegFile(): Express.Multer.File {
    return {
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]),
      mimetype: 'image/jpeg',
      size: 6,
      originalname: 'checkin.jpg',
      fieldname: 'file',
    } as Express.Multer.File;
  }

  function createConfigServiceMock(overrides: Record<string, unknown> = {}) {
    const values: Record<string, unknown> = {
      'office.latitude': 21.0285,
      'office.longitude': 105.8542,
      'office.geofenceRadiusMeters': 100,
      ...overrides,
    };
    return { get: jest.fn((key: string) => values[key]) };
  }

  function createService(opts: {
    attendanceRepoMock: { findOne: jest.Mock };
    managerMock?: { create: jest.Mock; save: jest.Mock };
    configServiceMock?: { get: jest.Mock };
    calendarEventsServiceMock?: { findHolidayForDate: jest.Mock };
  }) {
    // 22/08/2026: them findOne mac dinh cho managerMock (uy quyen lai attendanceRepoMock.findOne())
    // - can cho checkOut() sau khi sua rieng ra soat (doc lai voi khoa pessimistic_write BEN TRONG
    // transaction, xem attendance.service.ts). Test nao khong quan tam ket qua rieng cua manager
    // .findOne() (da hoc happy-path) chi can dung mac dinh nay, mockResolvedValue() cua
    // attendanceRepoMock.findOne tra ve CUNG 1 gia tri moi lan goi nen an toan de goi lai.
    const managerMock =
      opts.managerMock ??
      ({
        create: jest.fn((_entityClass: unknown, data: unknown) => data),
        save: jest.fn((entity: unknown) => Promise.resolve(entity)),
        findOne: jest.fn(() => opts.attendanceRepoMock.findOne()),
      } as { create: jest.Mock; save: jest.Mock; findOne: jest.Mock });
    const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
    const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };
    const minioServiceMock = {
      putObject: jest.fn().mockResolvedValue(undefined),
      presignedGetObject: jest.fn(),
    };
    const configServiceMock = opts.configServiceMock ?? createConfigServiceMock();
    // 17/09/2026: mac dinh khong co ngay nghi le nao (khong chan checkIn()) - giu nguyen hanh vi
    // cu cho moi test hien co chua quan tam toi tinh nang nay, mirror cach permissions mac dinh
    // duoc them vao cac test findAll/findById o project-task-service/crm-service truoc do.
    const calendarEventsServiceMock =
      opts.calendarEventsServiceMock ?? { findHolidayForDate: jest.fn().mockResolvedValue(null) };

    const service = new AttendanceService(
      dataSourceMock as any,
      opts.attendanceRepoMock as any,
      outboxServiceMock as any,
      minioServiceMock as any,
      configServiceMock as any,
      calendarEventsServiceMock as any,
    );

    return { service, dataSourceMock, managerMock, outboxServiceMock, minioServiceMock, configServiceMock, calendarEventsServiceMock };
  }

  describe('checkIn', () => {
    it('checkin thanh cong: tao ban ghi Attendance moi, upload anh len MinIO, ghi outbox event ATTENDANCE_CHECKED_IN', async () => {
      const attendanceRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const { service, outboxServiceMock, minioServiceMock } = createService({ attendanceRepoMock });

      const result = await service.checkIn(organizationId, userId, validJpegFile(), 21.0285, 105.8542);

      expect(result.organizationId).toBe(organizationId);
      expect(result.userId).toBe(userId);
      expect(result.checkInPhotoObjectKey).toContain('checkin');
      expect(minioServiceMock.putObject).toHaveBeenCalledTimes(1);
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ eventType: EVENT_TYPES.ATTENDANCE_CHECKED_IN }),
      );
    });

    it('tu choi ngay tu pre-check khi da co ban ghi cham cong hom nay - khong upload anh, khong mo transaction', async () => {
      const existing = { id: 'att-1', organizationId, userId, workDate: '2026-08-22' };
      const attendanceRepoMock = { findOne: jest.fn().mockResolvedValue(existing) };
      const { service, dataSourceMock, minioServiceMock } = createService({ attendanceRepoMock });

      await expect(service.checkIn(organizationId, userId, validJpegFile())).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.ALREADY_CHECKED_IN_TODAY }),
      });
      expect(minioServiceMock.putObject).not.toHaveBeenCalled();
      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
    });

    it('race condition: 2 request check-in dong thoi cung ngay - request thua cuoc nhan lai ban ghi cua request thang thay vi loi 500', async () => {
      // Pre-check khong thay ban ghi nao (chua co request nao insert xong tai thoi diem do), nhung
      // giua luc pre-check va luc INSERT that su, 1 request khac da insert xong truoc -> vi pham
      // @Unique(['organizationId','userId','workDate']) -> Postgres nem loi 23505.
      const raceRecord = { id: 'att-winner', organizationId, userId, workDate: '2026-08-22' };
      const uniqueViolation = new QueryFailedError(
        'INSERT INTO attendances ...',
        [],
        { name: 'error', message: 'duplicate key value violates unique constraint', code: '23505' } as any,
      );
      const attendanceRepoMock = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(null) // pre-check: chua co ban ghi -> tien hanh insert
          .mockResolvedValueOnce(raceRecord), // sau khi bat 23505: fetch lai, request thang cuoc da tao xong
      };
      const managerMock = {
        create: jest.fn((_entityClass: unknown, data: unknown) => data),
        save: jest.fn().mockRejectedValue(uniqueViolation),
      };
      const { service } = createService({ attendanceRepoMock, managerMock });

      const result = await service.checkIn(organizationId, userId, validJpegFile());

      expect(result).toBe(raceRecord);
      expect(attendanceRepoMock.findOne).toHaveBeenCalledTimes(2);
    });

    it('van nem lai loi neu la loi DB khac, khong phai vi pham unique constraint 23505', async () => {
      const otherError = new Error('connection lost');
      const attendanceRepoMock = { findOne: jest.fn().mockResolvedValueOnce(null) };
      const managerMock = {
        create: jest.fn((_entityClass: unknown, data: unknown) => data),
        save: jest.fn().mockRejectedValue(otherError),
      };
      const { service } = createService({ attendanceRepoMock, managerMock });

      await expect(service.checkIn(organizationId, userId, validJpegFile())).rejects.toThrow('connection lost');
      // Khong fetch lai ban ghi khi khong phai truong hop 23505.
      expect(attendanceRepoMock.findOne).toHaveBeenCalledTimes(1);
    });

    // 17/09/2026: chan cham cong vao ngay nghi le cong ty.
    it('tu choi khi hom nay la ngay nghi le cong ty - khong upload anh, khong tra cuu/mo transaction', async () => {
      const attendanceRepoMock = { findOne: jest.fn() };
      const calendarEventsServiceMock = {
        findHolidayForDate: jest.fn().mockResolvedValue({ id: 'cal-1', title: 'Tet Nguyen Dan' }),
      };
      const { service, dataSourceMock, minioServiceMock } = createService({
        attendanceRepoMock,
        calendarEventsServiceMock,
      });

      await expect(service.checkIn(organizationId, userId, validJpegFile())).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.ATTENDANCE_BLOCKED_HOLIDAY }),
      });
      expect(attendanceRepoMock.findOne).not.toHaveBeenCalled();
      expect(minioServiceMock.putObject).not.toHaveBeenCalled();
      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
    });

    it('cho phep checkin binh thuong khi hom nay khong phai ngay nghi le', async () => {
      const attendanceRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const calendarEventsServiceMock = { findHolidayForDate: jest.fn().mockResolvedValue(null) };
      const { service } = createService({ attendanceRepoMock, calendarEventsServiceMock });

      const result = await service.checkIn(organizationId, userId, validJpegFile());

      expect(result.organizationId).toBe(organizationId);
    });
  });

  describe('computeIsOnSite qua checkIn()/checkOut() - co "on-site"/"off-site" CHI la tin hieu them, KHONG chan cham cong', () => {
    it('gan true khi toa do thiet bi nam trong ban kinh geofence cua van phong', async () => {
      const attendanceRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const { service } = createService({ attendanceRepoMock });

      const result = await service.checkIn(organizationId, userId, validJpegFile(), 21.0285, 105.8542);

      expect(result.checkInIsOnSite).toBe(true);
    });

    it('gan false khi toa do thiet bi nam ngoai ban kinh geofence (vd o nha, cach van phong ~1140km)', async () => {
      const attendanceRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const { service } = createService({ attendanceRepoMock });

      const result = await service.checkIn(organizationId, userId, validJpegFile(), 10.7769, 106.7009);

      expect(result.checkInIsOnSite).toBe(false);
    });

    it('gan null (KHAC voi false) khi thieu toa do thiet bi - nguoi dung tu choi quyen vi tri, khong chan check-in', async () => {
      const attendanceRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const { service } = createService({ attendanceRepoMock });

      const result = await service.checkIn(organizationId, userId, validJpegFile());

      expect(result.checkInIsOnSite).toBeNull();
    });

    it('gan null khi chua cau hinh toa do van phong, du co toa do thiet bi', async () => {
      const attendanceRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const configServiceMock = createConfigServiceMock({
        'office.latitude': undefined,
        'office.longitude': undefined,
      });
      const { service } = createService({ attendanceRepoMock, configServiceMock });

      const result = await service.checkIn(organizationId, userId, validJpegFile(), 21.0285, 105.8542);

      expect(result.checkInIsOnSite).toBeNull();
    });

    it('checkOutIsOnSite duoc tinh doc lap voi checkInIsOnSite (vd vao van phong nhung ra ngoai truoc khi checkout)', async () => {
      const attendance = {
        id: 'att-1',
        organizationId,
        userId,
        workDate: '2026-08-22',
        checkInAt: new Date(),
        checkInIsOnSite: true,
        checkOutAt: null,
      };
      const attendanceRepoMock = { findOne: jest.fn().mockResolvedValue(attendance) };
      const { service } = createService({ attendanceRepoMock });

      const result = await service.checkOut(organizationId, userId, validJpegFile(), 10.7769, 106.7009);

      expect(result.checkInIsOnSite).toBe(true);
      expect(result.checkOutIsOnSite).toBe(false);
    });
  });

  describe('computeFaceMatched qua checkIn()/checkOut() - diem tuong dong khuon mat CHI la tin hieu them, KHONG chan cham cong', () => {
    it('gan true khi diem tuong dong >= nguong (0.35)', async () => {
      const attendanceRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const { service } = createService({ attendanceRepoMock });

      const result = await service.checkIn(organizationId, userId, validJpegFile(), undefined, undefined, 0.9);

      expect(result.checkInFaceMatchScore).toBe(0.9);
      expect(result.checkInFaceMatched).toBe(true);
    });

    it('gan false khi diem tuong dong duoi nguong (khong phai null - DA danh gia la khong khop)', async () => {
      const attendanceRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const { service } = createService({ attendanceRepoMock });

      const result = await service.checkIn(organizationId, userId, validJpegFile(), undefined, undefined, 0.1);

      expect(result.checkInFaceMatchScore).toBe(0.1);
      expect(result.checkInFaceMatched).toBe(false);
    });

    it('gan null (KHAC voi false) khi khong gui diem tuong dong - chua dang ky khuon mat/khong phat hien duoc mat, khong chan check-in', async () => {
      const attendanceRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const { service } = createService({ attendanceRepoMock });

      const result = await service.checkIn(organizationId, userId, validJpegFile());

      expect(result.checkInFaceMatchScore).toBeNull();
      expect(result.checkInFaceMatched).toBeNull();
    });

    it('checkOutFaceMatched duoc tinh doc lap voi checkInFaceMatched', async () => {
      const attendance = {
        id: 'att-1',
        organizationId,
        userId,
        workDate: '2026-10-24',
        checkInAt: new Date(),
        checkInFaceMatchScore: 0.9,
        checkInFaceMatched: true,
        checkOutAt: null,
      };
      const attendanceRepoMock = { findOne: jest.fn().mockResolvedValue(attendance) };
      const { service } = createService({ attendanceRepoMock });

      const result = await service.checkOut(organizationId, userId, validJpegFile(), undefined, undefined, 0.1);

      expect(result.checkInFaceMatched).toBe(true);
      expect(result.checkOutFaceMatched).toBe(false);
    });
  });

  describe('checkOut', () => {
    it('bao loi khi chua check-in ngay hom nay (khong tim thay ban ghi Attendance) - khong upload anh', async () => {
      const attendanceRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const { service, minioServiceMock } = createService({ attendanceRepoMock });

      await expect(service.checkOut(organizationId, userId, validJpegFile())).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.NOT_CHECKED_IN_YET }),
      });
      expect(minioServiceMock.putObject).not.toHaveBeenCalled();
    });

    it('bao loi khi da check-out hom nay roi - khong upload anh lan 2', async () => {
      const attendance = { id: 'att-1', organizationId, userId, workDate: '2026-08-22', checkOutAt: new Date() };
      const attendanceRepoMock = { findOne: jest.fn().mockResolvedValue(attendance) };
      const { service, minioServiceMock } = createService({ attendanceRepoMock });

      await expect(service.checkOut(organizationId, userId, validJpegFile())).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.ALREADY_CHECKED_OUT_TODAY }),
      });
      expect(minioServiceMock.putObject).not.toHaveBeenCalled();
    });

    it('checkout thanh cong: cap nhat ban ghi hien co, upload anh, ghi outbox event ATTENDANCE_CHECKED_OUT', async () => {
      const attendance = {
        id: 'att-1',
        organizationId,
        userId,
        workDate: '2026-08-22',
        checkInAt: new Date(),
        checkOutAt: null,
      };
      const attendanceRepoMock = { findOne: jest.fn().mockResolvedValue(attendance) };
      const { service, outboxServiceMock, minioServiceMock } = createService({ attendanceRepoMock });

      const result = await service.checkOut(organizationId, userId, validJpegFile(), 21.0285, 105.8542);

      expect(result.checkOutAt).toBeInstanceOf(Date);
      expect(result.checkOutPhotoObjectKey).toContain('checkout');
      expect(minioServiceMock.putObject).toHaveBeenCalledTimes(1);
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ eventType: EVENT_TYPES.ATTENDANCE_CHECKED_OUT }),
      );
    });

    it('race condition: 2 request checkout dong thoi - request thua cuoc bi tu choi thay vi ghi de len anh/gio cua request thang', async () => {
      // Pre-check (ngoai transaction) doc thay checkOutAt=null (chua ai checkout) - CA HAI request
      // deu vuot qua duoc buoc nay. Nhung giua luc pre-check va luc request nay lay duoc khoa
      // pessimistic_write, request kia da checkout xong va commit truoc -> doc lai BEN TRONG
      // transaction (manager.findOne, sau khi co khoa) phai thay checkOutAt DA duoc set.
      const beforeRace = { id: 'att-1', organizationId, userId, workDate: '2026-08-22', checkOutAt: null };
      const afterRace = { id: 'att-1', organizationId, userId, workDate: '2026-08-22', checkOutAt: new Date() };
      const attendanceRepoMock = { findOne: jest.fn().mockResolvedValue(beforeRace) };
      const managerMock = {
        create: jest.fn((_entityClass: unknown, data: unknown) => data),
        save: jest.fn((entity: unknown) => Promise.resolve(entity)),
        findOne: jest.fn().mockResolvedValue(afterRace),
      };
      const { service, outboxServiceMock } = createService({ attendanceRepoMock, managerMock });

      await expect(service.checkOut(organizationId, userId, validJpegFile())).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.ALREADY_CHECKED_OUT_TODAY }),
      });
      expect(managerMock.save).not.toHaveBeenCalled();
      expect(outboxServiceMock.record).not.toHaveBeenCalled();
      expect(managerMock.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
      );
    });
  });
});
