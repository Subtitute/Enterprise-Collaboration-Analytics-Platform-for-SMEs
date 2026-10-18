// 16/10/2026: Script seed du lieu demo cho Inventory Service (Danh muc san pham + Kho + "gan mat
// hang cho khach hang" - Technical_Spec.md muc 22). Chay SAU `npm run seed` (script goc, xem
// scripts/seed.js) tren CUNG 1 to chuc demo - KHONG tu tao to chuc moi, chi dang nhap lai qua
// DEMO_ADMIN_EMAIL/DEMO_ADMIN_PASSWORD (giong he main() cua seed.js) roi gan du lieu Inventory vao
// to chuc do, vi buoc 2 ben duoi can lien ket toi cac khach hang CRM THAT da duoc seed.js tao truoc.
//
// Theo yeu cau chu dau an: toan bo du lieu demo cua tinh nang nay dung CHUNG 1 chu de - may tinh va
// linh kien laptop/PC - va moi san pham co 1 anh THAT (nguon royalty-free tren Wikimedia Commons,
// da chuyen sang WebP - xem scripts/seed-assets/products/). Buoc tai anh + chuyen WebP duoc lam
// THU CONG 1 lan (xem bao cao ban giao), KHONG nam trong script nay - script nay chi upload cac
// file .webp co san qua POST /products/:id/image.
//
// Cach chay:  npm run seed:inventory   (tu thu muc goc repo, sau khi da chay npm run seed)
// Yeu cau bien moi truong SEED_API_BASE_URL (mac dinh http://localhost:3000/api/v1), cung bo
// SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD/SEED_ORG_NAME neu to chuc demo da duoc tao voi gia tri khac
// mac dinh (xem seed.js).

const fs = require('fs');
const path = require('path');

const API_BASE_URL = process.env.SEED_API_BASE_URL || 'http://localhost:3000/api/v1';

const DEMO_ORG_NAME = process.env.SEED_ORG_NAME || 'Demo SME (Seed Script)';
const DEMO_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@demo-sme.vn';
const DEMO_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Password123!';

const IMAGE_DIR = path.join(__dirname, 'seed-assets', 'products');
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mirror CHINH XAC fetchWithRetry()/apiCall()/uploadFile() cua scripts/seed.js - xem chu thich goc
// o do ve ly do can cho+thu lai khi gap 429 (Gateway rate-limit 100 request/60s theo org+IP).
async function fetchWithRetry(url, options) {
  const maxRetries = 8;
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, options);
    if (res.status !== 429 || attempt >= maxRetries) return res;
    const delayMs = Math.min(2000 * (attempt + 1), 15000);
    console.warn(`  (429 - Gateway rate-limit, doi ${Math.round(delayMs / 1000)}s roi thu lai - lan ${attempt + 1}/${maxRetries})`);
    await sleep(delayMs);
  }
}

