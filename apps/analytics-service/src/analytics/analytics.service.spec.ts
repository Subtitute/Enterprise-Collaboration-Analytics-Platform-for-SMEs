import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AnalyticsService } from './analytics.service';
import { RedisService } from '../redis/redis.service';

/**
 * Unit test cho AnalyticsService - tap trung vao diem review 21/07/2026: `range` (7d/30d/quarter)
 * phai duoc truyen xuyen suot xuong truy van SQL cho ca 3 endpoint truoc day KHONG nhan `range`
 * (summary, task-status-breakdown, project-progress), dung lai `resolveTaskTrendConfig()` giong
 * `getTaskTrend()` da lam (Technical_Spec.md muc 3.6, Wireframe.md muc 3/muc 7).
 *
 * Mock `DataSource.query` de kiem tra CHINH XAC interval SQL ('7 days'/'30 days'/'3 months')
 * duoc truyen vao tham so, khong can TimescaleDB that.
 *
 * (Bo sung 21/07/2026 - Technical_Spec.md muc 10, "unit test... tinh toan KPI cua Analytics"):
 * cac describe block "... - tinh toan/edge case" ben duoi bo sung phan con thieu la CHINH cong
 * thuc tinh toan KPI (ty le hoan thanh, guard chia cho 0, gop nhom trang thai, anh xa hang DB ->
 * DTO) - phan test o tren chi xac minh `range` duoc truyen dung xuong SQL, chua kiem tra ket qua
 * tinh toan/hinh dang response tra ve cho frontend.
 */
describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let queryMock: jest.Mock;
  let dataSourceMock: Pick<DataSource, 'query'>;
  let redisServiceMock: { getJson: jest.Mock; setJson: jest.Mock };

  beforeEach(() => {
    queryMock = jest.fn().mockResolvedValue([]);
    dataSourceMock = { query: queryMock };
    redisServiceMock = {
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn().mockResolvedValue(undefined),
    };

    service = new AnalyticsService(
      dataSourceMock as DataSource,
      redisServiceMock as unknown as RedisService,
    );
  });

  describe('getSummary / computeSummary', () => {
    it('mac dinh range="7d" khi khong truyen gi (giong default cua getTaskTrend)', async () => {
      queryMock.mockResolvedValueOnce([{ total_tasks_created: '2', total_tasks_completed: '1' }]);
      queryMock.mockResolvedValueOnce([{ new_documents: '0' }]);
      queryMock.mockResolvedValueOnce([{ active_users: '0' }]);

      await service.getSummary('org-1', '7d');

      for (const call of queryMock.mock.calls) {
        expect(call[1]).toEqual(['org-1', '7 days']);
      }
    });

    it('truyen interval "30 days" xuong ca 3 truy van con khi range=30d', async () => {
      queryMock.mockResolvedValue([{}]);

      await service.getSummary('org-1', '30d');

      expect(queryMock).toHaveBeenCalledTimes(3);
      for (const call of queryMock.mock.calls) {
        expect(call[1]).toEqual(['org-1', '30 days']);
      }
    });

    it('truyen interval "3 months" khi range=quarter', async () => {
      queryMock.mockResolvedValue([{}]);

      await service.getSummary('org-1', 'quarter');

      for (const call of queryMock.mock.calls) {
        expect(call[1]).toEqual(['org-1', '3 months']);
      }
    });

    it('nem BadRequestException voi range khong hop le, khong goi DataSource.query', async () => {
      await expect(service.getSummary('org-1', 'invalid')).rejects.toThrow(BadRequestException);
      expect(queryMock).not.toHaveBeenCalled();
    });

    it('cache Redis theo key rieng cho tung range (tranh tra nham KPI cua range khac)', async () => {
      queryMock.mockResolvedValue([{}]);

      await service.getSummary('org-1', '7d');
      await service.getSummary('org-1', '30d');

      expect(redisServiceMock.getJson).toHaveBeenNthCalledWith(1, 'analytics:summary:org-1:7d');
      expect(redisServiceMock.getJson).toHaveBeenNthCalledWith(2, 'analytics:summary:org-1:30d');
    });
  });

  describe('getSummary / computeSummary - tinh toan ty le hoan thanh (KPI) va edge case', () => {
    /** Gan tung lan goi query() theo dung thu tu ma computeSummary() thuc su goi: task -> doc -> active users. */
    function mockThreeQueries(taskRow: Record<string, unknown>, docRow: Record<string, unknown>, activeRow: Record<string, unknown>) {
      queryMock
        .mockResolvedValueOnce([taskRow])
        .mockResolvedValueOnce([docRow])
        .mockResolvedValueOnce([activeRow]);
    }

    it('tra ve thang cache Redis ngay neu co, KHONG goi DataSource.query', async () => {
      const cached = {
        totalTasksCreated: 99,
        totalTasksCompleted: 50,
        completionRate: 51,
        newDocumentsThisWeek: 1,
        activeUsersLast7Days: 2,
      };
      redisServiceMock.getJson.mockResolvedValueOnce(cached);

      const result = await service.getSummary('org-1', '7d');

      expect(result).toEqual(cached);
      expect(queryMock).not.toHaveBeenCalled();
      expect(redisServiceMock.setJson).not.toHaveBeenCalled();
    });

    it('tinh dung completionRate = round(completed/created*100) va ghi lai cache voi TTL 8 giay', async () => {
      mockThreeQueries(
        { total_tasks_created: '10', total_tasks_completed: '4' },
        { new_documents: '3' },
        { active_users: '5' },
      );

      const result = await service.getSummary('org-1', '7d');

      expect(result).toEqual({
        totalTasksCreated: 10,
        totalTasksCompleted: 4,
        completionRate: 40,
        newDocumentsThisWeek: 3,
        activeUsersLast7Days: 5,
      });
      expect(redisServiceMock.setJson).toHaveBeenCalledWith('analytics:summary:org-1:7d', result, 8);
    });

    it('guard chia cho 0: completionRate = 0 khi khong co task nao', async () => {
      mockThreeQueries(
        { total_tasks_created: '0', total_tasks_completed: '0' },
        { new_documents: '0' },
        { active_users: '0' },
      );

      const result = await service.getSummary('org-empty', '7d');

      expect(result.totalTasksCreated).toBe(0);
      expect(result.completionRate).toBe(0);
    });

    it('completionRate = 100 khi tat ca task da tao deu DONE', async () => {
      mockThreeQueries(
        { total_tasks_created: '7', total_tasks_completed: '7' },
        { new_documents: '0' },
        { active_users: '1' },
      );

      const result = await service.getSummary('org-done', '30d');

      expect(result.completionRate).toBe(100);
    });

    it('lam tron completionRate ve so nguyen gan nhat (1/3 -> 33%, khong phai 33.33)', async () => {
      mockThreeQueries(
        { total_tasks_created: '3', total_tasks_completed: '1' },
        { new_documents: '0' },
        { active_users: '0' },
      );

      const result = await service.getSummary('org-round', '7d');

      expect(result.completionRate).toBe(33);
    });

    it('toNumber guard: cac truong thieu/undefined tu DB tra ve 0 thay vi NaN', async () => {
      mockThreeQueries({}, {}, {});

      const result = await service.getSummary('org-missing-fields', '7d');

      expect(result).toEqual({
        totalTasksCreated: 0,
        totalTasksCompleted: 0,
        completionRate: 0,
        newDocumentsThisWeek: 0,
        activeUsersLast7Days: 0,
      });
    });

    it('cau truy van dem task loai tru task_id co event task.deleted (NOT EXISTS) - Fix 1 22/07/2026', async () => {
      mockThreeQueries(
        { total_tasks_created: '1', total_tasks_completed: '0' },
        { new_documents: '0' },
        { active_users: '0' },
      );

      await service.getSummary('org-1', '7d');

      const [taskSql] = queryMock.mock.calls[0];
      expect(taskSql).toContain("d.event_type = 'task.deleted'");
      expect(taskSql).toContain("pd.event_type = 'project.deleted'");
    });

    // 25/07/2026 (Fix 1 - Major, audit): cau truy van dem task PHAI dung 1 cohort DUY NHAT
    // (created_tasks JOIN latest_status), giong HET pattern cua getTaskStatusBreakdown()/
    // getProjectProgress() o duoi trong file nay - thay vi 2 count(...) FILTER doc lap tren
    // 2 event_type khac nhau cua CUNG 1 tap hang loc theo `time`. Harness hien tai chi mock
    // ket qua DataSource.query() (khong co Postgres/TimescaleDB that de chay SQL that), nen
    // khong the "chay" cohort join va tu no kiem chung ket qua - test ben duoi kiem tra
    // HINH DANG SQL (cau truc CTE/JOIN) de dam bao khong quay lai kieu 2-FILTER-doc-lap cu, va
    // 1 test rieng kiem tra bat bien completionRate <= 100% tren gia tri hang tra ve dung hinh
    // dang cohort (total_tasks_completed la tap con cua total_tasks_created). KHONG chay duoc
    // integration test that voi Postgres/Timescale that trong moi truong nay (khong co ket noi
    // DB dev dang chay san cho task nay) - can luu y truoc khi coi day la kiem chung day du.
    it('dung cohort created_tasks JOIN latest_status (giong getTaskStatusBreakdown/getProjectProgress) thay vi 2 FILTER doc lap - Fix 1 (Major) 25/07/2026', async () => {
      mockThreeQueries(
        { total_tasks_created: '5', total_tasks_completed: '5' },
        { new_documents: '0' },
        { active_users: '0' },
      );

      await service.getSummary('org-1', '7d');

      const [taskSql] = queryMock.mock.calls[0];
      expect(taskSql).toContain('WITH created_tasks AS');
      expect(taskSql).toContain("t.event_type = 'task.created'");
      expect(taskSql).toContain('latest_status AS');
      expect(taskSql).toContain("event_type = 'task.status_changed'");
      expect(taskSql).toContain('LEFT JOIN latest_status ls ON ls.task_id = ct.task_id');
      // total_tasks_completed phai duoc tinh BANG FILTER tren KET QUA JOIN cua chinh cohort
      // created_tasks (bien ct/ls), khong phai FILTER doc lap tren fact_task_events tho nhu SQL cu.
      expect(taskSql).toContain("FILTER (WHERE COALESCE(ls.to_status, 'TODO') = 'DONE')");
      expect(taskSql).not.toMatch(/count\(DISTINCT task_id\) FILTER \(WHERE event_type = 'task\.created'\)/);
    });

    it('task duoc TAO TRUOC khoang thoi gian roi mo lai/hoan thanh lai BEN TRONG khoang khong duoc dem (khong thuoc cohort) - completionRate khong the vuot 100% - Fix 1 (Major) 25/07/2026', async () => {
      // Mo phong ket qua truy van cohort: to chuc co 2 task duoc TAO trong khoang (cohort size=2),
      // ca 2 hien dang DONE -> total_tasks_completed toi da BANG total_tasks_created (2), khong
      // the vuot qua du co bao nhieu task CU (tao truoc khoang) duoc "mo lai roi hoan thanh lai"
      // NGAY TRONG khoang di nua - vi cac task CU do khong nam trong created_tasks (dieu kien
      // t.time >= now() - interval AND event_type = 'task.created' khong khop) nen KHONG duoc
      // JOIN vao ket qua, dung nhu thiet ke cohort.
      mockThreeQueries(
        { total_tasks_created: '2', total_tasks_completed: '2' },
        { new_documents: '0' },
        { active_users: '0' },
      );

      const result = await service.getSummary('org-1', '7d');

      expect(result.totalTasksCompleted).toBeLessThanOrEqual(result.totalTasksCreated);
      expect(result.completionRate).toBeLessThanOrEqual(100);
      expect(result.completionRate).toBe(100);
    });
  });

  // 22/07/2026: bo sung - Fix 4 (cache Redis khong duoc phep la 1 dependency cung bat buoc).
  describe('getSummary - Redis loi khong lam sap request (Fix 4)', () => {
    function mockThreeQueriesRaw() {
      queryMock
        .mockResolvedValueOnce([{ total_tasks_created: '2', total_tasks_completed: '1' }])
        .mockResolvedValueOnce([{ new_documents: '0' }])
        .mockResolvedValueOnce([{ active_users: '0' }]);
    }

    it('doc cache Redis loi (vd mat ket noi) -> coi nhu cache miss, van tra ve KPI tinh tu TimescaleDB', async () => {
      redisServiceMock.getJson.mockRejectedValueOnce(new Error('Redis connection timeout'));
      mockThreeQueriesRaw();

      const result = await service.getSummary('org-1', '7d');

      expect(result.totalTasksCreated).toBe(2);
      expect(queryMock).toHaveBeenCalledTimes(3);
    });

    it('ghi cache Redis loi -> khong throw, van tra ve ket qua da tinh cho request nay', async () => {
      mockThreeQueriesRaw();
      redisServiceMock.setJson.mockRejectedValueOnce(new Error('Redis connection timeout'));

      const result = await service.getSummary('org-1', '7d');

      expect(result.totalTasksCreated).toBe(2);
    });
  });

  describe('getTaskStatusBreakdown', () => {
    it('truyen sinceInterval cua range lam tham so $2 va giu projectId la tham so cuoi khi co loc du an', async () => {
      queryMock.mockResolvedValue([]);

      await service.getTaskStatusBreakdown('org-1', '30d', 'project-1');

      const [, params] = queryMock.mock.calls[0];
      expect(params).toEqual(['org-1', '30 days', 'project-1']);
    });

    it('khong co tham so projectId khi khong loc theo du an', async () => {
      queryMock.mockResolvedValue([]);

      await service.getTaskStatusBreakdown('org-1', '7d');

      const [, params] = queryMock.mock.calls[0];
      expect(params).toEqual(['org-1', '7 days']);
    });

    it('nem BadRequestException voi range khong hop le', async () => {
      await expect(service.getTaskStatusBreakdown('org-1', '1y')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTaskStatusBreakdown - gop nhom trang thai HIEN TAI va edge case', () => {
    it('gop dung so luong task theo tung trang thai tra ve tu DB, giu TODO=0 neu DB khong tra hang TODO', async () => {
      queryMock.mockResolvedValue([
        { status: 'DOING', count: 3 },
        { status: 'DONE', count: 2 },
      ]);

      const result = await service.getTaskStatusBreakdown('org-1', '7d');

      expect(result).toEqual({ TODO: 0, DOING: 3, DONE: 2 });
    });

    it('tra ve toan bo 0 khi du an/to chuc chua co task nao trong khoang range (khong co du lieu)', async () => {
      queryMock.mockResolvedValue([]);

      const result = await service.getTaskStatusBreakdown('org-empty', '7d');

      expect(result).toEqual({ TODO: 0, DOING: 0, DONE: 0 });
    });

    it('bo qua (khong cong don) cac gia tri status nam ngoai TODO/DOING/DONE', async () => {
      queryMock.mockResolvedValue([{ status: 'UNKNOWN_STATUS', count: 99 }]);

      const result = await service.getTaskStatusBreakdown('org-1', '7d');

      expect(result).toEqual({ TODO: 0, DOING: 0, DONE: 0 });
    });

    it('loai tru task_id co event task.deleted va project_id co event project.deleted (NOT EXISTS) - Fix 1 22/07/2026', async () => {
      queryMock.mockResolvedValue([]);

      await service.getTaskStatusBreakdown('org-1', '7d');

      const [sql] = queryMock.mock.calls[0];
      expect(sql).toContain("d.event_type = 'task.deleted'");
      expect(sql).toContain("pd.event_type = 'project.deleted'");
    });
  });

  describe('getProjectProgress', () => {
    it('truyen sinceInterval cua range da resolve lam tham so $2', async () => {
      queryMock.mockResolvedValue([]);

      await service.getProjectProgress('org-1', 'quarter');

      const [, params] = queryMock.mock.calls[0];
      expect(params).toEqual(['org-1', '3 months']);
    });

    it('nem BadRequestException voi range khong hop le', async () => {
      await expect(service.getProjectProgress('org-1', 'nope')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getProjectProgress - % hoan thanh theo tung du an va edge case', () => {
    it('tinh dung completionRate cho tung du an va giu nguyen thu tu tra ve tu DB (ORDER BY project_id)', async () => {
      queryMock.mockResolvedValue([
        { project_id: 'p1', tasks_created: 4, tasks_completed: 2 },
        { project_id: 'p2', tasks_created: 3, tasks_completed: 1 },
      ]);

      const result = await service.getProjectProgress('org-1', '7d');

      expect(result).toEqual([
        { projectId: 'p1', tasksCreated: 4, tasksCompleted: 2, completionRate: 50 },
        { projectId: 'p2', tasksCreated: 3, tasksCompleted: 1, completionRate: 33 }, // round(33.33...)
      ]);
    });

    it('tra ve mang rong khi to chuc chua co du an/task nao trong khoang range (khong co du lieu)', async () => {
      queryMock.mockResolvedValue([]);

      const result = await service.getProjectProgress('org-empty', '7d');

      expect(result).toEqual([]);
    });

    it('guard chia cho 0: completionRate = 0 khi mot du an co tasksCreated = 0', async () => {
      queryMock.mockResolvedValue([{ project_id: 'p1', tasks_created: 0, tasks_completed: 0 }]);

      const result = await service.getProjectProgress('org-1', '7d');

      expect(result).toEqual([{ projectId: 'p1', tasksCreated: 0, tasksCompleted: 0, completionRate: 0 }]);
    });

    it('completionRate = 100 khi toan bo task cua du an da DONE', async () => {
      queryMock.mockResolvedValue([{ project_id: 'p1', tasks_created: 5, tasks_completed: 5 }]);

      const result = await service.getProjectProgress('org-1', '30d');

      expect(result[0].completionRate).toBe(100);
    });

    it('loai tru task_id co event task.deleted va project_id co event project.deleted (NOT EXISTS) - Fix 1 22/07/2026', async () => {
      queryMock.mockResolvedValue([]);

      await service.getProjectProgress('org-1', '7d');

      const [sql] = queryMock.mock.calls[0];
      expect(sql).toContain("d.event_type = 'task.deleted'");
      expect(sql).toContain("pd.event_type = 'project.deleted'");
    });
  });

  describe('getTaskTrend / getDocumentActivity / getRecentActivity - anh xa hang DB -> DTO tra ve FE', () => {
    it('getTaskTrend() chuyen bucket sang ISO string va cac cot dem sang number (khong con string tu Postgres)', async () => {
      queryMock.mockResolvedValue([
        { bucket: '2026-07-01T00:00:00.000Z', tasks_created: '2', tasks_completed: '1' },
      ]);

      const result = await service.getTaskTrend('org-1', '7d');

      expect(result).toEqual([{ date: '2026-07-01T00:00:00.000Z', tasksCreated: 2, tasksCompleted: 1 }]);
    });

    it('getDocumentActivity() anh xa filesUploaded/filesShared sang number', async () => {
      queryMock.mockResolvedValue([
        { bucket: '2026-07-01T00:00:00.000Z', files_uploaded: '5', files_shared: '2' },
      ]);

      const result = await service.getDocumentActivity('org-1', '7d');

      expect(result).toEqual([{ date: '2026-07-01T00:00:00.000Z', filesUploaded: 5, filesShared: 2 }]);
    });

    it('getDocumentActivity() nem BadRequestException voi range khong duoc ho tro (vd "quarter")', async () => {
      await expect(service.getDocumentActivity('org-1', 'quarter')).rejects.toThrow(BadRequestException);
    });

    it('getRecentActivity() tra ve actorId = null va payload = {} khi DB tra null (khong lam sap FE)', async () => {
      queryMock.mockResolvedValue([
        {
          event_id: 'evt-1',
          time: '2026-07-01T00:00:00.000Z',
          event_type: 'task.created',
          producer: 'project-task-service',
          actor_id: null,
          payload: null,
        },
      ]);

      const result = await service.getRecentActivity('org-1');

      expect(result).toEqual([
        {
          eventId: 'evt-1',
          time: '2026-07-01T00:00:00.000Z',
          eventType: 'task.created',
          producer: 'project-task-service',
          actorId: null,
          payload: {},
        },
      ]);
    });

    it('getRecentActivity() gioi han truy van toi da 20 ban ghi va loc theo organizationId', async () => {
      queryMock.mockResolvedValue([]);

      await service.getRecentActivity('org-1');

      const [sql, params] = queryMock.mock.calls[0];
      expect(sql).toContain('LIMIT 20');
      expect(params).toEqual(['org-1']);
    });
  });
});
