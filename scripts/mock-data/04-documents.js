// 24/10/2026: kich ban 04 - Tai lieu: cay thu muc RESTRICTED long nhau (thu muc con/chau ke thua
// han che tu thu muc cha), ngoai le chia se thu muc/chia se file truc tiep, tai len/tai xuong,
// phien ban moi, file hong/zip bomb (chi duoc bo qua khi trich van ban, khong lam sap service),
// gioi han 25MB va tim kiem RAG (search-chunks) khong lo noi dung bi han che.
// Cay du lieu (Manager tao):
//   R  "Kho mat"           RESTRICTED
//   |- C  "Con cua kho mat"  (ORGANIZATION, ke thua han che) -> fSalary, fDirect (chia se file cho Employee)
//   |  `- G "Chau"            -> fGrand
//   `- SH "Con duoc chia se"  (FolderShare cho Employee)       -> fShared
//   O  "Cong khai"          ORGANIZATION -> PDF, DOCX, file hong, zip bomb, file cua Employee
// Don dep: xoa R va O (xoa kem toan bo ben trong, ke ca file Employee tai len - Employee khong co
// quyen document:delete), kiem tra file da 404.
// Can chay `node scripts/mock-data/mkfixtures.js` neu thu muc fixtures/ chua co.
const fs = require('fs');
const path = require('path');
const { api, upload, decode, login, list, check, summary, purgeTraces, sleep, sql, q } = require('./lib');
const FX = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', n));
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const TAG = `MOCK-${Date.now().toString(36)}`;
const ok = (s) => s === 200 || s === 201;
const denied = (s) => s === 403 || s === 404;