async function apiCall(path_, options = {}) {
  const res = await fetchWithRetry(`${API_BASE_URL}${path_}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(`${options.method || 'GET'} ${path_} -> ${res.status}: ${JSON.stringify(body)}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

/**
 * Upload multipart/form-data cho anh san pham - KHONG dat header Content-Type thu cong (khac
 * apiCall()): global fetch/FormData/Blob cua Node 20 tu sinh boundary dung chuan.
 */
async function uploadProductImage(productId, filePath) {
  const formData = new FormData();
  const blob = new Blob([fs.readFileSync(filePath)], { type: 'image/webp' });
  formData.append('file', blob, path.basename(filePath));
  const res = await fetchWithRetry(`${API_BASE_URL}/products/${productId}/image`, {
    method: 'POST',
    headers: authHeadersGlobal,
    body: formData,
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`POST /products/${productId}/image (upload) -> ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomTimestampInRange(startMs, endMs) {
  return new Date(startMs + Math.random() * (endMs - startMs));
}

// ==========================================================================================
// Du lieu demo - CHUNG 1 chu de "may tinh va linh kien laptop, PC" theo yeu cau chu dau an.
// ==========================================================================================

const CATEGORIES = [
  { name: 'Laptop', description: 'May tinh xach tay tu van phong den gaming/do hoa' },
  { name: 'PC để bàn', description: 'May tinh de ban nguyen bo, van phong va gaming' },
  { name: 'Linh kiện PC', description: 'CPU, RAM, SSD, card do hoa, bo mach chu, nguon, case, tan nhiet' },
  { name: 'Màn hình', description: 'Man hinh may tinh van phong va gaming' },
  { name: 'Phụ kiện', description: 'Ban phim, chuot, tai nghe va phu kien may tinh' },
];

// 16/10/2026: 19 san pham, moi san pham 1 anh WebP that (xem scripts/seed-assets/products/) -
// unitPrice la gia thi truong Viet Nam THAM KHAO (VND), khong phai gia niem yet chinh thuc.
const PRODUCTS = [
  // --- Laptop ---
  {
    category: 'Laptop',
    name: 'Laptop Dell XPS M1330',
    sku: 'LAP-DELL-XPSM1330',
    unitPrice: 18900000,
    description: 'Dong XPS mong nhe, vo nhom, phu hop van phong di dong',
    image: 'laptop-dell-xps-m1330.webp',
  },
  {
    category: 'Laptop',
    name: 'Laptop Lenovo ThinkPad T460',
    sku: 'LAP-LENOVO-T460',
    unitPrice: 14900000,
    description: 'Dong ThinkPad ben bi, ban phim go tot, huong doanh nhan',
    image: 'laptop-lenovo-thinkpad-t460.webp',
  },
  {
    category: 'Laptop',
    name: 'Laptop HP Envy 14',
    sku: 'LAP-HP-ENVY14',
    unitPrice: 26900000,
    description: 'Intel Core i7 + NVIDIA GeForce GTX, man hinh 14 inch vien mong',
    image: 'laptop-hp-envy-14.webp',
  },
  // --- PC để bàn ---
  {
    category: 'PC để bàn',
    name: 'PC Gaming Fractal Design TUF Edition',
    sku: 'PC-GAMING-FRACTAL-TUF',
    unitPrice: 24500000,
    description: 'Case Fractal Design kinh cuong luc, GPU GeForce GTX, tan nhiet RGB',
    image: 'pc-gaming-fractal-tuf.webp',
  },
  {
    category: 'PC để bàn',
    name: 'PC Văn phòng Dell OptiPlex 9020',
    sku: 'PC-OFFICE-OPTIPLEX9020',
    unitPrice: 8900000,
    description: 'May bo van phong, nho gon, on dinh cho tac vu hanh chinh',
    image: 'pc-office-dell-optiplex-9020.webp',
  },
  // --- Linh kiện PC ---
  {
    category: 'Linh kiện PC',
    name: 'CPU Intel Core i9-9900K',
    sku: 'CPU-INTEL-I9-9900K',
    unitPrice: 7200000,
    description: '8 nhan 16 luong, socket LGA1151, hieu nang cao cho gaming/dung lieu',
    image: 'cpu-intel-core-i9-9900k.webp',
  },
  {
    category: 'Linh kiện PC',
    name: 'CPU AMD Ryzen 9 3900X',
    sku: 'CPU-AMD-R9-3900X',
    unitPrice: 6500000,
    description: '12 nhan 24 luong, socket AM4, manh cho da nhiem va render',
    image: 'cpu-amd-ryzen-9-3900x.webp',
  },
  {
    category: 'Linh kiện PC',
    name: 'RAM Laptop Kingston HyperX SO-DIMM (Kit 2x4GB)',
    sku: 'RAM-KINGSTON-HYPERX-SODIMM',
    unitPrice: 650000,
    description: 'Bo nho SO-DIMM cho laptop, bao hanh tron doi',
    image: 'ram-kingston-hyperx-sodimm.webp',
  },
  {
    category: 'Linh kiện PC',
    name: 'SSD Samsung 870 QVO 8TB',
    sku: 'SSD-SAMSUNG-870QVO-8TB',
    unitPrice: 14900000,
    description: 'O cung SSD SATA dung luong lon, chuan 2.5 inch',
    image: 'ssd-samsung-870qvo-8tb.webp',
  },
  {
    category: 'Linh kiện PC',
    name: 'Card đồ họa MSI GeForce RTX 3070 Ventus 3X OC',
    sku: 'GPU-MSI-RTX3070-VENTUS3X',
    unitPrice: 13900000,
    description: '3 quat tan nhiet, phu hop gaming 1440p va dung do hoa',
    image: 'gpu-msi-rtx3070-ventus3x.webp',
  },
  {
    category: 'Linh kiện PC',
    name: 'Bo mạch chủ ASUS ROG Strix Z390-F Gaming',
    sku: 'MB-ASUS-ROG-STRIXZ390F',
    unitPrice: 4500000,
    description: 'Chipset Z390, socket LGA1151, ho tro overclock',
    image: 'mainboard-asus-rog-strix-z390f.webp',
  },
  {
    category: 'Linh kiện PC',
    name: 'Nguồn máy tính OCZ 600W',
    sku: 'PSU-OCZ-600W',
    unitPrice: 1850000,
    description: 'Cong suat 600W, chuan 80 Plus',
    image: 'psu-ocz-600w.webp',
  },
  {
    category: 'Linh kiện PC',
    name: 'Case Gaming ATX',
    sku: 'CASE-ATX-GAMING',
    unitPrice: 2100000,
    description: 'Vo may ATX, nhieu khe cam mo rong, luu thong khi tot',
    image: 'case-atx-gaming.webp',
  },
  {
    category: 'Linh kiện PC',
    name: 'Tản nhiệt khí Arctic Freezer 13',
    sku: 'COOLER-ARCTIC-FREEZER13',
    unitPrice: 450000,
    description: 'Tan nhiet khi 4 ong dong, van hanh em',
    image: 'cooler-arctic-freezer13.webp',
  },
  // --- Màn hình ---
  {
    category: 'Màn hình',
    name: 'Màn hình Gaming cong BenQ',
    sku: 'MON-BENQ-CURVEDGAMING',
    unitPrice: 7900000,
    description: 'Man hinh cong, tan so quet cao, phu hop gaming',
    image: 'monitor-benq-curved-gaming.webp',
  },
  {
    category: 'Màn hình',
    name: 'Màn hình Samsung SyncMaster 940B',
    sku: 'MON-SAMSUNG-SYNCMASTER940B',
    unitPrice: 1990000,
    description: 'Man hinh van phong 19 inch, gia tot',
    image: 'monitor-samsung-syncmaster940b.webp',
  },
  // --- Phụ kiện ---
  {
    category: 'Phụ kiện',
    name: 'Bàn phím cơ Keychron K4',
    sku: 'KB-KEYCHRON-K4',
    unitPrice: 1890000,
    description: 'Ban phim co 96%, den nen RGB, ho tro Bluetooth',
    image: 'keyboard-keychron-k4.webp',
  },
  {
    category: 'Phụ kiện',
    name: 'Chuột không dây ProtoArc',
    sku: 'MOUSE-PROTOARC-WIRELESS',
    unitPrice: 450000,
    description: 'Chuot khong day, thiet ke cong thai hoc',
    image: 'mouse-protoarc-wireless.webp',
  },
  {
    category: 'Phụ kiện',
    name: 'Tai nghe Creative Sound BlasterX H5',
    sku: 'HEADSET-CREATIVE-SBX-H5',
    unitPrice: 1450000,
    description: 'Tai nghe gaming co mic, am thanh chi tiet',
    image: 'headset-creative-soundblasterx-h5.webp',
  },
];

const WAREHOUSES = [
  { name: 'Kho Hà Nội', address: 'Khu cong nghiep Quang Minh, Ha Noi' },
  { name: 'Kho Hồ Chí Minh', address: 'Khu cong nghiep Tan Binh, TP. Ho Chi Minh' },
];

// 16/10/2026: danh dau vai SKU "ban chay" - dung de gan trong so cao hon khi chon san pham cho
// buoc seed customer-purchases ben duoi, de bieu do xu huong (market-trend-analysis) co du lieu
// "mot vai mat hang ban chay hon han" thay vi phang deu tren ca 19 san pham.
const POPULAR_SKUS = new Set([
  'SSD-SAMSUNG-870QVO-8TB',
  'RAM-KINGSTON-HYPERX-SODIMM',
  'MOUSE-PROTOARC-WIRELESS',
  'KB-KEYCHRON-K4',
  'HEADSET-CREATIVE-SBX-H5',
  'CPU-AMD-R9-3900X',
]);

const CUSTOMER_PURCHASE_COUNT = 26;

let authHeadersGlobal = null;

async function main() {
  console.log(`Seeding Inventory vao ${API_BASE_URL} ...`);

  // --- Buoc 1: dang nhap lai vao to chuc demo da duoc `npm run seed` tao san (KHONG tao to chuc
  // moi) - mirror CHINH XAC pattern register-or-login cua main() trong scripts/seed.js. ---
  let auth;
  try {
    auth = await apiCall('/auth/register-organization', {
      method: 'POST',
      body: JSON.stringify({
        organizationName: DEMO_ORG_NAME,
        adminFullName: 'Quan Tri Vien Demo',
        adminEmail: DEMO_ADMIN_EMAIL,
        adminPassword: DEMO_ADMIN_PASSWORD,
      }),
    });
    console.log(`Da tao to chuc moi "${auth.organization.name}" (chua chay seed.js truoc do?) - Org Admin: ${DEMO_ADMIN_EMAIL}`);
  } catch (err) {
    if (err.status !== 409) throw err;
    const loginRes = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: DEMO_ADMIN_EMAIL, password: DEMO_ADMIN_PASSWORD }),
    });
    auth = { accessToken: loginRes.accessToken, user: loginRes.user };
    console.log(`Da dang nhap lai to chuc demo hien co - Org Admin: ${DEMO_ADMIN_EMAIL}`);
  }
  const authHeaders = { Authorization: `Bearer ${auth.accessToken}` };
  authHeadersGlobal = authHeaders;

  // --- Buoc 2: lay danh sach khach hang THAT da duoc seed.js tao (de gan customer-purchases) ---
  const customersRes = await apiCall('/customers?limit=100', { headers: authHeaders });
  const customers = customersRes.data || [];
  if (customers.length === 0) {
    console.log('Khong tim thay khach hang nao (chay `npm run seed` truoc) - se BO QUA buoc seed customer-purchases.');
  } else {
    console.log(`Tim thay ${customers.length} khach hang hien co de gan giao dich.`);
  }

  // --- Buoc 3: danh muc san pham - idempotent theo TEN (mirror pattern departments cua seed.js:
  // tai su dung danh muc da ton tai thay vi tao trung lap moi lan chay lai script). ---
  const existingCategoriesRes = await apiCall('/product-categories?limit=500', { headers: authHeaders });
  const categoryByName = new Map((existingCategoriesRes.data || []).map((c) => [c.name, c]));
  let newCategoryCount = 0;
  for (const cat of CATEGORIES) {
    if (categoryByName.has(cat.name)) continue;
    const created = await apiCall('/product-categories', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(cat),
    });
    categoryByName.set(cat.name, created);
    newCategoryCount += 1;
  }
  console.log(`Danh muc san pham: ${newCategoryCount} moi tao, ${categoryByName.size - newCategoryCount} da co san (tai su dung).`);

  // --- Buoc 4+5: san pham + anh WebP - idempotent theo SKU (SKU la UNIQUE o tang service, xem
  // ProductsService.assertSkuAvailable() - POST trung SKU se tra ve 409). Tai su dung san pham da
  // co san thay vi POST lai (tranh 409 khong can thiet khi chay lai script). ---
  const existingProductsRes = await apiCall('/products?limit=500', { headers: authHeaders });
  const productBySku = new Map((existingProductsRes.data || []).map((p) => [p.sku, p]));

  // 16/10/2026: danh sach san pham THAT SU dung duoc cho cac buoc sau (stock-movements, customer-
  // purchases) - CHI chua san pham da tao/tai su dung THANH CONG, khong gia dinh 1 vi tri co dinh
  // nao trong mang ung voi 1 vi tri trong PRODUCTS (POST co the that bai vi ly do phat hien duoc).
  const usableProducts = [];
  let newProductCount = 0;
  let uploadedImageCount = 0;
  let failedImageCount = 0;

  for (const spec of PRODUCTS) {
    const category = categoryByName.get(spec.category);
    if (!category) {
      console.warn(`Bo qua san pham "${spec.name}": khong tim thay danh muc "${spec.category}".`);
      continue;
    }

    let product = productBySku.get(spec.sku);
    if (!product) {
      try {
        product = await apiCall('/products', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            categoryId: category.id,
            name: spec.name,
            sku: spec.sku,
            description: spec.description,
            unitPrice: spec.unitPrice,
          }),
        });
        productBySku.set(spec.sku, product);
        newProductCount += 1;
      } catch (err) {
        // SKU trung (409) du da kiem tra truoc - truong hop hiem (vd script khac dang chay song
        // song) - bo qua san pham nay thay vi lam hong ca script, mirror tinh than "khong gia dinh"
        // o chu thich dau vong lap.
        console.warn(`Bo qua san pham "${spec.name}" (SKU ${spec.sku}): ${err.message}`);
        continue;
      }
    }

    usableProducts.push({ ...spec, id: product.id });

    // Luon thu tai anh (idempotent theo y nghia: setImage() thay the anh cu, khong tao trung) -
    // xem ProductsService.setImage() apps/inventory-service.
    const imagePath = path.join(IMAGE_DIR, spec.image);
    try {
      await uploadProductImage(product.id, imagePath);
      uploadedImageCount += 1;
    } catch (err) {
      failedImageCount += 1;
      console.warn(`Loi tai anh cho san pham "${spec.name}": ${err.message}`);
    }
  }
  console.log(
    `San pham: ${newProductCount} moi tao, ${usableProducts.length - newProductCount} da co san (tai su dung). ` +
      `Anh: ${uploadedImageCount} tai thanh cong${failedImageCount > 0 ? `, ${failedImageCount} loi` : ''}.`,
  );

  // --- Buoc 6: kho - idempotent theo TEN (cung pattern danh muc o tren). ---
  const existingWarehousesRes = await apiCall('/warehouses?limit=500', { headers: authHeaders });
  const warehouseByName = new Map((existingWarehousesRes.data || []).map((w) => [w.name, w]));
  let newWarehouseCount = 0;
  for (const wh of WAREHOUSES) {
    if (warehouseByName.has(wh.name)) continue;
    const created = await apiCall('/warehouses', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(wh),
    });
    warehouseByName.set(wh.name, created);
    newWarehouseCount += 1;
  }
  const warehouses = [...warehouseByName.values()];
  console.log(`Kho: ${newWarehouseCount} moi tao, ${warehouses.length - newWarehouseCount} da co san (tai su dung).`);

  // --- Buoc 7: bien dong kho (nhap kho ban dau) cho MOI san pham usable tai MOI kho - day la cach
  // DUY NHAT de co ton kho > 0 (khong co endpoint "set ton kho truc tiep" - xem CreateStockMovementDto). ---
  let movementCount = 0;
  for (const product of usableProducts) {
    for (const warehouse of warehouses) {
      try {
        await apiCall('/stock-movements', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            warehouseId: warehouse.id,
            productId: product.id,
            type: 'IN',
            quantityDelta: randomInt(20, 100),
            note: 'Nhập kho ban đầu (seed)',
          }),
        });
        movementCount += 1;
      } catch (err) {
        console.warn(`Loi ghi bien dong kho cho "${product.name}" tai "${warehouse.name}": ${err.message}`);
      }
    }
  }
  console.log(`Da ghi ${movementCount} bien dong nhap kho (${usableProducts.length} san pham x ${warehouses.length} kho).`);

  // --- Buoc 8: customer-purchases - nguon du lieu CHINH cho market-trend-analysis. Trai deu
  // ~30 ngay gan day (khong dung 1 ngay) va thien lech nhe ve POPULAR_SKUS de bieu do xu huong co
  // "mot vai mat hang ban chay hon" thay vi phang deu - mirror tinh than weightedByDept()/
  // biasedProbability() cua scripts/seed.js (thien lech co chu dich, khong qua hoan hao/de nhan
  // la gia mao vi van la random trong 1 khoang). ---
  let purchaseCount = 0;
  if (customers.length > 0 && usableProducts.length > 0) {
    const weightedProducts = [];
    for (const p of usableProducts) {
      const copies = POPULAR_SKUS.has(p.sku) ? 3 : 1;
      for (let i = 0; i < copies; i += 1) weightedProducts.push(p);
    }

    const now = Date.now();
    for (let i = 0; i < CUSTOMER_PURCHASE_COUNT; i += 1) {
      const customer = randomFrom(customers);
      const product = randomFrom(weightedProducts);
      const purchasedAt = randomTimestampInRange(now - 30 * MS_PER_DAY, now).toISOString();
      // ~50% giao dich co warehouseId (THAT SU tru kho) - nua con lai de TRONG co chu dich (chi
      // ghi nhan cho phan tich xu huong, khong cham vao ton kho) - xem chu thich CreateCustomerPurchaseDto.
      const warehouseId = Math.random() < 0.5 ? randomFrom(warehouses).id : undefined;

      try {
        await apiCall('/customer-purchases', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            customerId: customer.id,
            productId: product.id,
            warehouseId,
            quantity: randomInt(1, 5),
            purchasedAt,
            note: 'Giao dich demo (seed)',
          }),
        });
        purchaseCount += 1;
      } catch (err) {
        // Pham vi hiem: khong du ton kho tai dung kho/san pham do (StockService.recordMovementInTransaction
        // kiem tra am) - bo qua giao dich nay thay vi lam hong ca script.
        console.warn(`Bo qua 1 giao dich khach hang: ${err.message}`);
      }
    }
  } else {
    console.log('Bo qua buoc seed customer-purchases (khong co khach hang hoac khong co san pham dung duoc).');
  }

  console.log('\n=== Seed Inventory hoan tat (qua API cong khai) ===');
  console.log(
    `Tong: ${categoryByName.size} danh muc, ${usableProducts.length} san pham (${uploadedImageCount} co anh), ` +
      `${warehouses.length} kho, ${movementCount} bien dong nhap kho, ${purchaseCount} giao dich khach hang.`,
  );
}

main().catch((err) => {
  console.error('Seed Inventory that bai:', err.message);
  process.exit(1);
});
