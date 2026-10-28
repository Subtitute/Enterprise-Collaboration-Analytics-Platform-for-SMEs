// 25/07/2026: import defineConfig tu 'vitest/config' thay vi 'vite' - day la re-export chinh thuc
// cua vitest, giu nguyen toan bo type cua Vite UserConfig va CHI bo sung them truong `test` (xem
// khoi test ben duoi) - khong doi hanh vi build/dev nao ca, chi cho phep dat cau hinh Vitest CHUNG
// 1 file voi Vite (dung lai alias '@' -> src) thay vi phai tao rieng vitest.config.ts trung lap.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// 28/10/2026: manualChunks doi tu dang object sang dang ham. Rollup dua module VA moi phu thuoc chua co
// chunk cua no vao chunk thu cong - ke ca ham __vitePreload ao cua Vite (jspdf co dynamic import ben
// trong nen phu thuoc helper nay). Ket qua: chunk chinh import helper tu vendor-pdf va index.html
// modulepreload vendor-pdf (~587 kB) + vendor-zip tren MOI trang, ke ca trang dang nhap. Dang ham gan
// tung module theo ten goi trong node_modules (nhu cu) va dat rieng helper vao vendor-react (chunk luon
// tai) -> vendor-pdf chi con tai o trang import lib/pdf-export (Dashboard), khong con o trang dang nhap,
// Tai lieu...
const VENDOR_CHUNKS: Record<string, string[]> = {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-query': ['@tanstack/react-query', 'zustand'],
  'vendor-charts': ['recharts'],
  'vendor-xlsx': ['xlsx'],
  'vendor-pdf': ['jspdf', 'html2canvas'],
  // 27/10/2026: docx-preview (+ jszip) cho xem truoc .docx trong FilePreviewModal - chi duoc
  // import tu chunk lazy preview/DocxPreview nen chunk nay chi tai khi mo tep Word.
  'vendor-docx': ['docx-preview'],
  // 27/10/2026: fflate (giai nen ZIP) dung chung boi jspdf, nhap Excel nhan vien va xem truoc
  // Office - de rieng 1 chunk nho, neu khong Rollup gop no vao vendor-pdf (~600 kB) va mo xem
  // truoc pptx/docx/xlsx se keo theo ca chunk PDF.
  'vendor-zip': ['fflate'],
  'vendor-icons': ['lucide-react'],
};

const CHUNK_OF_PACKAGE = new Map(Object.entries(VENDOR_CHUNKS).flatMap(([chunk, names]) => names.map((name) => [name, chunk] as const)));

function vendorChunk(id: string): string | undefined {
  if (id.includes('vite/preload-helper')) return 'vendor-react';
  const normalized = id.replace(/\\/g, '/');
  const at = normalized.lastIndexOf('/node_modules/');
  if (at === -1) return undefined;
  const [first, second] = normalized.slice(at + '/node_modules/'.length).split('/');
  return CHUNK_OF_PACKAGE.get(first.startsWith('@') ? `${first}/${second}` : first);
}

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
    rollupOptions: {
      output: {
        // 28/10/2026: dang ham, xem VENDOR_CHUNKS o dau file.
        manualChunks: vendorChunk,
      },
    },
    chunkSizeWarningLimit: 600,
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
