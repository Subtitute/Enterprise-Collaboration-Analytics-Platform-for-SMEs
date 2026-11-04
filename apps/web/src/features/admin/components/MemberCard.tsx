import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { EditIcon, MoreVerticalIcon, RefreshIcon, TrashIcon, UserIcon } from '@/components/ui/Icons';
import { getRoleBadgeConfig } from './MemberTableRow';
import { formatPhone } from '@/lib/phone';
import { FaceStatusBadge } from '@/features/face/components/FaceStatusBadge';
import type { FaceStatus, User } from '@/types';

interface MemberCardProps {
  user: User;
  departmentName: string;
  canManageUsers: boolean;
  onEdit: (user: User) => void;
  onDeactivate: (user: User) => void;
  onReactivate: (userId: string) => void;
  onDelete: (user: User) => void;
  // 26/10/2026: Danh sach nhan vien (Wireframe muc 16.1, mobile) - the bam mo Ho so nhan vien.
  faceStatus?: FaceStatus;
  onOpen: (user: User) => void;
}

export const MemberCard = memo(function MemberCard({
  user: u,
  departmentName,
  canManageUsers,
  onEdit,
  onDeactivate,
  onReactivate,
  onDelete,
  faceStatus,
  onOpen,
}: MemberCardProps) {
  const { t } = useTranslation();

  return (
    <div
      onClick={() => onOpen(u)}
      className="rounded-radius-md border border-border-subtle bg-white p-4 transition-colors hover:border-border-strong cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={u.fullName} src={u.avatarUrl} size="sm" className="h-9 w-9 text-xs shrink-0 bg-accent-soft text-accent font-medium" />
          <div className="min-w-0">
            <p className="truncate font-medium text-[14px] text-text-primary">{u.fullName}</p>
            <p className="truncate text-[12px] text-text-tertiary">{u.email}</p>
          </div>
        </div>

        {canManageUsers && (
          <div onClick={(e) => e.stopPropagation()}>
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
                  <DropdownItem
                    onClick={() => {
                      onReactivate(u.id);
                      close();
                    }}
                  >
                    <RefreshIcon className="h-4 w-4" /> {t('admin:membersPage.actionsMenu.reactivate')}
                  </DropdownItem>
                )}
                <DropdownItem
                  className="text-rose-600 hover:bg-rose-50 border-t border-border-subtle"
                  onClick={() => {
                    onDelete(u);
                    close();
                  }}
                >
                  <TrashIcon className="h-4 w-4" /> {t('admin:membersPage.actionsMenu.deletePermanent')}
                </DropdownItem>
              </div>
            )}
          </Dropdown>
          </div>
        )}
      </div>

      {/* 29/10/2026: Rà soát UI danh sách nhân viên và hồ sơ theo Việc 1c - hiển thị mã NV và số điện thoại trên mobile card */}
      {(u.employeeCode || u.phoneNumber) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px]">
          {u.employeeCode && (
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-radius-sm bg-bg-subtle text-text-secondary border border-border-subtle font-medium">
              {u.employeeCode}
            </span>
          )}
          {u.phoneNumber && (
            <span className="font-mono text-[11px] tabular-nums text-text-secondary">
              {formatPhone(u.phoneNumber)}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 pt-2.5 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <div className="flex items-center gap-1.5 text-text-secondary">
          <span className="text-text-tertiary">{t('admin:membersPage.columns.department')}:</span>
          <span className="font-medium text-text-primary">{departmentName}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <FaceStatusBadge status={faceStatus} className="text-[11px]" />
          {u.isActive === false ? (
            <span className="inline-flex items-center rounded-radius-sm px-2 py-0.5 text-[11px] font-medium bg-bg-muted text-text-secondary border border-border-subtle">
              {t('admin:membersPage.status.inactive')}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-radius-sm px-2 py-0.5 text-[11px] font-medium bg-success-soft text-success border border-success/20">
              {t('admin:membersPage.status.active')}
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {(u.roles ?? []).length === 0 ? (
          <span className="text-[12px] text-text-tertiary">—</span>
        ) : (
          (u.roles ?? []).map((r) => {
            const badgeCfg = getRoleBadgeConfig(r.name, t);
            return (
              <span
                key={r.id}
                className={`inline-flex items-center rounded-radius-sm px-2 py-0.5 text-[11px] ${badgeCfg.className}`}
              >
                {badgeCfg.label}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
});

