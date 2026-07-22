import { useEffect, useMemo, useState } from 'react';
import { useAllProjectsQuery } from '@/hooks/useOrgProjects';
import { useAllTasksQuery } from '@/features/projects/hooks';
import { useOrgUsersQuery } from '@/hooks/useOrgUsers';
import { useFoldersQuery } from '@/features/documents/hooks';

export interface SearchResult {
  id: string;
  category: 'project' | 'task' | 'member' | 'folder';
  label: string;
  sublabel?: string;
  href: string;
}

const MAX_PER_CATEGORY = 5;

/**
 * Tim kiem tong hop cho o tim kiem tren Topbar (Wireframe.md muc 1: "Tìm kiếm dự án, tài
 * liệu, công việc…") - 22/07/2026: truoc do o nay chi la input tinh, khong noi voi bat ky
 * nguon du lieu nao (co san `title` ghi chu "sap ra mat"), khong lam gi khi go.
 *
 * Khong goi API rieng cho tinh nang nay: tai su dung cac query "lay toan bo 1 lan" da co san
 * va dang duoc cache boi cac trang khac (danh sach du an, cong viec, thanh vien, thu muc goc) -
 * phu hop quy mo SME nho (General_idea.md muc 7), tranh phai them endpoint tim kiem rieng o
 * moi service. Loc va so khop chuoi con (khong phan biet hoa/thuong) hoan toan o client.
 *
 * 22/07/2026: sua lai mo ta gioi han cho dung thuc te - filter thu muc ben duoi chay tren TOAN
 * BO danh sach phang tu useFoldersQuery() (khong co dieu kien parentId === null nao), nen ten
 * thu muc con (khong chi thu muc cap goc) van duoc tim thay binh thuong. Gioi han THAT SU duy
 * nhat la: khong tim theo NOI DUNG/TEN TEP (vi Document Service khong co endpoint liet ke toan
 * bo tep xuyen thu muc - se can lam rieng neu mo rong).
 *
 * 22/07/2026: nhan them `hasInteracted` va truyen `enabled` xuong ca 4 query "lay toan bo 1 lan"
 * ben duoi - sua loi thuc te phat hien qua kiem thu: truoc ban sua nay 4 query nay chay VO DIEU
 * KIEN ngay khi hook duoc goi, ma GlobalSearchBox lai nam trong Topbar (mount o MOI trang qua
 * AppShell) nen bat ky trang nao (ke ca /profile, /notifications - khong lien quan tim kiem) deu
 * phai tra them 4 request toan to chuc (payload toi 500 dong cho tasks/folders) chi de phuc vu 1
 * tinh nang nguoi dung co the khong bao gio dung toi. Chi bat cac query nay sau khi nguoi dung
 * thuc su tuong tac (focus) o tren o tim kiem it nhat 1 lan (xem GlobalSearchBox trong Topbar.tsx).
 */
export function useGlobalSearch(rawQuery: string, hasInteracted: boolean) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setQuery(rawQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const projectsQuery = useAllProjectsQuery({ enabled: hasInteracted });
  const tasksQuery = useAllTasksQuery({ enabled: hasInteracted });
  const usersQuery = useOrgUsersQuery({ enabled: hasInteracted });
  const foldersQuery = useFoldersQuery({ enabled: hasInteracted });

  const results = useMemo<SearchResult[]>(() => {
    if (query.length < 1) return [];
    const needle = query.toLowerCase();
    const matches = (...values: Array<string | undefined | null>) =>
      values.some((v) => v && v.toLowerCase().includes(needle));

    const projects = (projectsQuery.data ?? [])
      .filter((p) => matches(p.name))
      .slice(0, MAX_PER_CATEGORY)
      .map<SearchResult>((p) => ({ id: p.id, category: 'project', label: p.name, href: `/projects/${p.id}` }));

    const projectNameById = new Map((projectsQuery.data ?? []).map((p) => [p.id, p.name]));
    const tasks = (tasksQuery.data ?? [])
      .filter((t) => matches(t.title))
      .slice(0, MAX_PER_CATEGORY)
      .map<SearchResult>((t) => ({
        id: t.id,
        category: 'task',
        label: t.title,
        sublabel: projectNameById.get(t.projectId),
        href: `/projects/${t.projectId}`,
      }));

    const members = (usersQuery.data ?? [])
      .filter((u) => matches(u.fullName, u.email))
      .slice(0, MAX_PER_CATEGORY)
      .map<SearchResult>((u) => ({ id: u.id, category: 'member', label: u.fullName, sublabel: u.email, href: '/admin/members' }));

    const folders = (foldersQuery.data ?? [])
      .filter((f) => matches(f.name))
      .slice(0, MAX_PER_CATEGORY)
      .map<SearchResult>((f) => ({ id: f.id, category: 'folder', label: f.name, href: `/documents?folderId=${f.id}` }));

    return [...projects, ...tasks, ...members, ...folders];
  }, [query, projectsQuery.data, tasksQuery.data, usersQuery.data, foldersQuery.data]);

  return {
    query,
    results,
    isLoading: query.length > 0 && (projectsQuery.isLoading || tasksQuery.isLoading || usersQuery.isLoading || foldersQuery.isLoading),
  };
}
