import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// 20/08/2026: rollout i18n (Viet/Anh/Nhat) - import TINH toan bo file JSON (khong dung
// i18next-http-backend fetch dong) vi App.tsx co <Suspense fallback> render TRUOC khi route nao
// mount (man hinh dau tien nguoi dung thay) - i18next PHAI init dong bo, xong truoc ca render dau
// tien, neu khong se nhap nhay/sai ngon ngu dung o dung man hinh dau. Namespace khop 1:1 voi thu
// muc features/* hien co + 'common' (dung chung) + 'errors' (map voi ERROR_CODES backend, xem
// packages/common-dto/src/constants/error-codes.constant.ts).
import commonVi from './locales/vi/common.json';
import authVi from './locales/vi/auth.json';
import dashboardVi from './locales/vi/dashboard.json';
import projectsVi from './locales/vi/projects.json';
import documentsVi from './locales/vi/documents.json';
import crmVi from './locales/vi/crm.json';
import hrmVi from './locales/vi/hrm.json';
import analyticsVi from './locales/vi/analytics.json';
import adminVi from './locales/vi/admin.json';
import notificationsVi from './locales/vi/notifications.json';
import profileVi from './locales/vi/profile.json';
import errorsVi from './locales/vi/errors.json';
// 28/09/2026: Messaging Service (nhan tin noi bo 1:1 va nhom/kenh) - xem features/messaging/.
import messagingVi from './locales/vi/messaging.json';
// 16/09/2026: "Super Admin" (tinh nang moi) - xem features/platform-admin/.
import platformAdminVi from './locales/vi/platformAdmin.json';

import commonEn from './locales/en/common.json';
import authEn from './locales/en/auth.json';
import dashboardEn from './locales/en/dashboard.json';
import projectsEn from './locales/en/projects.json';
import documentsEn from './locales/en/documents.json';
import crmEn from './locales/en/crm.json';
import hrmEn from './locales/en/hrm.json';
import analyticsEn from './locales/en/analytics.json';
import adminEn from './locales/en/admin.json';
import notificationsEn from './locales/en/notifications.json';
import profileEn from './locales/en/profile.json';
import errorsEn from './locales/en/errors.json';
import messagingEn from './locales/en/messaging.json';
import platformAdminEn from './locales/en/platformAdmin.json';

import commonJa from './locales/ja/common.json';
import authJa from './locales/ja/auth.json';
import dashboardJa from './locales/ja/dashboard.json';
import projectsJa from './locales/ja/projects.json';
import documentsJa from './locales/ja/documents.json';
import crmJa from './locales/ja/crm.json';
import hrmJa from './locales/ja/hrm.json';
import analyticsJa from './locales/ja/analytics.json';
import adminJa from './locales/ja/admin.json';
import notificationsJa from './locales/ja/notifications.json';
import profileJa from './locales/ja/profile.json';
import errorsJa from './locales/ja/errors.json';
import messagingJa from './locales/ja/messaging.json';
import platformAdminJa from './locales/ja/platformAdmin.json';

export const SUPPORTED_LANGUAGES = ['vi', 'en', 'ja'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = 'vi';

const resources = {
  vi: {
    common: commonVi,
    auth: authVi,
    dashboard: dashboardVi,
    projects: projectsVi,
    documents: documentsVi,
    crm: crmVi,
    hrm: hrmVi,
    analytics: analyticsVi,
    admin: adminVi,
    notifications: notificationsVi,
    profile: profileVi,
    errors: errorsVi,
    platformAdmin: platformAdminVi,
    messaging: messagingVi,
  },
  en: {
    common: commonEn,
    auth: authEn,
    dashboard: dashboardEn,
    projects: projectsEn,
    documents: documentsEn,
    crm: crmEn,
    hrm: hrmEn,
    analytics: analyticsEn,
    admin: adminEn,
    notifications: notificationsEn,
    profile: profileEn,
    errors: errorsEn,
    platformAdmin: platformAdminEn,
    messaging: messagingEn,
  },
  ja: {
    common: commonJa,
    auth: authJa,
    dashboard: dashboardJa,
    projects: projectsJa,
    documents: documentsJa,
    crm: crmJa,
    hrm: hrmJa,
    analytics: analyticsJa,
    admin: adminJa,
    notifications: notificationsJa,
    profile: profileJa,
    errors: errorsJa,
    platformAdmin: platformAdminJa,
    messaging: messagingJa,
  },
};

void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  ns: Object.keys(resources.vi),
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React da tu escape san, khong can i18next lam lai
  returnEmptyString: false,
});

// 20/08/2026: tham chieu `t` KHONG qua hook, danh cho cac ham/hang so khai bao NGOAI component
// (vi pham Rules of Hooks neu goi useTranslation() o do) - vd
// features/dashboard/components/TaskStatusDonut.tsx. Component thuong dung useTranslation() de
// TU DONG re-render khi doi ngon ngu; cach nay chi phu hop cho helper thuan tuy dung mot lan.
export const t = i18n.t.bind(i18n);

export default i18n;
