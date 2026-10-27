// 26/10/2026: kich ban 10 - Danh sach nhan vien & kho anh nhan dien (Technical_Spec.md muc 27).
//  A. Danh sach nhan vien + hop dong DTO: Org Admin ca to chuc, Manager chi Employee phong minh,
//     Employee/Super Admin 403; GET /users khong bao gio co phoneNumber/employeeCode.
//  B. Ho so: so dien thoai (chuan hoa/tu choi), ma NV trung -> 409, moi khong mat khau -> email kich
//     hoat (MailHog) khong chua mat khau, Manager moi -> phong ban ep ve phong minh.
//  C. Avatar: chinh chu / Manager -> Employee phong minh duoc; Manager -> phong khac / Org Admin,
//     Employee -> nguoi khac: 403; URL presigned tai duoc.
//  D. Anh nhan dien: Manager tai ho -> ban CHO (khong verify) -> nhan vien xac nhan -> verify khop;
//     trung 1:N -> 409; tu choi -> tai ho 409; proxy anh no-store + nhat ky VIEW_REF; ngoai pham vi 403.
//  E. Vong doi: vo hieu hoa -> ml-service xoa sach du lieu khuon mat + object MinIO.
// Anh khuon mat KHONG nam trong repo: dat ECAP_FACE_FIXTURES = thu muc chua person_a.jpg, person_a2.jpg,
// person_b.jpg (sinh tu anh mau opencv_zoo, xem apps/ml-service/tests/face_fixtures.py); thieu thi bo qua D/E.
// 27/10/2026: anh mau nay doi sang anh to bay STS-130 cua NASA (pham vi cong cong) - cach sinh thu muc
// ECAP_FACE_FIXTURES ghi o Doc/Mock_data.md muc 4.9.
// Don dep: xoa vinh vien 2 tai khoan test, tra lai so dien thoai/avatar cua Employee demo, xoa dau vet.
const fs = require('fs');
const path = require('path');
const { api, call, loginRaw, login, decode, check, summary, sql, q, sleep, list, purgeTraces } = require('./lib');

const TAG = Date.now().toString(36);
const FIX = process.env.ECAP_FACE_FIXTURES;
const face = (name) => (FIX ? fs.readFileSync(path.join(FIX, name)) : null);
const OTHER_MANAGER = process.env.ECAP_OTHER_MANAGER_EMAIL || 'bao.tran+167828@demo-sme.vn';
const TEST_PASSWORD = `Tst-${TAG}-Aa1!`;

function form(field, buf, name = 'photo.jpg') {
  const fd = new FormData();
  fd.append(field, new Blob([buf], { type: 'image/jpeg' }), name);
  return fd;
}

async function waitFor(fn, timeoutMs = 30000, stepMs = 2000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const r = await fn();
    if (r || Date.now() > end) return r;
    await sleep(stepMs);
  }
}

