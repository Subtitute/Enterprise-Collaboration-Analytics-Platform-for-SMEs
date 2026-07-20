/**
 * Khop duong dan theo tien to (prefix), vd '/api/v1/users' khop voi ca chinh no lan
 * '/api/v1/users/123'. Dung cho bang dinh tuyen proxy (Technical_Spec.md muc 6).
 */
export function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
