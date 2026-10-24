// 24/10/2026: kich ban 05 - CRM (khach hang, co hoi ban hang) va Kho (danh muc, san pham, kho,
// nhap/xuat kho, giao dich mua hang cua khach). Manager tao khach hang roi giao cho Employee phu
// trach; Employee tao deal + ghi nhan giao dich cho khach cua minh. Don dep: xoa giao dich, deal,
// khach hang, san pham, danh muc, kho qua API; so cai nhap/xuat kho (khong co API xoa, co chu dich)
// va ton kho cua kho kiem thu duoc xoa thang trong postgres-inventory truoc khi xoa kho/san pham.
const { api, decode, login, list, check, summary, sql, q, purgeTraces, sleep } = require('./lib');
const TAG = `MOCK-${Date.now().toString(36)}`;

(async () => {
  const since = Date.now();
  const C = {};
  try {
    const empId = decode(await login('employee')).sub;
    // 1. CRM
    check('Employee tao khach hang -> 403', (await api('employee', 'POST', '/customers', { name: TAG })).status === 403);
    const cu = await api('manager', 'POST', '/customers', { name: `Công ty ${TAG}`, email: `${TAG.toLowerCase()}@khach.vn`, phone: '0901234567', company: 'Khách thử nghiệm' });
    C.customer = cu.data && cu.data.id;
    check('Manager tao khach hang', cu.status === 201, cu.status);
    check('giao khach hang cho Employee phu trach', (await api('manager', 'PATCH', `/customers/${C.customer}`, { ownerUserId: empId })).status === 200);
    const de = await api('employee', 'POST', '/deals', { customerId: C.customer, title: `Hợp đồng ${TAG}`, value: 150000000 });
    C.deal = de.data && de.data.id;
    check('Employee tao deal cho khach cua minh', de.status === 201 && de.data.stage === 'NEW', `${de.status} ${de.data && de.data.stage}`);
    const st = await api('employee', 'PATCH', `/deals/${C.deal}/stage`, { stage: 'PROPOSAL' });
    check('Employee chuyen giai doan deal', st.status === 200 && st.data.stage === 'PROPOSAL', st.status);
    check('giai doan khong hop le -> 400', (await api('employee', 'PATCH', `/deals/${C.deal}/stage`, { stage: 'XYZ' })).status === 400);
    check('Employee xoa deal -> 403', (await api('employee', 'DELETE', `/deals/${C.deal}`)).status === 403);
    const won = await api('manager', 'PATCH', `/deals/${C.deal}/stage`, { stage: 'WON' });
    check('Manager chot deal WON', won.status === 200, won.status);
    const custs = list((await api('employee', 'GET', '/customers?limit=100')).data);
    check('Employee xem danh sach khach hang', custs.some((x) => x.id === C.customer), `n=${custs.length}`);

    // 2. Kho
    check('Employee tao san pham -> 403', (await api('employee', 'POST', '/product-categories', { name: TAG })).status === 403);
    const cat = await api('manager', 'POST', '/product-categories', { name: `Danh mục ${TAG}` });
    C.category = cat.data && cat.data.id;
    check('Manager tao danh muc', cat.status === 201, cat.status);
    const pr = await api('manager', 'POST', '/products', { categoryId: C.category, name: `Sản phẩm ${TAG}`, sku: `SKU-${TAG}`, unitPrice: 250000 });
    C.product = pr.data && pr.data.id;
    check('Manager tao san pham', pr.status === 201, pr.status);
    check('SKU trung -> 409', (await api('manager', 'POST', '/products', { categoryId: C.category, name: 'x', sku: `SKU-${TAG}` })).status === 409);
    const wh = await api('manager', 'POST', '/warehouses', { name: `Kho ${TAG}`, address: 'KCN Sóng Thần' });
    C.warehouse = wh.data && wh.data.id;
    check('Manager tao kho', wh.status === 201, wh.status);
    const mvIn = await api('manager', 'POST', '/stock-movements', { warehouseId: C.warehouse, productId: C.product, type: 'IN', quantityDelta: 20, note: TAG });
    check('nhap kho 20', mvIn.status === 201, `${mvIn.status} ${JSON.stringify(mvIn.data).slice(0, 120)}`);
    const over = await api('manager', 'POST', '/stock-movements', { warehouseId: C.warehouse, productId: C.product, type: 'OUT', quantityDelta: -999, note: TAG });
    check('xuat qua ton kho -> 4xx', over.status >= 400 && over.status < 500, over.status);
    const stock = await api('employee', 'GET', `/stock?warehouseId=${C.warehouse}`);
    check('Employee xem ton kho = 20', stock.status === 200 && JSON.stringify(stock.data).includes('20'), `${stock.status} ${JSON.stringify(stock.data).slice(0, 150)}`);
    const pu = await api('employee', 'POST', '/customer-purchases', { customerId: C.customer, productId: C.product, warehouseId: C.warehouse, quantity: 3, purchasedAt: new Date().toISOString(), note: TAG });
    C.purchase = pu.data && pu.data.id;
    check('Employee ghi nhan giao dich mua hang (tru kho)', pu.status === 201, `${pu.status} ${JSON.stringify(pu.data).slice(0, 120)}`);
    const stock2 = await api('manager', 'GET', `/stock?warehouseId=${C.warehouse}`);
    check('ton kho con 17 sau giao dich', JSON.stringify(stock2.data).includes('17'), JSON.stringify(stock2.data).slice(0, 150));
    check('Employee xoa giao dich -> 403', (await api('employee', 'DELETE', `/customer-purchases/${C.purchase}`)).status === 403);
    const mv = await api('manager', 'GET', `/stock-movements?warehouseId=${C.warehouse}`);
    check('lich su nhap/xuat kho', mv.status === 200 && list(mv.data).length >= 1, `n=${list(mv.data).length}`);
  } catch (e) {
    check('ngoai le', false, e.stack);
  } finally {
    const del = async (label, who, path) => {
      const r = await api(who, 'DELETE', path);
      check(`don dep: ${label}`, r.status < 300 || r.status === 404, `${r.status} ${r.status >= 300 ? JSON.stringify(r.data).slice(0, 120) : ''}`);
    };
    if (C.purchase) await del('xoa giao dich', 'manager', `/customer-purchases/${C.purchase}`);
    if (C.deal) await del('xoa deal', 'manager', `/deals/${C.deal}`);
    if (C.customer) await del('xoa khach hang', 'manager', `/customers/${C.customer}`);
    if (C.warehouse) {
      await sleep(500);
      sql('postgres-inventory', `delete from stock_movements where warehouse_id = ${q(C.warehouse)}; delete from warehouse_stocks where warehouse_id = ${q(C.warehouse)};`);
    }
    if (C.product) await del('xoa san pham', 'manager', `/products/${C.product}`);
    if (C.category) await del('xoa danh muc', 'manager', `/product-categories/${C.category}`);
    if (C.warehouse) await del('xoa kho', 'manager', `/warehouses/${C.warehouse}`);
    for (const id of Object.values(C).filter(Boolean)) sql('postgres-inventory', `delete from outbox_events where payload::text like ${q('%' + id + '%')};`);
    console.log(`don dep su kien: ${JSON.stringify(await purgeTraces(Object.values(C), since))}`);
    summary();
  }
})();
