// 24/10/2026: unit test ChatbotService - trong tam: (1) quyen so huu hoi thoai (moi truy van loc theo CA
// organization_id LAN user_id, hoi thoai cua nguoi khac = 404), (2) tran cau hoi/ngay (429, khong goi
// LLM), (3) luu cap hoi-dap + trich dan dung tai lieu duoc nhac ten. Mock DataSource (raw SQL).
import { ConflictException, HttpException, HttpStatus, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@app/common-dto';
import { ChatbotService, pickCitations } from './chatbot.service';
import { ChatbotAgentService } from './chatbot-agent.service';
import { ToolContext } from './chatbot-tools.service';

const CONVERSATION_ID = '3f0c2a5e-8d6b-4c1a-9e7f-2b4d6a8c0e1f';
const OWNER = { userId: 'user-1', organizationId: 'org-1' };
const CTX: ToolContext = { ...OWNER, permissions: ['chatbot:use'], authorization: 'Bearer jwt' };
const CONVERSATION = { id: CONVERSATION_ID, title: null, createdAt: new Date('2026-10-24T01:00:00Z'), updatedAt: new Date('2026-10-24T01:00:00Z') };

describe('ChatbotService', () => {
  let dataSource: { query: jest.Mock; transaction: jest.Mock };
  let manager: { query: jest.Mock };
  let agent: { isConfigured: jest.Mock; run: jest.Mock };
  let ownedConversations: string[];
  let quotaRows: { questionCount: number }[];
  let lockedRows: { title: string | null }[];

  function buildService() {
    const config = { get: jest.fn((key: string) => (key === 'chatbot.dailyQuestionLimit' ? 30 : undefined)) };
    return new ChatbotService(dataSource as never, config as unknown as ConfigService, agent as unknown as ChatbotAgentService);
  }

  beforeEach(() => {
    ownedConversations = [CONVERSATION_ID];
    quotaRows = [{ questionCount: 5 }];
    lockedRows = [{ title: null }];
    manager = {
      query: jest.fn().mockImplementation((sql: string, params: unknown[]) => {
        if (sql.includes('FOR UPDATE')) return Promise.resolve(lockedRows);
        if (sql.includes("'user'")) return Promise.resolve([{ id: 'm-1', role: 'user', content: params[1], citations: null, toolCalls: null, createdAt: params[2] }]);
        if (sql.includes("'assistant'")) {
          return Promise.resolve([
            { id: 'm-2', role: 'assistant', content: params[1], toolCalls: JSON.parse(params[2] as string), citations: JSON.parse(params[3] as string), createdAt: params[4] },
          ]);
        }
        return Promise.resolve([]);
      }),
    };
    dataSource = {
      query: jest.fn().mockImplementation((sql: string, params: unknown[]) => {
        if (sql.includes('FROM chatbot_conversations WHERE id = $1')) {
          // Chi tra ve khi DUNG id + DUNG to chuc + DUNG nguoi dung.
          const [id, organizationId, userId] = params as string[];
          const owned = ownedConversations.includes(id) && organizationId === OWNER.organizationId && userId === OWNER.userId;
          return Promise.resolve(owned ? [CONVERSATION] : []);
        }
        if (sql.includes('INSERT INTO chatbot_daily_usage')) return Promise.resolve(quotaRows);
        if (sql.includes('SELECT role, content FROM')) return Promise.resolve([{ role: 'user', content: 'Cau truoc' }, { role: 'assistant', content: 'Tra loi truoc' }]);
        if (sql.includes('FROM chatbot_messages WHERE conversation_id')) {
          return Promise.resolve([{ id: 'm-1', role: 'user', content: 'Hi', citations: null, toolCalls: null, createdAt: new Date() }]);
        }
        return Promise.resolve([]);
      }),
      transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)),
    };
    agent = {
      isConfigured: jest.fn().mockReturnValue(true),
      run: jest.fn().mockResolvedValue({
        answer: 'Theo [Quy-dinh-lam-viec.pdf], bạn được làm từ xa 2 ngày/tuần.',
        provider: 'gemini',
        toolCalls: [{ name: 'search_documents', args: { query: 'lam viec tu xa' } }],
        documentHits: [
          { fileId: 'f-1', fileName: 'Quy-dinh-lam-viec.pdf' },
          { fileId: 'f-2', fileName: 'Bien-ban-hop.docx' },
          { fileId: 'f-1', fileName: 'Quy-dinh-lam-viec.pdf' },
        ],
      }),
    };
  });

  describe('quyen so huu hoi thoai', () => {
    it('hoi thoai cua nguoi khac (khac userId) -> 404 CHATBOT_CONVERSATION_NOT_FOUND', async () => {
      const service = buildService();
      const error = await service.listMessages({ ...OWNER, userId: 'user-2' }, CONVERSATION_ID).catch((err: unknown) => err);
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toMatchObject({ errorCode: ERROR_CODES.CHATBOT_CONVERSATION_NOT_FOUND });
    });

    it('cung userId nhung khac to chuc -> 404', async () => {
      await expect(buildService().listMessages({ ...OWNER, organizationId: 'org-2' }, CONVERSATION_ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('id sai dinh dang UUID -> 404, KHONG cham DB', async () => {
      await expect(buildService().listMessages(OWNER, 'abc')).rejects.toBeInstanceOf(NotFoundException);
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('chu so huu doc duoc tin nhan', async () => {
      const messages = await buildService().listMessages(OWNER, CONVERSATION_ID);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({ role: 'user', citations: [], toolCalls: [] });
    });

    it('xoa hoi thoai cua nguoi khac -> 404, khong chay DELETE', async () => {
      await expect(buildService().deleteConversation({ ...OWNER, userId: 'user-2' }, CONVERSATION_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(dataSource.query.mock.calls.some(([sql]) => String(sql).startsWith('DELETE'))).toBe(false);
    });

    it('xoa hoi thoai cua chinh minh -> DELETE loc theo id + to chuc + nguoi dung', async () => {
      await buildService().deleteConversation(OWNER, CONVERSATION_ID);
      const deleteCall = dataSource.query.mock.calls.find(([sql]) => String(sql).startsWith('DELETE'));
      expect(deleteCall?.[1]).toEqual([CONVERSATION_ID, 'org-1', 'user-1']);
    });

    it('danh sach hoi thoai chi loc theo to chuc + nguoi goi', async () => {
      dataSource.query.mockImplementation((sql: string) => Promise.resolve(sql.includes('count(*)') ? [{ total: 0 }] : []));
      await buildService().listConversations(OWNER, { page: 1, limit: 20 });
      for (const [, params] of dataSource.query.mock.calls) {
        expect((params as unknown[]).slice(0, 2)).toEqual(['org-1', 'user-1']);
      }
    });

    it('hoi tiep vao hoi thoai cua nguoi khac -> 404, KHONG tru han ngach, KHONG goi LLM', async () => {
      ownedConversations = [];
      await expect(buildService().ask(CTX, CONVERSATION_ID, 'Xin chao')).rejects.toBeInstanceOf(NotFoundException);
      expect(dataSource.query.mock.calls.some(([sql]) => String(sql).includes('chatbot_daily_usage'))).toBe(false);
      expect(agent.run).not.toHaveBeenCalled();
    });
  });

  describe('tran cau hoi/ngay', () => {
    it('vuot tran -> 429 CHATBOT_DAILY_LIMIT_EXCEEDED kem errorParams.limit, KHONG goi LLM', async () => {
      quotaRows = [];
      const error = await buildService()
        .ask(CTX, CONVERSATION_ID, 'Cau hoi thu 31')
        .catch((err: unknown) => err);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect((error as HttpException).getResponse()).toMatchObject({
        errorCode: ERROR_CODES.CHATBOT_DAILY_LIMIT_EXCEEDED,
        errorParams: { limit: 30 },
      });
      expect(agent.run).not.toHaveBeenCalled();
    });

    it('UPSERT nguyen tu dung tran cau hinh + ngay GMT+7 + dung nguoi dung', async () => {
      await buildService().ask(CTX, CONVERSATION_ID, 'Hoi');
      const [sql, params] = dataSource.query.mock.calls.find(([s]) => String(s).includes('INSERT INTO chatbot_daily_usage')) as [string, unknown[]];
      expect(sql).toContain('WHERE chatbot_daily_usage.question_count < $4');
      expect(params[0]).toBe('user-1');
      expect(params[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(params[3]).toBe(30);
    });

    // 24/10/2026: bien ngay GMT+7 (tung co loi lech ngay UTC/GMT+7 o module khac) - 16:59:59Z van la
    // ngay 24/10 o Viet Nam, 17:00:00Z da sang 25/10 (bo dem moi).
    it.each([
      ['2026-10-24T16:59:59.999Z', '2026-10-24'],
      ['2026-10-24T17:00:00.000Z', '2026-10-25'],
    ])('luc %s (UTC) dem vao ngay %s (GMT+7)', async (now, expectedDate) => {
      jest.useFakeTimers({ now: new Date(now), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
      try {
        await buildService().ask(CTX, CONVERSATION_ID, 'Hoi');
      } finally {
        jest.useRealTimers();
      }
      const [, params] = dataSource.query.mock.calls.find(([s]) => String(s).includes('INSERT INTO chatbot_daily_usage')) as [string, unknown[]];
      expect(params[1]).toBe(expectedDate);
    });
  });

  describe('dong thoi / xoa giua chung', () => {
    it('hoi thoai bi xoa trong luc cho LLM -> 404 (khong de INSERT vi pham FK thanh 500), khong luu tin nhan', async () => {
      lockedRows = [];
      const error = await buildService()
        .ask(CTX, CONVERSATION_ID, 'Hoi')
        .catch((err: unknown) => err);
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toMatchObject({ errorCode: ERROR_CODES.CHATBOT_CONVERSATION_NOT_FOUND });
      const [lockSql, lockParams] = manager.query.mock.calls[0] as [string, unknown[]];
      expect(lockSql).toContain('FOR UPDATE');
      expect(lockParams).toEqual([CONVERSATION_ID, 'org-1', 'user-1']);
      expect(manager.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO chatbot_messages'))).toBe(false);
    });

    it('giu nguyen tieu de da co (doc lai trong transaction), khong ghi de bang cau hoi moi', async () => {
      lockedRows = [{ title: 'Tieu de cu' }];
      const result = await buildService().ask(CTX, CONVERSATION_ID, 'Cau hoi moi');
      expect(result.conversation.title).toBe('Tieu de cu');
    });

    it('cau hoi thu 2 vao CUNG hoi thoai khi cau 1 chua xong -> 409 CHATBOT_CONVERSATION_BUSY, KHONG tru han ngach; xong thi hoi tiep duoc', async () => {
      let releaseFirst: () => void = () => undefined;
      const firstAnswer = agent.run.getMockImplementation();
      agent.run.mockImplementationOnce(
        () => new Promise((resolve) => (releaseFirst = () => resolve(firstAnswer?.() as never))),
      );
      const service = buildService();

      const first = service.ask(CTX, CONVERSATION_ID, 'Cau 1');
      await new Promise((resolve) => setImmediate(resolve));
      const second = await service.ask(CTX, CONVERSATION_ID, 'Cau 2').catch((err: unknown) => err);
      expect(second).toBeInstanceOf(ConflictException);
      expect((second as ConflictException).getResponse()).toMatchObject({ errorCode: ERROR_CODES.CHATBOT_CONVERSATION_BUSY });
      const quotaCalls = () => dataSource.query.mock.calls.filter(([sql]) => String(sql).includes('chatbot_daily_usage')).length;
      expect(quotaCalls()).toBe(1);

      releaseFirst();
      await first;
      await expect(service.ask(CTX, CONVERSATION_ID, 'Cau 3')).resolves.toBeDefined();
      expect(quotaCalls()).toBe(2);
    });

    it('LLM loi -> giai phong khoa hoi thoai (cau hoi sau van gui duoc)', async () => {
      agent.run.mockRejectedValueOnce(new ServiceUnavailableException('loi'));
      const service = buildService();
      await expect(service.ask(CTX, CONVERSATION_ID, 'Cau 1')).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(service.ask(CTX, CONVERSATION_ID, 'Cau 2')).resolves.toBeDefined();
    });
  });

  describe('ask', () => {
    it('chua cau hinh LLM -> 503 CHATBOT_NOT_CONFIGURED, khong tru han ngach', async () => {
      agent.isConfigured.mockReturnValue(false);
      const error = await buildService()
        .ask(CTX, CONVERSATION_ID, 'Hoi')
        .catch((err: unknown) => err);
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getResponse()).toMatchObject({ errorCode: ERROR_CODES.CHATBOT_NOT_CONFIGURED });
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('thanh cong: gui lich su lam ngu canh, luu ca cap hoi-dap, trich dan dung tai lieu duoc nhac ten', async () => {
      const result = await buildService().ask(CTX, CONVERSATION_ID, 'Làm việc từ xa được mấy ngày?');

      expect(agent.run).toHaveBeenCalledWith({
        history: [
          { role: 'user', content: 'Cau truoc' },
          { role: 'assistant', content: 'Tra loi truoc' },
        ],
        question: 'Làm việc từ xa được mấy ngày?',
        toolContext: CTX,
      });
      expect(result.userMessage.content).toBe('Làm việc từ xa được mấy ngày?');
      expect(result.assistantMessage.citations).toEqual([{ fileId: 'f-1', fileName: 'Quy-dinh-lam-viec.pdf' }]);
      expect(result.assistantMessage.toolCalls).toEqual([{ name: 'search_documents', args: { query: 'lam viec tu xa' } }]);
      expect(result.conversation.title).toBe('Làm việc từ xa được mấy ngày?');
      expect(result.usage).toEqual({ usedToday: 5, dailyLimit: 30 });
      // Cau hoi duoc ghi TRUOC cau tra loi (created_at tach biet de sap xep dung thu tu).
      expect(result.userMessage.createdAt.getTime()).toBeLessThanOrEqual(result.assistantMessage.createdAt.getTime());
    });

    it('LLM loi -> khong luu tin nhan nao (khong de lai cau hoi mo coi)', async () => {
      agent.run.mockRejectedValue(new ServiceUnavailableException('loi'));
      await expect(buildService().ask(CTX, CONVERSATION_ID, 'Hoi')).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });
});

describe('pickCitations', () => {
  const hits = [
    { fileId: 'f-1', fileName: 'Quy-dinh-nghi-phep.pdf' },
    { fileId: 'f-2', fileName: 'So-tay-nhan-vien.docx' },
    { fileId: 'f-3', fileName: 'Bao-cao.txt' },
  ];

  it('chi giu tai lieu duoc nhac ten trong cau tra loi (ten day du hoac bo duoi), khong phan biet hoa thuong, khong trung lap', () => {
    const answer = 'Theo [quy-dinh-nghi-phep.pdf] va So-tay-nhan-vien, ... [Quy-dinh-nghi-phep.pdf]';
    expect(pickCitations(answer, [...hits, hits[0]])).toEqual([hits[0], hits[1]]);
  });

  it('nhieu file khac nhau trung ten -> chi hien 1 trich dan', () => {
    const duplicates = [
      { fileId: 'a', fileName: 'bao-cao-tien-do-1.txt' },
      { fileId: 'b', fileName: 'bao-cao-tien-do-1.txt' },
    ];
    expect(pickCitations('Theo [bao-cao-tien-do-1.txt] ...', duplicates)).toEqual([duplicates[0]]);
  });

  it('cau tra loi "khong tim thay" -> khong trich dan gi', () => {
    expect(pickCitations('Mình không tìm thấy tài liệu liên quan.', hits)).toEqual([]);
  });
});
