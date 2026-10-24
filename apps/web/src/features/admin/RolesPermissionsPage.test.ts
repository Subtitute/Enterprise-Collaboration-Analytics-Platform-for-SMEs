// 24/10/2026: test moi - dam bao MOI quyen khai bao trong packages/common-dto (nguon chuan cua IAM
// seed) deu co muc trong PERMISSION_META (nhom module + nhan) va co nhan dich o ca 3 ngon ngu.
// Truoc day map nay hard-code va bi bo sot 20 quyen ra doi sau (chatbot:use, ml:view, Kho, Nhan
// tin...) khien chung hien o nhom 'Khac' voi nhan la key ky thuat.
import { describe, it, expect } from 'vitest';
import { PERMISSIONS } from '../../../../../packages/common-dto/src/enums/permission.enum';
import vi from '@/i18n/locales/vi/admin.json';
import en from '@/i18n/locales/en/admin.json';
import ja from '@/i18n/locales/ja/admin.json';
import { PERMISSION_META } from './RolesPermissionsPage';

const ALL_KEYS = Object.values(PERMISSIONS) as string[];

describe('RolesPermissionsPage - PERMISSION_META', () => {
  it('co muc cho moi quyen trong PERMISSIONS (common-dto)', () => {
    const missing = ALL_KEYS.filter((k) => !PERMISSION_META[k]);
    expect(missing).toEqual([]);
  });

  it.each([
    ['vi', vi],
    ['en', en],
    ['ja', ja],
  ])('locale %s co nhan cho moi quyen va moi nhom module', (_lang, dict) => {
    const page = (dict as { rolesPermissionsPage: { permissions: Record<string, string>; groups: Record<string, string> } })
      .rolesPermissionsPage;
    const missingLabels = ALL_KEYS.filter((k) => !page.permissions[k.replace(':', '_')]);
    const missingGroups = [...new Set(Object.values(PERMISSION_META).map((m) => m.moduleKey))].filter((g) => !page.groups[g]);
    expect(missingLabels).toEqual([]);
    expect(missingGroups).toEqual([]);
  });
});
