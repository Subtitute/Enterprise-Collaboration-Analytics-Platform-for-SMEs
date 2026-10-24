// 24/10/2026: kich ban 07 - Chat bot noi bo. Phan 1 (khong ton han ngach Gemini): phan quyen
// (chatbot:use, IDOR giua 2 nguoi dung cung to chuc, Super Admin khong co quyen), validate dau vao.
// Phan 2: hoi that vai cau (moi cau = 1 luot goi Gemini, han ngach free tier dung chung voi "Nhan
// xet AI" - giu it cau). Moi cuoc tro chuyen tao ra deu bi xoa o cuoi.
// Chay: node scripts/mock-data/07-chatbot.js [employee|manager] ["cau hoi 1" "cau hoi 2" ...]
//       (khong truyen cau hoi = dung 2 cau mac dinh; truyen "-" = bo qua phan 2)
const { api, call, login, check, summary } = require('./lib');
const DEFAULT_QUESTIONS = ['Tôi còn bao nhiêu ngày phép năm nay?', 'Tôi đang có những công việc nào chưa hoàn thành?'];

(async () => {
  const [who = 'employee', ...args] = process.argv.slice(2);
  const questions = args[0] === '-' ? [] : args.length ? args : DEFAULT_QUESTIONS;
  const convs = [];
  try {
    // Phan 1 - phan quyen va validate
    const c = await api('employee', 'POST', '/chatbot/conversations');
    const id = c.data && c.data.id;
    if (id) convs.push(['employee', id]);
    check('Employee tao cuoc tro chuyen', c.status === 201, c.status);
    check('Manager doc tin nhan cua Employee -> 404', (await api('manager', 'GET', `/chatbot/conversations/${id}/messages`)).status === 404);
    check('Manager hoi trong cuoc tro chuyen cua Employee -> 404', (await api('manager', 'POST', `/chatbot/conversations/${id}/messages`, { question: 'hi' })).status === 404);
    check('Manager xoa cuoc tro chuyen cua Employee -> 404', (await api('manager', 'DELETE', `/chatbot/conversations/${id}`)).status === 404);
    check('Super Admin (khong co chatbot:use) -> 403', (await api('superadmin', 'POST', '/chatbot/conversations')).status === 403);
    check('khong token -> 401', (await call('GET', '/chatbot/conversations', null)).status === 401);
    check('cau hoi rong -> 400', (await api('employee', 'POST', `/chatbot/conversations/${id}/messages`, { question: '' })).status === 400);
    check('cau hoi chi khoang trang -> 400', (await api('employee', 'POST', `/chatbot/conversations/${id}/messages`, { question: '  \n\t ' })).status === 400);
    check('cau hoi 1001 ky tu -> 400', (await api('employee', 'POST', `/chatbot/conversations/${id}/messages`, { question: 'a'.repeat(1001) })).status === 400);
    check('id khong phai UUID -> 400/404 (khong 500)', [400, 404].includes((await api('employee', 'GET', '/chatbot/conversations/abc/messages')).status));
    check('limit=501 -> 400', (await api('employee', 'GET', '/chatbot/conversations?limit=501')).status === 400);

    // Phan 2 - hoi that
    if (questions.length) {
      await login(who);
      const conv = (await api(who, 'POST', '/chatbot/conversations')).data;
      convs.push([who, conv.id]);
      for (const question of questions) {
        const r = await api(who, 'POST', `/chatbot/conversations/${conv.id}/messages`, { question });
        const a = r.data && r.data.assistantMessage;
        check(`hoi: ${question.slice(0, 60)}`, r.status === 201 && a && a.content.length > 0, `${r.status} ${r.ms}ms`);
        if (a) {
          console.log(`   tools=${JSON.stringify((a.toolCalls || []).map((t) => t.name || t))} citations=${JSON.stringify((a.citations || []).map((x) => x.fileName))}`);
          console.log(`   A: ${a.content.replace(/\n/g, ' ').slice(0, 400)}`);
        } else {
          console.log(`   ${JSON.stringify(r.data).slice(0, 300)}`);
        }
      }
      const hist = await api(who, 'GET', `/chatbot/conversations/${conv.id}/messages`);
      check('lich su luu du cau hoi + tra loi', hist.status === 200 && (hist.data || []).length >= questions.length * 2, `n=${(hist.data || []).length}`);
    }
  } catch (e) {
    check('ngoai le', false, e.stack);
  } finally {
    for (const [owner, id] of convs) check('don dep: xoa cuoc tro chuyen', (await api(owner, 'DELETE', `/chatbot/conversations/${id}`)).status < 300);
    summary();
  }
})();
