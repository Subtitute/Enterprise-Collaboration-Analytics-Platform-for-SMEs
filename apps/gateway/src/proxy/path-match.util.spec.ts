import { matchesPrefix } from './path-match.util';

describe('matchesPrefix', () => {
  const prefixes = ['/api/v1/projects', '/api/v1/tasks'];

  it('khop chinh xac tien to', () => {
    expect(matchesPrefix('/api/v1/projects', prefixes)).toBe(true);
  });

  it('khop khi co doan con phia sau tien to', () => {
    expect(matchesPrefix('/api/v1/tasks/123/comments', prefixes)).toBe(true);
  });

  it('khong khop khi chi la tien to chung khong co dau /', () => {
    expect(matchesPrefix('/api/v1/projectsx', prefixes)).toBe(false);
  });

  it('khong khop duong dan hoan toan khac', () => {
    expect(matchesPrefix('/api/v1/notifications', prefixes)).toBe(false);
  });
});
