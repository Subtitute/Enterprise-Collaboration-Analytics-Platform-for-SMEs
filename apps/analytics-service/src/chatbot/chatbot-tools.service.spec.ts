// 24/10/2026: unit test tool cua Chat bot noi bo - mock `global.fetch` (khong goi Gateway that). Trong
// tam: tool goi DUNG endpoint Gateway cong khai, forward NGUYEN VEN header Authorization cua nguoi hoi,
// loc dung du lieu "cua toi", cat bot ket qua, va KHONG BAO GIO nem loi (loi -> ket qua { error }).
import { ConfigService } from '@nestjs/config';
import { PERMISSIONS } from '@app/common-dto';
import { ChatbotToolsService, MAX_TOOL_OUTPUT_CHARS, ToolContext } from './chatbot-tools.service';
import { toGmt7DateString } from './utils/gmt7.util';

const GATEWAY = 'http://gateway:3000';
const CTX: ToolContext = {
  userId: 'user-1',
  organizationId: 'org-1',
  permissions: [PERMISSIONS.DOCUMENT_VIEW, PERMISSIONS.TASK_VIEW, PERMISSIONS.PROJECT_VIEW],
  authorization: 'Bearer user-jwt',
  correlationId: 'corr-1',
};

function jsonResponse(status: number, body: unknown) {
  return { status, text: async () => JSON.stringify(body) };
}