(async () => {
  const since = Date.now();
  const S = {};
  const ids = [];
  const mkFolder = async (key, name, parentFolderId) => {
    const r = await api('manager', 'POST', '/folders', { name: `${TAG} ${name}`, ...(parentFolderId ? { parentFolderId } : {}) });
    S[key] = r.data && r.data.id;
    ids.push(S[key]);
    return r.status;
  };
  const up = async (who, key, name, content, mime, folder) => {
    const r = await upload(who, `${TAG}-${name}`, content, mime, folder);
    S[key] = r.data && r.data.id;
    ids.push(S[key]);
    return r;
  };
  try {
    const empId = decode(await login('employee')).sub;
    // 1. Dung cay thu muc
    check('tao thu muc R', (await mkFolder('R', 'Kho mật')) === 201);
    check('dat R = RESTRICTED', (await api('manager', 'PATCH', `/folders/${S.R}`, { visibility: 'restricted' })).status === 200);
    check('tao C (con cua R)', (await mkFolder('C', 'Con của kho mật', S.R)) === 201);
    check('tao G (chau cua R)', (await mkFolder('G', 'Cháu', S.C)) === 201);
    check('tao SH (con cua R)', (await mkFolder('SH', 'Con được chia sẻ', S.R)) === 201);
    check('chia se thu muc SH cho Employee', (await api('manager', 'POST', `/folders/${S.SH}/shares`, { sharedWithUserId: empId })).status === 201);
    check('tao O (cong khai)', (await mkFolder('O', 'Công khai')) === 201);

    // 2. Tai len
    const T = 'text/plain';
    check('upload fSalary vao C', ok((await up('manager', 'fSalary', 'luong-thuong.txt', 'Bảng lương thưởng quý 4: thưởng Tết dự kiến 5 tháng lương cho giám đốc Kim Ngân.', T, S.C)).status));
    check('upload fGrand vao G', ok((await up('manager', 'fGrand', 'sap-nhap.txt', 'Kế hoạch sáp nhập công ty Ánh Dương, định giá 120 tỷ đồng.', T, S.G)).status));
    check('upload fDirect vao C', ok((await up('manager', 'fDirect', 'hop-dong-thue-kho.txt', 'Hợp đồng thuê kho Bình Dương số HD-889: giá thuê 45 triệu đồng mỗi tháng.', T, S.C)).status));
    check('upload fShared vao SH', ok((await up('manager', 'fShared', 'lich-bao-tri.txt', 'Lịch bảo trì thang máy tòa nhà Hoa Mai: thứ Tư tuần đầu mỗi tháng.', T, S.SH)).status));
    check('chia se file fDirect cho Employee (VIEW)', ok((await api('manager', 'POST', `/files/${S.fDirect}/share`, { sharedWithUserId: empId, permission: 'VIEW' })).status));
    const pdf = await up('manager', 'fPdf', 'quy-dinh-bao-mat.pdf', FX('t1-quy-dinh-bao-mat.pdf'), 'application/pdf', S.O);
    check('upload PDF hop le', ok(pdf.status), pdf.status);
    check('upload DOCX hop le', ok((await up('manager', 'fDocx', 'so-tay-phuc-loi.docx', FX('t1-so-tay-phuc-loi.docx'), DOCX, S.O)).status));
    check('upload PDF hong (van luu tep)', ok((await up('manager', 'fBadPdf', 'hong.pdf', FX('t1-hong.pdf'), 'application/pdf', S.O)).status));
    check('upload DOCX hong (van luu tep)', ok((await up('manager', 'fBadDocx', 'hong.docx', FX('t1-hong.docx'), DOCX, S.O)).status));
    check('upload DOCX zip bomb (van luu tep)', ok((await up('manager', 'fBomb', 'zip-bomb.docx', FX('t1-zip-bomb.docx'), DOCX, S.O)).status));
    const big = await upload('manager', `${TAG}-qua-25mb.txt`, Buffer.alloc(25 * 1024 * 1024 + 1024, 'x'), T, S.O);
    if (big.data && big.data.id) ids.push(big.data.id);
    check('upload > 25MB bi tu choi', big.status === 413 || big.status === 400, big.status);
    const own = await up('employee', 'fOwn', 'ghi-chu-nhan-vien.txt', 'Ghi chú cá nhân của nhân viên.', T, S.O);
    check('Employee upload vao thu muc cong khai', ok(own.status), own.status);

    // 3. Ma tran quyen (ke thua han che tu thu muc cha)
    const expectEmp = { fSalary: false, fGrand: false, fDirect: true, fShared: true, fPdf: true };
    for (const [k, allowed] of Object.entries(expectEmp)) {
      const s = (await api('employee', 'GET', `/files/${S[k]}`)).status;
      check(`Employee GET ${k} -> ${allowed ? 'cho phep' : 'chan'}`, allowed ? s === 200 : denied(s), s);
    }
    check('Employee liet ke file trong C -> chan', denied((await api('employee', 'GET', `/files?folderId=${S.C}`)).status));
    check('Employee liet ke file trong G -> chan', denied((await api('employee', 'GET', `/files?folderId=${S.G}`)).status));
    const shList = await api('employee', 'GET', `/files?folderId=${S.SH}`);
    check('Employee liet ke file trong SH (duoc chia se)', shList.status === 200 && JSON.stringify(shList.data).includes(S.fShared), shList.status);
    const rootList = list((await api('employee', 'GET', '/folders')).data);
    check('Employee khong thay R trong danh sach goc', !rootList.some((f) => f.id === S.R), `n=${rootList.length}`);
    check('Employee doi ten C -> chan', denied((await api('employee', 'PATCH', `/folders/${S.C}`, { name: 'x' })).status));
    check('Employee tai xuong fGrand -> chan', denied((await api('employee', 'GET', `/files/${S.fGrand}/download`)).status));
    for (const who of ['manager', 'admin']) {
      const st = [];
      for (const k of ['fSalary', 'fGrand', 'fDirect', 'fShared']) st.push((await api(who, 'GET', `/files/${S[k]}`)).status);
      check(`${who} GET moi file trong R`, st.every((s) => s === 200), st.join(','));
    }

    // 4. Tai xuong + phien ban moi
    // Tai xuong tra URL tam (presigned MinIO, het han ngan) - tai noi dung qua URL do va so byte.
    const dl = await api('employee', 'GET', `/files/${S.fPdf}/download`);
    let match = false;
    if (dl.data && dl.data.downloadUrl) {
      // Giu nguyen host trong URL (chu ky presigned gom ca host, doi sang 127.0.0.1 se bi 403).
      const res = await fetch(dl.data.downloadUrl);
      const raw = Buffer.from(await res.arrayBuffer());
      match = raw.equals(FX('t1-quy-dinh-bao-mat.pdf'));
      if (!match) console.log(`   tai qua URL tam -> ${res.status} ${raw.length}B`);
    }
    check('Employee tai xuong PDF dung noi dung (qua URL tam)', dl.status === 200 && match, dl.status);
    const v2 = await upload('manager', `${TAG}-quy-dinh-bao-mat.pdf`, FX('t1-quy-dinh-bao-mat.pdf'), 'application/pdf', undefined, S.fPdf);
    check('tai len phien ban 2', ok(v2.status) && v2.data.currentVersion === 2, `${v2.status} v=${v2.data && v2.data.currentVersion}`);
    // Chia se file quyen VIEW chi cho xem: khong tai phien ban moi, khong tu nang quyen chia se.
    const vv = await upload('employee', `${TAG}-hop-dong-thue-kho.txt`, 'ghi đè', T, undefined, S.fDirect);
    check('Employee (chia se VIEW) tai phien ban moi -> 403', vv.status === 403, vv.status);
    const rs = await api('employee', 'POST', `/files/${S.fDirect}/share`, { sharedWithUserId: empId, permission: 'EDIT' });
    check('Employee (chia se VIEW) tu nang quyen EDIT -> 403', rs.status === 403, rs.status);
    check('Manager nang chia se len EDIT', ok((await api('manager', 'POST', `/files/${S.fDirect}/share`, { sharedWithUserId: empId, permission: 'EDIT' })).status));
    const ve = await upload('employee', `${TAG}-hop-dong-thue-kho.txt`, 'Bản sửa của nhân viên.', T, undefined, S.fDirect);
    check('Employee (chia se EDIT) tai phien ban moi', ok(ve.status) && ve.data.currentVersion === 2, ve.status);
    check('Employee xoa file (khong co document:delete) -> 403', (await api('employee', 'DELETE', `/files/${S.fShared}`)).status === 403);

    // 5. RAG: doi file duoc lap chi muc roi tim kiem (moi lan tim goi 1 embedding)
    // Bo lap chi muc chay dinh ky ~60s: doi rag_indexed_version cua fSalary trong CSDL (khong ton luot
    // embedding), toi da 120s, roi moi tim kiem.
    let indexed = false;
    for (let i = 0; i < 24 && !indexed; i++) {
      await sleep(5000);
      indexed = sql('postgres-doc', `select count(*) from file_metas where id = ${q(S.fSalary)} and rag_indexed_version is not null;`) === '1';
    }
    check('RAG: fSalary duoc lap chi muc', indexed);
    const sMgr = await api('manager', 'POST', '/files/search-chunks', { query: 'thưởng Tết giám đốc Kim Ngân bao nhiêu tháng lương', topK: 5 });
    check('RAG: Manager tim thay fSalary', JSON.stringify(sMgr.data || '').includes(S.fSalary),
      `${sMgr.status} ${(sMgr.data && sMgr.data.results || []).map((x) => x.fileName).join(', ').slice(0, 200)}`);
    const sEmp = await api('employee', 'POST', '/files/search-chunks', { query: 'thưởng Tết giám đốc Kim Ngân bao nhiêu tháng lương', topK: 5 });
    const leak = JSON.stringify(sEmp.data || '').includes(S.fSalary);
    check('RAG: Employee khong tim thay noi dung trong thu muc con cua R', sEmp.status < 300 && !leak, `${sEmp.status} leak=${leak}`);
    const health = await api('admin', 'GET', '/files?limit=1');
    check('document-service van song sau file hong/zip bomb', health.status === 200, health.status);
  } catch (e) {
    check('ngoai le', false, e.stack);
  } finally {
    for (const k of ['R', 'O']) if (S[k]) check(`don dep: xoa thu muc ${k} (kem noi dung)`, (await api('manager', 'DELETE', `/folders/${S[k]}`)).status < 300);
    if (S.fSalary) check('file trong thu muc da xoa -> 404', (await api('admin', 'GET', `/files/${S.fSalary}`)).status === 404);
    console.log(`don dep su kien: ${JSON.stringify(await purgeTraces(ids, since))}`);
    summary();
  }
})();
