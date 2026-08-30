#!/usr/bin/env node
// 26/08/2026: sau dot rollout i18n (react-i18next, Viet/Anh/Nhat) va sau do 3 lan rieng biet phai
// tim thu cong chuoi tieng Viet co dau con sot lai truc tiep trong file .ts/.tsx (DatePicker.tsx,
// RecentActivityFeed.tsx, Topbar.tsx - ca 3 deu bi phat hien SAU KHI dot rollout i18n da duoc coi
// la "hoan tat"), toi tu dong hoa lai buoc kiem tra nay thay vi tiep tuc dua vao ra soat thu cong
// moi lan. Quy uoc: sau khi rollout i18n, moi chuoi hien thi cho nguoi dung phai di qua t() va noi
// dung that nam trong apps/web/src/i18n/locales/*.json - vi vay bat ky ky tu co dau tieng Viet nao
// con sot lai truc tiep trong ma nguon .ts/.tsx (ngoai comment) deu la dau hieu 1 chuoi bi bo sot.
//
// Chay: node scripts/check-hardcoded-vietnamese.js
// Thoat 0 neu sach, thoat 1 va in danh sach file:line neu con sot.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIR = path.join(ROOT, 'apps', 'web', 'src');

// Chi cac nguyen am/phu am tieng Viet co dau rieng biet - gan nhu khong bao gio xuat hien trong
// tieng Anh/tieng Nhat/dinh danh ma nguon, nen it bao dong gia.
const VIETNAMESE_DIACRITIC_RE =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

const IGNORE_MARKER = 'i18n-lint-ignore';
const EXCLUDE_SUFFIXES = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx', '.d.ts'];

/** Bo comment (// va /* *\/) nhung giu nguyen noi dung chuoi/template literal va giu nguyen so
 *  dong (thay noi dung comment bi xoa bang khoang trang/xuong dong) de bao cao dung so dong. */

// 27/08/2026 (phat hien qua ra soat lai): thieu nhan biet regex literal - 1 pattern nhu
// /^https?:\/\// (dau `/` thoat trong regex) se bi hieu nham la bat dau comment `//` ngay giua
// chung, lam MAT toan bo phan con lai cua dong (bao gom ca chuoi tieng Viet that su sau do) ma
// khong bao loi/canh bao gi - sai lech theo huong "bo sot", nguy hiem hon false positive. Them ham
// nay de nhan dien dau `/` nao THUC SU la mo dau regex (dua theo ky tu/tu khoa ngay truoc no, cung
// heuristic pho bien cua cac tokenizer JS don gian) roi "an" nguyen noi dung regex y het cach da
// lam voi string/template literal.
const REGEX_PRECEDING_KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'case', 'delete', 'void', 'throw', 'new', 'in', 'of', 'yield', 'await', 'else', 'do',
]);

function regexLiteralAllowedHere(result) {
  let i = result.length - 1;
  while (i >= 0 && /\s/.test(result[i])) i--;
  if (i < 0) return true; // dau file
  const lastChar = result[i];
  if (/[)\]}]/.test(lastChar)) return false; // sau gia tri (goi ham/mang/khoi) -> '/' la phep chia
  if (/[\w$]/.test(lastChar)) {
    let j = i;
    while (j >= 0 && /[\w$]/.test(result[j])) j--;
    return REGEX_PRECEDING_KEYWORDS.has(result.slice(j + 1, i + 1));
  }
  return true; // sau toan tu/dau cau khac (=, (, ,, !, &&, ?, :, ...) -> co the la regex
}

function stripComments(code) {
  let result = '';
  let i = 0;
  const n = code.length;
  while (i < n) {
    const c = code[i];
    const c2 = code[i + 1];
    if (c === '/' && c2 === '/') {
      while (i < n && code[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && c2 === '*') {
      i += 2;
      while (i < n && !(code[i] === '*' && code[i + 1] === '/')) {
        if (code[i] === '\n') result += '\n';
        i++;
      }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      result += c;
      i++;
      while (i < n && code[i] !== quote) {
        if (code[i] === '\\') {
          result += code[i] + (code[i + 1] ?? '');
          i += 2;
          continue;
        }
        if (code[i] === '\n') result += '\n';
        else result += code[i];
        i++;
      }
      if (i < n) {
        result += code[i];
        i++;
      }
      continue;
    }
    if (c === '/' && regexLiteralAllowedHere(result)) {
      let j = i + 1;
      let inCharClass = false;
      let closed = false;
      while (j < n && code[j] !== '\n') {
        if (code[j] === '\\') { j += 2; continue; }
        if (code[j] === '[') { inCharClass = true; j++; continue; }
        if (code[j] === ']') { inCharClass = false; j++; continue; }
        if (code[j] === '/' && !inCharClass) { j++; closed = true; break; }
        j++;
      }
      if (closed) {
        result += code.slice(i, j); // an noi dung regex (khong quet dau tieng Viet ben trong)
        i = j;
        while (i < n && /[a-z]/i.test(code[i])) { result += code[i]; i++; } // flags (vd /gi)
        continue;
      }
      // Khong tim thay dau '/' dong hop le tren cung dong - khong phai regex, coi la '/' thuong.
    }
    result += c;
    i++;
  }
  return result;
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !EXCLUDE_SUFFIXES.some((s) => entry.name.endsWith(s))) {
      files.push(full);
    }
  }
  return files;
}

function checkFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const rawLines = raw.split('\n');
  const stripped = stripComments(raw);
  const strippedLines = stripped.split('\n');

  const violations = [];
  for (let idx = 0; idx < strippedLines.length; idx++) {
    // Chap nhan chu thich bo qua tren CHINH dong do hoac dong NGAY TRUOC (tien loi khi dong flag
    // qua dai/chua ky tu dac biet kho chen inline, vd literal \uXXXX trong regex).
    const onThisLine = rawLines[idx]?.includes(IGNORE_MARKER);
    const onPrevLine = idx > 0 && rawLines[idx - 1]?.includes(IGNORE_MARKER);
    if (onThisLine || onPrevLine) continue;
    if (VIETNAMESE_DIACRITIC_RE.test(strippedLines[idx])) {
      violations.push({ line: idx + 1, text: rawLines[idx].trim() });
    }
  }
  return violations;
}

function main() {
  if (!fs.existsSync(SCAN_DIR)) {
    console.error(`Khong tim thay thu muc can quet: ${SCAN_DIR}`);
    process.exit(1);
  }

  const files = walk(SCAN_DIR);
  let totalViolations = 0;

  for (const file of files) {
    const violations = checkFile(file);
    if (violations.length === 0) continue;
    const rel = path.relative(ROOT, file);
    for (const v of violations) {
      console.log(`${rel}:${v.line}: ${v.text}`);
      totalViolations++;
    }
  }

  if (totalViolations > 0) {
    console.log(
      `\n${totalViolations} chuoi tieng Viet co dau con sot lai truc tiep trong ma nguon (ngoai comment) - ` +
        `chuyen sang t('<namespace>:<key>') va them noi dung vao apps/web/src/i18n/locales/*.json. ` +
        `Neu day la ngoai le co chu dich, them chu thich "${IGNORE_MARKER}" tren cung dong hoac dong ngay truoc.`,
    );
    process.exit(1);
  }

  console.log(`Sach - khong con chuoi tieng Viet co dau nao ngoai comment trong ${files.length} file da quet.`);
}

main();