(async () => {
  const since = Date.now();
  const created = [];
  let employeeOriginalPhone = null;
  try {
    const adminTok = await login('admin');
    const managerTok = await login('manager');
    const empTok = await login('employee');
    const managerClaims = decode(managerTok);
    const empId = decode(empTok).sub;
    const adminId = decode(adminTok).sub;
    const otherMgr = await loginRaw(OTHER_MANAGER, process.env.ECAP_PASSWORD || 'Password123!');
    const otherMgrTok = otherMgr.data && otherMgr.data.accessToken;
    const otherDept = otherMgrTok ? decode(otherMgrTok).departmentId : null;

    // ---------------------------------------------------------------- A. danh sach + DTO
    const dirAdmin = await api('admin', 'GET', '/users/directory?limit=200');
    check('A1 Org Admin xem danh sach nhan vien ca to chuc', dirAdmin.status === 200 && dirAdmin.data.meta.total > 0 && 'phoneNumber' in list(dirAdmin.data)[0]);
    const dirMgr = await api('manager', 'GET', '/users/directory?limit=200');
    const mgrRows = list(dirMgr.data);
    check('A2 Manager chi thay Employee phong minh (khong chinh minh/Manager/Org Admin)',
      dirMgr.status === 200 && mgrRows.every((u) => u.departmentId === managerClaims.departmentId && u.roleLevel === 'EMPLOYEE' && u.id !== managerClaims.sub),
      `${dirMgr.status} n=${mgrRows.length}`);
    const dirEmp = await api('employee', 'GET', '/users/directory');
    check('A3 Employee -> 403 DIRECTORY_FORBIDDEN', dirEmp.status === 403 && dirEmp.data.errorCode === 'DIRECTORY_FORBIDDEN', dirEmp.status);
    const dirSa = await api('superadmin', 'GET', '/users/directory');
    check('A4 Super Admin -> 403', dirSa.status === 403, dirSa.status);
    const roster = await api('employee', 'GET', '/users?limit=200');
    check('A5 GET /users khong chua phoneNumber/employeeCode', roster.status === 200 && list(roster.data).every((u) => !('phoneNumber' in u) && !('employeeCode' in u)));

    // ---------------------------------------------------------------- B. ho so
    const me = await api('employee', 'GET', `/users/${empId}`);
    employeeOriginalPhone = me.data.phoneNumber ?? null;
    const ph = await api('employee', 'PATCH', '/users/me', { phoneNumber: '+84 912.345.678' });
    check('B1 PATCH /users/me chuan hoa so dien thoai', ph.status === 200 && ph.data.phoneNumber === '0912345678', `${ph.status} ${ph.data && ph.data.phoneNumber}`);
    const phBad = await api('employee', 'PATCH', '/users/me', { phoneNumber: '12345' });
    check('B2 so dien thoai sai -> 400 PHONE_INVALID', phBad.status === 400 && phBad.data.errorCode === 'PHONE_INVALID', phBad.status);

    const roles = list((await api('admin', 'GET', '/roles')).data);
    const employeeRole = roles.find((r) => r.name === 'Employee');
    const kd = await api('admin', 'POST', '/users/invite', {
      email: `a3.kd.${TAG}@demo-sme.vn`, fullName: `A3 KD ${TAG}`, initialPassword: TEST_PASSWORD,
      departmentId: managerClaims.departmentId, roleIds: [employeeRole.id], phoneNumber: '0987 654 321', employeeCode: `a3-${TAG}`,
    });
    check('B3 Org Admin moi kem SDT + ma NV (ma luu chu hoa)', kd.status === 201 && kd.data.id, `${kd.status} ${JSON.stringify(kd.data).slice(0, 160)}`);
    if (kd.data && kd.data.id) created.push(kd.data.id);
    const kt = await api('admin', 'POST', '/users/invite', {
      email: `a3.kt.${TAG}@demo-sme.vn`, fullName: `A3 KT ${TAG}`, departmentId: otherDept || undefined, roleIds: [employeeRole.id],
    });
    check('B4 moi KHONG mat khau -> 201', kt.status === 201 && kt.data.id, kt.status);
    if (kt.data && kt.data.id) created.push(kt.data.id);
    const mail = await waitFor(async () => {
      const r = await fetch(`http://127.0.0.1:8025/api/v2/search?kind=to&query=${encodeURIComponent(`a3.kt.${TAG}@demo-sme.vn`)}`).then((x) => x.json()).catch(() => null);
      return r && r.items && r.items[0];
    }, 20000);
    const mailBody = mail ? Buffer.from(mail.Content.Body, 'utf8').toString() : '';
    check('B5 email kich hoat co link reset-password, khong chua mat khau', /reset-password\?token=/.test(mailBody.replace(/=\r?\n/g, '')) && !/Password123!/.test(mailBody), mail ? 'ok' : 'khong thay email');

    const kdProfile = await api('admin', 'GET', `/users/${kd.data.id}`);
    check('B6 ho so day du: SDT chuan + ma NV chu hoa', kdProfile.data.phoneNumber === '0987654321' && kdProfile.data.employeeCode === `A3-${TAG}`.toUpperCase());
    const dupCode = await api('admin', 'PATCH', `/users/${kt.data.id}`, { employeeCode: `A3-${TAG}`.toLowerCase() });
    check('B7 ma NV trung (khac hoa thuong) -> 409 EMPLOYEE_CODE_TAKEN', dupCode.status === 409 && dupCode.data.errorCode === 'EMPLOYEE_CODE_TAKEN', dupCode.status);
    const mgrSees = await api('manager', 'GET', `/users/${kd.data.id}`);
    check('B8 Manager xem ho so Employee phong minh (co SDT)', mgrSees.status === 200 && mgrSees.data.phoneNumber === '0987654321', mgrSees.status);
    const mgrPatch = await api('manager', 'PATCH', `/users/${kd.data.id}`, { phoneNumber: '0911111111' });
    check('B9 Manager khong sua duoc SDT/ma NV (PATCH /users/:id can user:manage) -> 403', mgrPatch.status === 403, mgrPatch.status);

    // ---------------------------------------------------------------- C. avatar
    if (FIX) {
      const av = await api('employee', 'PUT', '/users/me/avatar', form('avatar', face('person_b.jpg'), 'avatar.jpg'));
      check('C1 chinh chu doi avatar -> presigned URL', av.status === 200 && /X-Amz-Signature/.test(av.data.avatarUrl || ''), av.status);
      if (av.data && av.data.avatarUrl) {
        // Giu nguyen host cua URL: chu ky SigV4 gom ca host, doi localhost -> 127.0.0.1 se bi 403.
        const img = await fetch(av.data.avatarUrl);
        check('C2 tai duoc avatar qua presigned URL', img.status === 200, img.status);
      }
      const mgrAv = await api('manager', 'PUT', `/users/${kd.data.id}/avatar`, form('avatar', face('person_b.jpg'), 'avatar.jpg'));
      check('C3 Manager doi avatar Employee phong minh', mgrAv.status === 200, mgrAv.status);
      const mgrAvOther = await api('manager', 'PUT', `/users/${kt.data.id}/avatar`, form('avatar', face('person_b.jpg'), 'avatar.jpg'));
      const mgrAvAdmin = await api('manager', 'PUT', `/users/${adminId}/avatar`, form('avatar', face('person_b.jpg'), 'avatar.jpg'));
      const empAvOther = await api('employee', 'PUT', `/users/${kd.data.id}/avatar`, form('avatar', face('person_b.jpg'), 'avatar.jpg'));
      check('C4 Manager->phong khac / Manager->Org Admin / Employee->nguoi khac: 403',
        (otherDept ? mgrAvOther.status === 403 : true) && mgrAvAdmin.status === 403 && empAvOther.status === 403,
        `${mgrAvOther.status}/${mgrAvAdmin.status}/${empAvOther.status}`);
      const bad = await api('employee', 'PUT', '/users/me/avatar', form('avatar', Buffer.from('GIF89a-khong-phai-anh'), 'x.gif'));
      check('C5 avatar khong phai JPEG/PNG/WebP -> 400 AVATAR_INVALID', bad.status === 400 && bad.data.errorCode === 'AVATAR_INVALID', bad.status);
      const delAv = await api('employee', 'DELETE', '/users/me/avatar');
      check('C6 xoa avatar', delAv.status === 200 && delAv.data.avatarUrl === null, delAv.status);
    }

    // ---------------------------------------------------------------- D. anh nhan dien
    if (FIX) {
      const kdTok = (await loginRaw(`a3.kd.${TAG}@demo-sme.vn`, TEST_PASSWORD)).data.accessToken;
      const asKd = (method, p, body) => call(method, p, kdTok, body);
      const put = async (who, userId, file) => {
        for (let i = 0; i < 6; i++) {
          const r = await api(who, 'PUT', `/ml/face/enrollments/${userId}?source=ADMIN`, form('photo', face(file)));
          if (!(r.status === 409 && r.data.errorCode === 'USER_NOT_SYNCED')) return r;
          await sleep(3000);
        }
        return { status: 0, data: {} };
      };
      const up = await put('manager', kd.data.id, 'person_a.jpg');
      check('D1 Manager tai ho Employee phong minh -> ban CHO', up.status === 200 && up.data.status === 'PENDING_CONSENT' && up.data.pending.source === 'MANAGER', `${up.status} ${up.data.errorCode || ''}`);
      if (otherDept) {
        const out = await put('manager', kt.data.id, 'person_b.jpg');
        check('D2 Manager tai ho Employee phong khac -> 403 FACE_OUT_OF_SCOPE', out.status === 403 && out.data.errorCode === 'FACE_OUT_OF_SCOPE', out.status);
      }
      const v0 = await asKd('POST', '/ml/face/verify', form('photo', face('person_a2.jpg')));
      check('D3 ban CHO khong duoc verify', v0.status === 200 && v0.data.enrolled === false, JSON.stringify(v0.data));
      const st = await asKd('GET', '/ml/face/enrollment');
      check('D4 nhan vien thay ban cho (banner)', st.data.status === 'PENDING_CONSENT' && st.data.pending && st.data.pending.actorId === managerClaims.sub);
      const noConsent = await asKd('POST', '/ml/face/enrollment/confirm', {});
      check('D5 xac nhan thieu dong y -> 400 FACE_CONSENT_REQUIRED', noConsent.status === 400 && noConsent.data.errorCode === 'FACE_CONSENT_REQUIRED', noConsent.status);
      const conf = await asKd('POST', '/ml/face/enrollment/confirm', { consentTextVersion: 'face-consent-v1' });
      check('D6 xac nhan -> ACTIVE', conf.status === 200 && conf.data.status === 'ACTIVE', conf.status);
      const v1 = await asKd('POST', '/ml/face/verify', form('photo', face('person_a2.jpg')));
      check('D7 verify sau xac nhan -> khop', v1.data.enrolled === true && v1.data.matched === true, JSON.stringify(v1.data));
      const photo = await api('manager', 'GET', `/ml/face/enrollments/${kd.data.id}/photo`);
      check('D8 proxy anh: image/jpeg + Cache-Control no-store', photo.status === 200 && photo.headers.get('cache-control') === 'no-store' && (photo.headers.get('content-type') || '').startsWith('image/jpeg'), photo.status);
      const views = sql('postgres-ml', `select count(*) from face_enrollment_events where target_user_id = ${q(kd.data.id)} and action = 'VIEW_REF' and actor_id = ${q(managerClaims.sub)};`);
      check('D9 moi luot xem ghi VIEW_REF', Number(views) >= 1, views);
      if (otherDept) {
        const dup = await put('admin', kt.data.id, 'person_a2.jpg');
        check('D10 trung 1:N voi nguoi khac -> 409 FACE_DUPLICATE', dup.status === 409 && dup.data.errorCode === 'FACE_DUPLICATE', `${dup.status} ${dup.data.errorCode}`);
      }
      const insp = await api('admin', 'POST', `/ml/face/inspect?userId=${kt.data.id}`, form('photo', face('person_a2.jpg')));
      check('D11 inspect bao trung, khong luu', insp.status === 200 && insp.data.errorCode === 'FACE_DUPLICATE' && insp.data.duplicateUserId === kd.data.id, JSON.stringify(insp.data));
      const pend2 = await put('admin', kd.data.id, 'person_a2.jpg');
      const rej = await asKd('POST', '/ml/face/enrollment/reject');
      check('D12 tu choi ban cho moi -> giu ban dang dung', pend2.status === 200 && rej.status === 200 && rej.data.status === 'ACTIVE' && rej.data.pending === null, `${pend2.status}/${rej.status}`);
      const blocked = await put('admin', kd.data.id, 'person_a.jpg');
      check('D13 sau khi tu choi, tai ho -> 409 FACE_CONSENT_WITHDRAWN', blocked.status === 409 && blocked.data.errorCode === 'FACE_CONSENT_WITHDRAWN', blocked.status);
      const empPhoto = await api('employee', 'GET', `/ml/face/enrollments/${kd.data.id}/photo`);
      const saPhoto = await api('superadmin', 'GET', `/ml/face/enrollments/${kd.data.id}`);
      check('D14 Employee/Super Admin xem anh nguoi khac -> 403', empPhoto.status === 403 && saPhoto.status === 403, `${empPhoto.status}/${saPhoto.status}`);
      if (otherMgrTok) {
        const om = await call('GET', `/ml/face/enrollments/${kd.data.id}`, otherMgrTok);
        check('D15 Manager phong khac -> 403', om.status === 403, om.status);
      }

      // ---------------------------------------------------------------- E. vong doi
      const keysBefore = sql('postgres-ml', `select count(*) from face_enrollments where user_id = ${q(kd.data.id)};`);
      const deact = await api('admin', 'PATCH', `/users/${kd.data.id}/deactivate`);
      const purged = await waitFor(() => sql('postgres-ml', `select count(*) from face_enrollments where user_id = ${q(kd.data.id)};`) === '0', 30000);
      check('E1 vo hieu hoa -> ml-service xoa ban dang dung', deact.status === 200 && keysBefore === '1' && purged);
      const objects = require('child_process').execFileSync('docker', ['exec', 'minio', 'sh', '-c',
        `mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc ls --recursive "local/ml-face-references/${managerClaims.organizationId}/${kd.data.id}/" | wc -l`]).toString().trim();
      check('E2 object anh nhan dien trong MinIO da bi xoa', objects === '0', objects);
      const consents = sql('postgres-ml', `select count(*) from face_consents where user_id = ${q(kd.data.id)};`);
      check('E3 dong y cung bi xoa (kich hoat lai = NONE)', consents === '0', consents);

      // 26/10/2026: cac loi do kiem thu A4 phat hien.
      const inactivePut = await waitFor(async () => {
        const r = await api('admin', 'PUT', `/ml/face/enrollments/${kd.data.id}?source=ADMIN`, form('photo', face('person_b.jpg')));
        return r.data && r.data.errorCode === 'USER_INACTIVE' ? r : null;
      }, 20000);
      check('F2 tai khoan dang vo hieu hoa -> tai anh ho 409 USER_INACTIVE', Boolean(inactivePut));
      await api('admin', 'PATCH', `/users/${kd.data.id}/reactivate`);
      const kdTok2 = (await loginRaw(`a3.kd.${TAG}@demo-sme.vn`, TEST_PASSWORD)).data.accessToken;
      const after = await waitFor(async () => {
        const r = await call('GET', '/ml/face/enrollment', kdTok2);
        return r.status === 200 ? r : null;
      }, 20000);
      check('F6 kich hoat lai -> goi API duoc ngay (khong con 401 GATEWAY_ACCOUNT_DISABLED)', Boolean(after), after ? after.status : 'timeout');
      check('F2b kich hoat lai -> trang thai anh NONE', after && after.data.status === 'NONE', after && after.data.status);
    }

    // ---------------------------------------------------------------- F. loi phat hien qua kiem thu A4
    const managerRole = roles.find((r) => r.name === 'Manager');
    const noDeptMgr = await api('admin', 'POST', '/users/invite', {
      email: `a3.nodept.${TAG}@demo-sme.vn`, fullName: `A3 NoDept ${TAG}`, initialPassword: TEST_PASSWORD, roleIds: [managerRole.id],
    });
    if (noDeptMgr.data && noDeptMgr.data.id) created.push(noDeptMgr.data.id);
    const noDeptTok = (await loginRaw(`a3.nodept.${TAG}@demo-sme.vn`, TEST_PASSWORD)).data.accessToken;
    const spoof = { 'x-department-id': managerClaims.departmentId, 'X-Permissions': 'user:manage', 'x-org-id': managerClaims.organizationId };
    const spoofDir = await call('GET', '/users/directory', noDeptTok, undefined, spoof);
    const spoofFace = await call('GET', `/ml/face/enrollments/${empId}`, noDeptTok, undefined, spoof);
    const spoofEmp = await api('employee', 'GET', '/users/directory', undefined, spoof);
    check('F1 header noi bo gia mao (x-department-id/x-permissions) bi Gateway xoa -> 403',
      spoofDir.status === 403 && spoofFace.status === 403 && spoofEmp.status === 403, `${spoofDir.status}/${spoofFace.status}/${spoofEmp.status}`);

    const invited = await api('manager', 'POST', '/users/invite', { email: `a3.mgrinv.${TAG}@demo-sme.vn`, fullName: `A3 MgrInv ${TAG}`, initialPassword: TEST_PASSWORD });
    if (invited.data && invited.data.id) created.push(invited.data.id);
    const invTok = (await loginRaw(`a3.mgrinv.${TAG}@demo-sme.vn`, TEST_PASSWORD)).data.accessToken;
    const invClaims = decode(invTok);
    check('F4 nguoi do Manager moi co vai tro Employee + quyen cham cong',
      invClaims.roles.includes('Employee') && invClaims.permissions.includes('attendance:checkin') && invClaims.departmentId === managerClaims.departmentId,
      JSON.stringify(invClaims.roles));

    const wrongPw = await call('PATCH', '/users/me/password', invTok, { currentPassword: 'sai-mat-khau', newPassword: `New-${TAG}-Bb2!` });
    const okPw = await call('PATCH', '/users/me/password', invTok, { currentPassword: TEST_PASSWORD, newPassword: `New-${TAG}-Bb2!` });
    const oldLogin = await loginRaw(`a3.mgrinv.${TAG}@demo-sme.vn`, TEST_PASSWORD);
    const newLogin = await loginRaw(`a3.mgrinv.${TAG}@demo-sme.vn`, `New-${TAG}-Bb2!`);
    check('F5 doi mat khau that: sai mat khau cu 400, dung 200, mat khau moi dang nhap duoc',
      wrongPw.status === 400 && wrongPw.data.errorCode === 'CURRENT_PASSWORD_INVALID' && okPw.status === 200 && oldLogin.status === 401 && newLogin.status === 200,
      `${wrongPw.status}/${okPw.status}/${oldLogin.status}/${newLogin.status}`);

    if (FIX) {
      // JPEG co APP1 Exif chua chuoi GPS chen ngay sau SOI - goi thang API (khong qua canvas cua web).
      const jpeg = face('person_b.jpg');
      const exif = Buffer.from('Exif\0\0GPS-21.0285N-105.8048E', 'latin1');
      const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 0xff]), exif]);
      const gpsJpeg = Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
      const av = await call('PUT', '/users/me/avatar', invTok, form('avatar', gpsJpeg, 'gps.jpg'));
      const stored = av.data && av.data.avatarUrl ? Buffer.from(await (await fetch(av.data.avatarUrl)).arrayBuffer()) : Buffer.alloc(0);
      check('F3 avatar luu tru khong con Exif/GPS', av.status === 200 && stored.length > 0 && !stored.includes(Buffer.from('GPS-21')) && !stored.includes(Buffer.from('Exif')), `${av.status} ${stored.length}B`);
    }
  } catch (e) {
    check('khong co loi ngoai y muon', false, e && e.stack);
  } finally {
    // Don dep
    for (const id of created) {
      await api('admin', 'PATCH', `/users/${id}/deactivate`).catch(() => null);
      await api('admin', 'DELETE', `/users/${id}`).catch(() => null);
    }
    await api('employee', 'PATCH', '/users/me', { phoneNumber: employeeOriginalPhone }).catch(() => null);
    await api('employee', 'DELETE', '/users/me/avatar').catch(() => null);
    await sleep(3000);
    if (created.length) {
      const ids = created.map(q).join(',');
      sql('postgres-ml', `delete from face_enrollment_events where target_user_id in (${ids}); delete from face_consents where user_id in (${ids});`);
      sql('postgres-iam', `delete from user_profile_change_logs where target_user_id in (${ids});`);
    }
    // Employee demo: CHI xoa dau vet sua ho so do chinh kich ban gay ra (khong dung toi hoat dong khac).
    const empId2 = decode(await login('employee')).sub;
    const iso = q(new Date(since).toISOString());
    sql('postgres-iam', `delete from user_profile_change_logs where target_user_id = ${q(empId2)} and created_at >= ${iso};`);
    sql('timescaledb', `delete from fact_user_activity where time >= ${iso} and event_type = 'iam.user.profile_updated' and payload->>'userId' = ${q(empId2)};`);
    const traces = await purgeTraces(created, since);
    console.log(`don dep: ${created.length} tai khoan test, dau vet ${JSON.stringify(traces)}`);
    summary();
  }
})();
