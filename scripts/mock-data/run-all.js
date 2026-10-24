// 24/10/2026: chay lan luot toan bo kich ban kiem thu live (01 -> 08), in tong ket PASS/FAIL theo
// tung kich ban. Mac dinh BO QUA 2 kich ban ton han ngach Gemini (07 phan hoi that, 08); them
// tham so --with-llm de chay ca hai (~6 luot goi Gemini).
// Chay: node scripts/mock-data/run-all.js [--with-llm]
const { spawnSync } = require('child_process');
const path = require('path');
const withLlm = process.argv.includes('--with-llm');
const plan = [
  ['01-auth-iam.js'],
  ['02-hrm.js'],
  ['03-projects.js'],
  ['04-documents.js'],
  ['05-crm-inventory.js'],
  ['06-analytics-messaging.js'],
  ['07-chatbot.js', ...(withLlm ? ['employee'] : ['employee', '-'])],
  ...(withLlm ? [['08-chatbot-security.js']] : []),
];
const rows = [];
for (const [file, ...args] of plan) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, file), ...args], { encoding: 'utf8', env: process.env });
  const out = (r.stdout || '') + (r.stderr || '');
  process.stdout.write(`\n===== ${file} =====\n${out}`);
  const m = out.match(/(\d+)\/(\d+) PASS/);
  rows.push(`${file.padEnd(28)} ${m ? m[0] : 'LOI'}  ${Math.round((Date.now() - t0) / 1000)}s`);
}
console.log(`\n===== TONG KET =====\n${rows.join('\n')}`);