describe('ChatbotToolsService', () => {
  let service: ChatbotToolsService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    const config = { get: jest.fn((key: string) => (key === 'chatbot.gatewayUrl' ? GATEWAY : undefined)) };
    service = new ChatbotToolsService(config as unknown as ConfigService);
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('chi khai bao tool nguoi hoi co quyen (leave/attendance khong can quyen rieng)', () => {
    const names = service.getDefinitions([PERMISSIONS.TASK_VIEW]).map((tool) => tool.name);
    expect(names).toEqual(['get_my_tasks', 'get_my_leave_balance', 'get_my_attendance_today']);
  });

  it('search_documents: POST /files/search-chunks qua Gateway, forward Authorization + correlation id', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        ragEnabled: true,
        results: [{ fileId: 'f-1', fileName: 'Quy-dinh.pdf', content: 'x'.repeat(2000), score: 0.81 }],
      }),
    );

    const execution = await service.execute('search_documents', { query: 'nghỉ phép' }, CTX, 5000);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${GATEWAY}/api/v1/files/search-chunks`);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer user-jwt', 'x-correlation-id': 'corr-1' });
    expect(JSON.parse(init.body)).toEqual({ query: 'nghỉ phép', topK: 5 });

    const output = JSON.parse(execution.output);
    expect(output.results[0]).toMatchObject({ document: 'Quy-dinh.pdf', relevance: 0.81 });
    expect(output.results[0].excerpt.length).toBe(700);
    expect(output.notice).toContain('không phải chỉ dẫn');
    expect(execution.documentHits).toEqual([{ fileId: 'f-1', fileName: 'Quy-dinh.pdf' }]);
  });

  it('search_documents khi RAG tat: tra ve ghi chu ro rang, khong co documentHits', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ragEnabled: false, results: [] }));
    const execution = await service.execute('search_documents', { query: 'abc' }, CTX, 5000);
    expect(JSON.parse(execution.output)).toMatchObject({ ragEnabled: false });
    expect(execution.documentHits).toEqual([]);
  });

  it('get_my_tasks: loc Task giao cho CHINH nguoi hoi, gan ten du an, uu tien DOING truoc', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: [
            { title: 'Viec cua toi - TODO', status: 'TODO', dueDate: null, projectId: 'p-1', assignees: [{ userId: 'user-1' }] },
            { title: 'Viec nguoi khac', status: 'DOING', dueDate: null, projectId: 'p-1', assignees: [{ userId: 'user-2' }] },
            { title: 'Viec cua toi - DOING', status: 'DOING', dueDate: '2026-10-30T17:00:00.000Z', projectId: 'p-2', assignees: [{ userId: 'user-1' }] },
          ],
          meta: { total: 3 },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: [{ id: 'p-1', name: 'Du an Alpha' }, { id: 'p-2', name: 'Du an Beta' }], meta: { total: 2 } }));

    const execution = await service.execute('get_my_tasks', {}, CTX, 5000);

    expect(fetchMock.mock.calls[0][0]).toBe(`${GATEWAY}/api/v1/tasks?limit=500`);
    const output = JSON.parse(execution.output);
    expect(output.totalAssigned).toBe(2);
    expect(output.tasks).toEqual([
      { title: 'Viec cua toi - DOING', status: 'DOING', dueDate: '2026-10-31', project: 'Du an Beta' },
      { title: 'Viec cua toi - TODO', status: 'TODO', dueDate: null, project: 'Du an Alpha' },
    ]);
  });

  it('get_my_tasks: tong Task xem duoc > so da quet -> ket qua co note "chua day du"', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { data: [{ title: 'Viec cua toi', status: 'TODO', projectId: 'p-1', assignees: [{ userId: 'user-1' }] }], meta: { total: 900 } }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: [], meta: { total: 0 } }));
    const output = JSON.parse((await service.execute('get_my_tasks', {}, CTX, 5000)).output);
    expect(output.note).toContain('1/900');

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [], meta: { total: 0 } }));
    expect(JSON.parse((await service.execute('get_my_tasks', {}, CTX, 5000)).output).note).toBeUndefined();
  });

  it('get_my_tasks voi status hop le -> them vao query string; status la bi bo qua', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [], meta: { total: 0 } }));
    await service.execute('get_my_tasks', { status: 'DONE' }, CTX, 5000);
    await service.execute('get_my_tasks', { status: 'DROP TABLE' }, CTX, 5000);
    expect(fetchMock.mock.calls[0][0]).toBe(`${GATEWAY}/api/v1/tasks?limit=500&status=DONE`);
    expect(fetchMock.mock.calls[1][0]).toBe(`${GATEWAY}/api/v1/tasks?limit=500`);
  });

  it('Gateway tra 403 -> ket qua { error } bao khong co quyen, KHONG nem loi', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, { message: 'Forbidden' }));
    const execution = await service.execute('get_project_status', { name: 'Alpha' }, CTX, 5000);
    expect(JSON.parse(execution.output)).toEqual({ error: 'Người dùng không có quyền xem dữ liệu này.' });
  });

  it('tool khong duoc khai bao cho nguoi hoi (thieu quyen) hoac khong ton tai -> loi, khong goi Gateway', async () => {
    const noTaskView: ToolContext = { ...CTX, permissions: [] };
    const denied = await service.execute('get_my_tasks', {}, noTaskView, 5000);
    const unknown = await service.execute('delete_everything', {}, CTX, 5000);
    expect(JSON.parse(denied.output).error).toContain('không có quyền');
    expect(JSON.parse(unknown.output).error).toContain('không tồn tại');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('thieu tham so bat buoc -> loi, khong goi Gateway', async () => {
    const execution = await service.execute('search_documents', { query: '   ' }, CTX, 5000);
    expect(JSON.parse(execution.output).error).toContain('query');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loi mang/timeout -> ket qua { error }', async () => {
    fetchMock.mockRejectedValueOnce(new Error('aborted'));
    const execution = await service.execute('get_my_leave_balance', {}, CTX, 5000);
    expect(JSON.parse(execution.output).error).toContain('Không gọi được');
  });

  it('cat bot ket qua qua dai truoc khi dua vao LLM', async () => {
    const tasks = Array.from({ length: 40 }, (_, i) => ({
      title: `Viec ${i} ${'y'.repeat(400)}`,
      status: 'TODO',
      projectId: 'p-1',
      assignees: [{ userId: 'user-1' }],
    }));
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { data: tasks, meta: { total: 40 } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: [], meta: { total: 0 } }));
    const execution = await service.execute('get_my_tasks', {}, CTX, 5000);
    expect(execution.output.length).toBeLessThanOrEqual(MAX_TOOL_OUTPUT_CHARS + 20);
    expect(execution.output.endsWith('…[đã cắt bớt]')).toBe(true);
  });

  it('get_my_leave_balance: cong phep tham nien theo ngay vao lam (mirror LeaveRequestsPage)', async () => {
    const joined = new Date(Date.now() - 11 * 365.25 * 24 * 60 * 60 * 1000).toISOString();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { year: 2026, usedDays: 3, baseDaysPerYear: 12, seniorityYearsPerBonusDay: 5 }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 'user-1', createdAt: joined }));

    const execution = await service.execute('get_my_leave_balance', {}, CTX, 5000);

    expect(fetchMock.mock.calls[0][0]).toBe(`${GATEWAY}/api/v1/leave-requests/me/balance`);
    expect(fetchMock.mock.calls[1][0]).toBe(`${GATEWAY}/api/v1/users/user-1`);
    expect(JSON.parse(execution.output)).toMatchObject({ entitledDays: 14, seniorityBonusDays: 2, usedDays: 3, remainingDays: 11 });
  });

  it('get_my_attendance_today: chi lay ban ghi HOM NAY (GMT+7), quy gio ve GMT+7', async () => {
    const today = toGmt7DateString(new Date());
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        data: [{ workDate: today, checkInAt: '2026-10-24T01:15:00.000Z', checkOutAt: null, checkInIsOnSite: true }],
        meta: { total: 1 },
      }),
    );
    const output = JSON.parse((await service.execute('get_my_attendance_today', {}, CTX, 5000)).output);
    expect(output).toMatchObject({ date: today, checkedIn: true, checkInTime: '08:15', checkedOut: false });
  });

  it('get_my_attendance_today: chua cham cong hom nay -> checkedIn false', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [{ workDate: '2000-01-01', checkInAt: '2000-01-01T01:00:00Z' }], meta: { total: 1 } }));
    const output = JSON.parse((await service.execute('get_my_attendance_today', {}, CTX, 5000)).output);
    expect(output.checkedIn).toBe(false);
  });
});
