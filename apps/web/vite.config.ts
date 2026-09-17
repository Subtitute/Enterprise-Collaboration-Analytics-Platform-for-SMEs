// 25/07/2026: import defineConfig tu 'vitest/config' thay vi 'vite' - day la re-export chinh thuc
// cua vitest, giu nguyen toan bo type cua Vite UserConfig va CHI bo sung them truong `test` (xem
// khoi test ben duoi) - khong doi hanh vi build/dev nao ca, chi cho phep dat cau hinh Vitest CHUNG
// 1 file voi Vite (dung lai alias '@' -> src) thay vi phai tao rieng vitest.config.ts trung lap.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Vite dev-server proxy mirrors the production Nginx reverse-proxy: the browser only ever
// talks to a single origin. All REST calls go to /api/v1/*, all WebSocket calls go to /ws/*,
// both forwarded here to the Gateway service (published on the host per infra/docker-compose.yml).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    commonjsOptions: {
      // 17/09/2026: '@app/common-dto' trong node_modules la Windows junction/symlink tro ve
      // 'packages/common-dto' (npm workspaces) - Rollup mac dinh resolve symlink ve duong dan
      // THAT truoc khi build, nen id module khong con chua chuoi "node_modules" nua. Vite mac
      // dinh chi bat @rollup/plugin-commonjs transform CJS->ESM cho id khop /node_modules/, nen
      // file bien dich CJS cua common-dto (vd dist/enums/permission.enum.js voi "exports.X = ...")
      // bi bo qua transform va nhet THO vao bundle ESM production -> "ReferenceError: exports is
      // not defined" luc chay tren trinh duyet (khong co bien global `exports`). Loi CHI xuat hien
      // sau khi build that (npm run build), khong xuat hien o dev server (esbuild optimizeDeps xu
      // ly khac) - vi vay khong bi phat hien qua cac lan chay `npm run dev` truoc do. Mo rong
      // include de bat ca duong dan that cua goi trong thu muc packages/ (khong chi node_modules/).
      include: [/node_modules/, /packages\//],
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, _res) => {
            // Dập tắt log socket hang up do backend gateway hoặc client refresh/reconnect
          });
        },
      },
    },
  },
  // 25/07/2026: khoi cau hinh Vitest - truoc ban sua nay frontend khong co bat ky test runner nao
  // (khong co test script, khong co @testing-library/*). environment: 'jsdom' de mo phong DOM/
  // window.matchMedia/localStorage can cho cac test component + hook (Dropdown, useGlobalSearch,
  // useSidebarAutoCollapse...). setupFiles nap jest-dom matcher (toBeInTheDocument()...) truoc moi
  // file test. globals: true de dung describe/it/expect ma khong can import thu cong o moi file.
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // 22/08/2026: bat bao cao coverage (chi de XEM SO LIEU qua `vitest run --coverage`, dung
    // '@vitest/coverage-v8' moi them) - CO Y KHONG dat `thresholds` nhu 8 service backend
    // (packages/*/package.json, apps/*-service/package.json) da lam. Ly do: coverage thuc te cua
    // frontend hien tai qua thap (5 file test / ~117 file nguon, tap trung o UI primitive, chua
    // dong nao trong `features/*`) - dat 1 nguong o muc do se khong that su chan duoc gi (vd 5%),
    // con dat cao hon se lam CI do ngay lap tuc du khong co thay doi hanh vi nao. Quyet dinh: hien
    // so lieu that trong CI de theo doi xu huong, chi bat `thresholds` khi da co 1 dot viet them
    // test rieng cho `features/*` (van con la hang muc mo, xem Doc/Technical_Spec.md).
    coverage: {
      provider: 'v8',
      reporter: ['text-summary'],
    },
  },
});
