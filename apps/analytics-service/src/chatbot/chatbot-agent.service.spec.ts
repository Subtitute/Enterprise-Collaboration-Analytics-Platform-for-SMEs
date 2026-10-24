// 24/10/2026: unit test vong lap tool-calling cua Chat bot noi bo - mock `global.fetch` cho Gemini/Groq
// (khong goi API that) va mock ChatbotToolsService (khong goi Gateway that).
import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@app/common-dto';
import { ChatbotAgentService, MAX_TOOL_ROUNDS } from './chatbot-agent.service';
import { ChatbotToolsService, ToolContext } from './chatbot-tools.service';

const CTX: ToolContext = { userId: 'user-1', organizationId: 'org-1', permissions: [], authorization: 'Bearer jwt' };
const GEMINI_URL_PART = 'generativelanguage.googleapis.com';
const GROQ_URL_PART = 'api.groq.com';

function ok(body: unknown) {
  return { status: 200, text: async () => JSON.stringify(body) };
}
function fail(status: number) {
  return { status, text: async () => '{"error":"overloaded"}' };
}
function geminiToolCall(name: string, args: Record<string, unknown>, id = 'call_1') {
  return ok({ candidates: [{ content: { role: 'model', parts: [{ functionCall: { id, name, args }, thoughtSignature: 'SIG-1' }] } }] });
}
function geminiText(text: string) {
  return ok({ candidates: [{ content: { role: 'model', parts: [{ text }] } }] });
}
function groqToolCall(name: string, args: Record<string, unknown>) {
  return ok({ choices: [{ message: { content: null, tool_calls: [{ id: 'tc_1', type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }] });
}
function groqText(text: string) {
  return ok({ choices: [{ message: { content: text } }] });
}

describe('ChatbotAgentService', () => {
  let fetchMock: jest.Mock;
  let toolsService: { getDefinitions: jest.Mock; execute: jest.Mock };
  let config: Record<string, string | undefined>;

  function buildAgent() {
    const configService = { get: jest.fn((key: string) => config[key]) } as unknown as ConfigService;
    return new ChatbotAgentService(configService, toolsService as unknown as ChatbotToolsService);
  }
  function bodyOf(callIndex: number) {
    return JSON.parse(fetchMock.mock.calls[callIndex][1].body);
  }

  beforeEach(() => {
    config = { 'gemini.apiKey': 'g-key', 'groq.apiKey': 'q-key', 'chatbot.geminiModel': 'gemini-flash-lite-latest', 'groq.model': 'openai/gpt-oss-120b' };
    toolsService = {
      getDefinitions: jest.fn().mockReturnValue([
        { name: 'get_my_tasks', description: 'tasks', parameters: { type: 'object', properties: {} } },
      ]),
      execute: jest.fn().mockImplementation((name: string, args: Record<string, unknown>) =>
        Promise.resolve({ name, args, output: '{"tasks":[{"title":"Bao cao Q3"}]}', documentHits: [{ fileId: 'f-1', fileName: 'A.pdf' }] }),
      ),
    };
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('Gemini: goi tool roi tra loi; vong 2 gui lai NGUYEN VAN part co thoughtSignature + functionResponse kem id', async () => {
    fetchMock.mockResolvedValueOnce(geminiToolCall('get_my_tasks', { status: 'DOING' })).mockResolvedValueOnce(geminiText('Bạn có 1 việc: Bao cao Q3'));

    const result = await buildAgent().run({ history: [{ role: 'user', content: 'cu' }, { role: 'assistant', content: 'cu tra loi' }], question: 'Việc của tôi?', toolContext: CTX });

    expect(result).toMatchObject({ answer: 'Bạn có 1 việc: Bao cao Q3', provider: 'gemini', toolCalls: [{ name: 'get_my_tasks', args: { status: 'DOING' } }] });
    expect(toolsService.execute).toHaveBeenCalledWith('get_my_tasks', { status: 'DOING' }, CTX, expect.any(Number));
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ 'x-goog-api-key': 'g-key' });

    const second = bodyOf(1);
    expect(second.contents[0]).toEqual({ role: 'user', parts: [{ text: 'cu' }] });
    expect(second.contents[1]).toEqual({ role: 'model', parts: [{ text: 'cu tra loi' }] });
    expect(second.contents[3]).toEqual({
      role: 'model',
      parts: [{ functionCall: { id: 'call_1', name: 'get_my_tasks', args: { status: 'DOING' } }, thoughtSignature: 'SIG-1' }],
    });
    expect(second.contents[4]).toEqual({
      role: 'user',
      parts: [{ functionResponse: { id: 'call_1', name: 'get_my_tasks', response: { result: '{"tasks":[{"title":"Bao cao Q3"}]}' } } }],
    });
    // Tool khong tham so: khong gui `parameters` rong cho Gemini.
    expect(second.tools[0].functionDeclarations[0]).toEqual({ name: 'get_my_tasks', description: 'tasks' });
  });

  it('Gemini loi (503) -> chay lai voi Groq du phong, ket qua tool duoc CACHE (khong goi lai)', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes(GEMINI_URL_PART)) {
        return fetchMock.mock.calls.filter(([u]) => String(u).includes(GEMINI_URL_PART)).length === 1
          ? Promise.resolve(geminiToolCall('get_my_tasks', {}))
          : Promise.resolve(fail(503));
      }
      const groqCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes(GROQ_URL_PART)).length;
      return Promise.resolve(groqCalls === 1 ? groqToolCall('get_my_tasks', {}) : groqText('Groq trả lời'));
    });

    const result = await buildAgent().run({ history: [], question: 'Việc của tôi?', toolContext: CTX });

    expect(result.provider).toBe('groq');
    expect(result.answer).toBe('Groq trả lời');
    expect(toolsService.execute).toHaveBeenCalledTimes(1);
    const groqSecond = JSON.parse(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1].body);
    expect(groqSecond.messages[groqSecond.messages.length - 1]).toEqual({ role: 'tool', tool_call_id: 'tc_1', content: '{"tasks":[{"title":"Bao cao Q3"}]}' });
    expect(groqSecond.messages[0].role).toBe('system');
  });

  it(`toi da ${MAX_TOOL_ROUNDS} vong goi tool, vong cuoi ep tra loi bang van ban (mode NONE)`, async () => {
    let round = 0;
    fetchMock.mockImplementation(() => {
      round++;
      return Promise.resolve(round <= MAX_TOOL_ROUNDS ? geminiToolCall('get_my_tasks', { round }, `call_${round}`) : geminiText('Kết luận cuối'));
    });

    const result = await buildAgent().run({ history: [], question: 'Hỏi vòng lặp', toolContext: CTX });

    expect(result.answer).toBe('Kết luận cuối');
    expect(toolsService.execute).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
    expect(bodyOf(0).toolConfig.functionCallingConfig.mode).toBe('AUTO');
    expect(bodyOf(MAX_TOOL_ROUNDS).toolConfig.functionCallingConfig.mode).toBe('NONE');
  });

  it('qua nhieu tool call trong 1 luot: chi chay 4, MOI call van co ket qua tra ve cho model', async () => {
    const parts = Array.from({ length: 6 }, (_, i) => ({ functionCall: { id: `c${i}`, name: 'get_my_tasks', args: { i } } }));
    fetchMock
      .mockResolvedValueOnce(ok({ candidates: [{ content: { role: 'model', parts } }] }))
      .mockResolvedValueOnce(geminiText('Xong'));

    await buildAgent().run({ history: [], question: 'q', toolContext: CTX });

    expect(toolsService.execute).toHaveBeenCalledTimes(4);
    const contents = bodyOf(1).contents;
    const responses = contents[contents.length - 1].parts;
    expect(responses).toHaveLength(6);
    expect(responses[5].functionResponse.response.result).toContain('Bỏ qua');
  });

  it('chi co Groq (khong co GEMINI_API_KEY) -> dung Groq ngay', async () => {
    config['gemini.apiKey'] = undefined;
    fetchMock.mockResolvedValueOnce(groqText('Chỉ Groq'));
    const result = await buildAgent().run({ history: [], question: 'q', toolContext: CTX });
    expect(result.provider).toBe('groq');
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer q-key' });
  });

  it('ca 2 nha cung cap deu loi -> 503 CHATBOT_GENERATION_FAILED', async () => {
    fetchMock.mockResolvedValue(fail(503));
    const error = await buildAgent()
      .run({ history: [], question: 'q', toolContext: CTX })
      .catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({ errorCode: ERROR_CODES.CHATBOT_GENERATION_FAILED });
  });

  it('model tra ve rong (khong text, khong tool) -> coi la loi, chuyen du phong', async () => {
    fetchMock.mockResolvedValueOnce(ok({ candidates: [{ finishReason: 'SAFETY' }] })).mockResolvedValueOnce(groqText('Du phong'));
    const result = await buildAgent().run({ history: [], question: 'q', toolContext: CTX });
    expect(result.answer).toBe('Du phong');
  });

  it('isConfigured() false khi thieu ca 2 API key', () => {
    config = {};
    expect(buildAgent().isConfigured()).toBe(false);
  });
});
