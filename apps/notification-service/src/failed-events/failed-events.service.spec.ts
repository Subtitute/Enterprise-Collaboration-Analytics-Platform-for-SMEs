import { Model } from 'mongoose';
import { DeadLetterEnvelope } from '@app/common-dto';
import { FailedEventsService } from './failed-events.service';
import { FailedEventDocument } from './schemas/failed-event.schema';
import { ListFailedEventsQueryDto } from './dto/list-failed-events-query.dto';

/**
 * 28/07/2026: unit test cho FailedEventsService (Technical_Spec.md muc 14 - nang cap Dead
 * Letter Queue). MAU THAM CHIEU: notifications/notifications.service.spec.ts (cach mock
 * Mongoose Model va chain find().sort().skip().limit().exec()).
 */
describe('FailedEventsService', () => {
  let service: FailedEventsService;
  let modelMock: { create: jest.Mock; find: jest.Mock; countDocuments: jest.Mock };

  const envelope: DeadLetterEnvelope = {
    eventId: 'evt-1',
    eventType: 'task.assigned',
    organizationId: 'org-1',
    sourceService: 'notification-service',
    sourceTopic: 'project-task.events',
    errorType: 'RETRY_EXHAUSTED',
    errorMessage: 'Mongo connection timeout',
    attempts: 5,
    rawPayload: '{}',
    failedAt: '2026-07-28T00:00:00.000Z',
  };

  beforeEach(() => {
    modelMock = {
      create: jest.fn().mockResolvedValue({ id: 'fe-1', ...envelope }),
      find: jest.fn(),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
    };
    service = new FailedEventsService(modelMock as unknown as Model<FailedEventDocument>);
  });

  describe('record', () => {
    it('ghi 1 DeadLetterEnvelope vao Mongo qua Model.create', async () => {
      await service.record(envelope);

      expect(modelMock.create).toHaveBeenCalledWith(expect.objectContaining(envelope));
    });

    it('cho phep eventId/eventType/organizationId = null (loi phat hien truoc khi doc duoc cac truong nay)', async () => {
      const malformedEnvelope: DeadLetterEnvelope = {
        ...envelope,
        eventId: null,
        eventType: null,
        organizationId: null,
        errorType: 'MALFORMED_JSON',
        attempts: 1,
      };

      await service.record(malformedEnvelope);

      expect(modelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: null, eventType: null, organizationId: null }),
      );
    });
  });

  describe('findForOrganization', () => {
    function mockFindChain(data: unknown[]) {
      const execMock = jest.fn().mockResolvedValue(data);
      const limitMock = jest.fn().mockReturnValue({ exec: execMock });
      const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
      const sortMock = jest.fn().mockReturnValue({ skip: skipMock });
      modelMock.find.mockReturnValue({ sort: sortMock });
      return { sortMock, skipMock, limitMock, execMock };
    }

    it('loc THEO DUNG organizationId duoc truyen vao (org-scoping)', async () => {
      mockFindChain([]);

      await service.findForOrganization('org-1', { page: 1, limit: 20 } as ListFailedEventsQueryDto);

      expect(modelMock.find).toHaveBeenCalledWith({ organizationId: 'org-1' });
    });

    it('sap xep theo failedAt GIAM DAN (moi nhat truoc)', async () => {
      const { sortMock } = mockFindChain([]);

      await service.findForOrganization('org-1', { page: 1, limit: 20 } as ListFailedEventsQueryDto);

      expect(sortMock).toHaveBeenCalledWith({ failedAt: -1 });
    });

    it('phan trang dung theo page/limit (skip = (page - 1) * limit)', async () => {
      const { skipMock, limitMock } = mockFindChain([]);

      await service.findForOrganization('org-1', { page: 3, limit: 10 } as ListFailedEventsQueryDto);

      expect(skipMock).toHaveBeenCalledWith(20);
      expect(limitMock).toHaveBeenCalledWith(10);
    });

    it('tra ve dung shape { data, meta: { page, limit, total } } - quy uoc phan trang chuan cua he thong', async () => {
      mockFindChain([{ id: 'fe-1' }]);
      modelMock.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });

      const result = await service.findForOrganization('org-1', {
        page: 1,
        limit: 20,
      } as ListFailedEventsQueryDto);

      expect(result).toEqual({ data: [{ id: 'fe-1' }], meta: { page: 1, limit: 20, total: 1 } });
    });

    it('to chuc khac nhau tao filter khac nhau - khong tra ve du lieu cheo to chuc', async () => {
      mockFindChain([]);

      await service.findForOrganization('org-2', { page: 1, limit: 20 } as ListFailedEventsQueryDto);

      expect(modelMock.find).toHaveBeenCalledWith({ organizationId: 'org-2' });
      expect(modelMock.find).not.toHaveBeenCalledWith({ organizationId: 'org-1' });
    });
  });
});
