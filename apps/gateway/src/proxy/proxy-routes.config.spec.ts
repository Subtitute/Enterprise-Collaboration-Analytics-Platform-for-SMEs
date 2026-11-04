import { REST_PROXY_ROUTES } from './proxy-routes.config';

/** 04/11/2026: danh sach prefix cap nhat thu cong, thieu 1 prefix thi Gateway tra 404 du service da co route. */
describe('REST_PROXY_ROUTES', () => {
  it('dinh tuyen timesheets va work-calendar toi hrm-service', () => {
    const hrm = REST_PROXY_ROUTES.find((group) => group.targetConfigKey === 'services.hrm');
    expect(hrm?.prefixes).toEqual(expect.arrayContaining(['/api/v1/timesheets', '/api/v1/work-calendar']));
  });
});
