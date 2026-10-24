import { memo } from 'react';
import { useTranslation } from 'react-i18next';
// 24/10/2026: `t` khong-qua-hook lam fallback khi getRoleBadgeConfig() duoc goi khong kem `t` (thay
// cho chuoi tieng Viet hardcode truoc day - vi pham scripts/check-hardcoded-vietnamese.js).
import { t as i18nT } from '@/i18n';
import { Avatar } from '@/components/ui/Avatar';
import { TableCell, TableRow } from '@/components/ui/Table';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { EditIcon, MoreVerticalIcon, RefreshIcon, TrashIcon, UserIcon } from '@/components/ui/Icons';
import type { User } from '@/types';

/**
 * Chuẩn hóa nhãn và màu sắc ngữ cảnh cho Role Badge:
 * - Admin: bg-accent-soft text-accent border-accent/20
 * - Manager: bg-info-soft text-info border-info/20
 * - Employee: bg-subtle text-secondary border-border-subtle
 */
export function getRoleBadgeConfig(roleName: string, t?: (key: string) => string) {
  const lower = roleName.trim().toLowerCase();
  if (lower.includes('admin')) {
    const label = (t ?? i18nT)('admin:roles.orgAdmin');
    return {
      label,
      className: 'bg-accent-soft text-accent border border-accent/20 font-medium',
    };
  }
  if (lower.includes('manager')) {
    const label = (t ?? i18nT)('admin:roles.manager');
    return {
      label,
      className: 'bg-info-soft text-info border border-info/20 font-medium',
    };
  }
  if (lower.includes('employee')) {
    const label = (t ?? i18nT)('admin:roles.employee');
    return {
      label,
      className: 'bg-bg-subtle text-text-secondary border border-border-subtle font-medium',
    };
  }
  return {
    label: roleName,
    className: 'bg-bg-subtle text-text-secondary border border-border-subtle font-medium',
  };
}

interface MemberTableRowProps {
  user: User;
  departmentName: string;
  canManageUsers: boolean;
  onEdit: (user: User) => void;
  onDeactivate: (user: User) => void;
  onReactivate: (userId: string) => void;
  onDelete: (user: User) => void;
}

export const MemberTableRow = memo(function MemberTableRow({
  user: u,
  departmentName,
  canManageUsers,
  onEdit,
  onDeactivate,
  onReactivate,
  onDelete,
}: MemberTableRowProps) {
  const { t } = useTranslation();

  return (
    <TableRow key={u.id} className="h-14 border-b border-border-subtle hover:bg-bg-subtle transition-colors">
      <TableCell label={t('admin:membersPage.columns.member')} className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar name={u.fullName} size="sm" className="h-8 w-8 text-[11px] bg-accent-soft text-accent" />
          <div className="min-w-0">
            <p className="truncate font-medium text-[13px] text-text-primary">{u.fullName}</p>
            <p className="truncate text-[12px] text-text-tertiary">{u.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell label={t('admin:membersPage.columns.department')} className="px-4 py-2.5 text-[13px] text-text-secondary">
        {departmentName}
      </TableCell>
      <TableCell label={t('admin:membersPage.columns.role')} className="px-4 py-2.5">
        <div className="flex flex-wrap gap-1">
          {(u.roles ?? []).length === 0 ? (
            <span className="text-[12px] text-text-tertiary">—</span>
          ) : (
            (u.roles ?? []).map((r) => {
              const badgeCfg = getRoleBadgeConfig(r.name, t);
              return (
                <span
                  key={r.id}
                  className={`inline-flex items-center rounded-radius-sm px-2 py-0.5 text-[12px] ${badgeCfg.className}`}
                >
                  {badgeCfg.label}
                </span>
              );
            })
          )}
        </div>
      </TableCell>
      <TableCell label={t('admin:membersPage.columns.status')} className="px-4 py-2.5">
        {u.isActive === false ? (
          <span className="inline-flex items-center rounded-radius-sm px-2 py-0.5 text-[12px] font-medium bg-bg-muted text-text-secondary border border-border-subtle">
            {t('admin:membersPage.status.inactive')}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-radius-sm px-2 py-0.5 text-[12px] font-medium bg-success-soft text-success border border-success/20">
            {t('admin:membersPage.status.active')}
          </span>
        )}
      </TableCell>
      <TableCell label={t('admin:membersPage.columns.actions')} className="px-4 py-2.5 text-right">
        {/* 17/09/2026: an (khong chi disable) toan bo menu hanh dong khi khong co
            USER_MANAGE - moi hanh dong trong menu nay (sua vai tro/phong ban, vo hieu
            hoa, kich hoat lai) deu can quyen do, khac voi nut "Moi thanh vien" o dau
            trang (chi can USER_INVITE, van hien cho Manager). */}
        {canManageUsers ? (
          <Dropdown
            align="right"
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                className="rounded-radius-sm p-1.5 text-text-tertiary hover:bg-bg-subtle hover:text-text-primary cursor-pointer transition-colors"
                aria-label={t('admin:membersPage.optionsAria')}
              >
                <MoreVerticalIcon className="h-4 w-4" />
              </button>
            )}
          >
            {({ close }) => (
              <div className="w-48 py-1.5">
                <DropdownItem
                  onClick={() => {
                    onEdit(u);
                    close();
                  }}
                >
                  <EditIcon className="h-4 w-4" /> {t('admin:membersPage.actionsMenu.editRoleDepartment')}
                </DropdownItem>
                {u.isActive !== false ? (
                  <DropdownItem
                    className="text-rose-600 hover:bg-rose-50"
                    onClick={() => {
                      onDeactivate(u);
                      close();
                    }}
                  >
                    <UserIcon className="h-4 w-4" /> {t('admin:membersPage.actionsMenu.deactivate')}
                  </DropdownItem>
                ) : (
                  <>
                    {/* 22/07/2026 (review toan du an): truoc day KHONG co cach nao
                        kich hoat lai 1 tai khoan da vo hieu hoa tu giao dien - backend
                        da bo sung PATCH /users/:id/reactivate (fix loi Major) nhung
                        thieu diem vao tu UI. Chi hien khi tai khoan dang bi vo hieu hoa. */}
                    <DropdownItem
                      onClick={() => {
                        onReactivate(u.id);
                        close();
                      }}
                    >
                      <RefreshIcon className="h-4 w-4" /> {t('admin:membersPage.actionsMenu.reactivate')}
                    </DropdownItem>
                    {/* 25/09/2026: xoa vinh vien - chi hien khi tai khoan DA vo hieu
                        hoa (backend cung tu kiem tra dieu nay, xem UsersService.remove()) -
                        dung de don han du lieu rac (vd tai khoan E2E test tao ra) khoi
                        danh sach, khac voi "Vo hieu hoa" (van con hien, khong xoa). */}
                    <DropdownItem
                      className="text-rose-600 hover:bg-rose-50"
                      onClick={() => {
                        onDelete(u);
                        close();
                      }}
                    >
                      <TrashIcon className="h-4 w-4" /> {t('admin:membersPage.actionsMenu.delete')}
                    </DropdownItem>
                  </>
                )}
              </div>
            )}
          </Dropdown>
        ) : null}
      </TableCell>
    </TableRow>
  );
});

