// 25/07/2026: file setup cho Vitest (khai bao trong vite.config.ts -> test.setupFiles) - nap
// @testing-library/jest-dom de co cac matcher nhu toBeInTheDocument()/toHaveTextContent() dung
// trong cac file test moi them (KpiCard, Dropdown...). Chay truoc MOI file test.
import '@testing-library/jest-dom/vitest';
// 20/08/2026: nap i18next TRUOC moi file test (rollout i18n) - component duoi test bat dau goi
// useTranslation(), thieu buoc nay se lam t() tra ve raw key hoac nem loi thay vi chuoi tieng
// Viet that (vd KpiCard.test.tsx assert `screen.getByText('Lỗi tải dữ liệu')`).
import '@/i18n';
