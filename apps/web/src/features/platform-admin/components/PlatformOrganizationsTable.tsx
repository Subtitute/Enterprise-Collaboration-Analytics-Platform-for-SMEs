import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/Table';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { LockIcon, MoreVerticalIcon, RefreshIcon } from '@/components/ui/Icons';
import { formatDate } from '@/lib/utils';
import type { PlatformOrganization } from '@/types';

interface PlatformOrganizationsTableProps {
  organizations: PlatformOrganization[];
  onDeactivate: (org: PlatformOrganization) => void;
  onReactivate: (id: string) => void;
}

export const PlatformOrganizationsTable = memo(function PlatformOrganizationsTable({
  organizations,
  onDeactivate,
  onReactivate,
}: PlatformOrganizationsTableProps) {
  const { t } = useTranslation();

  return (
    <Table className="border-0">
      <TableHead className="bg-bg-subtle border-b border-border-subtle">
        <tr className="h-10">
          <TableHeadCell className="h-10 text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">
            {t('platformAdmin:page.columns.organization')}
          </TableHeadCell>
          <TableHeadCell className="h-10 text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">
            {t('platformAdmin:page.columns.taxCode')}
          </TableHeadCell>
          <TableHeadCell className="h-10 text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">
            {t('platformAdmin:page.columns.userCount')}
          </TableHeadCell>
          <TableHeadCell className="h-10 text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">
            {t('platformAdmin:page.columns.createdAt')}
          </TableHeadCell>
          <TableHeadCell className="h-10 text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">
            {t('platformAdmin:page.columns.status')}
          </TableHeadCell>
          <TableHeadCell className="h-10 text-right text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">
            {t('platformAdmin:page.columns.actions')}
          </TableHeadCell>
        </tr>
      </TableHead>
      <TableBody>
        {organizations.map((org) => (
          <TableRow key={org.id} className="h-14 border-b border-border-subtle hover:bg-bg-subtle transition-colors">
            <TableCell label={t('platformAdmin:page.columns.organization')} className="px-4 py-2.5 font-medium text-[13px] text-text-primary">
              {org.name}
            </TableCell>
            <TableCell label={t('platformAdmin:page.columns.taxCode')} className="px-4 py-2.5 text-[13px] font-mono tabular-nums text-text-secondary">
              {org.taxCode ?? '—'}
            </TableCell>
            <TableCell label={t('platformAdmin:page.columns.userCount')} className="px-4 py-2.5 text-[13px] font-mono tabular-nums font-medium text-text-secondary">
              {org.userCount}
            </TableCell>
            <TableCell label={t('platformAdmin:page.columns.createdAt')} className="px-4 py-2.5 text-[13px] font-mono tabular-nums font-medium text-text-secondary">
              {formatDate(org.createdAt)}
            </TableCell>
            <TableCell label={t('platformAdmin:page.columns.status')} className="px-4 py-2.5">
              {org.isActive ? (
                <span className="inline-flex items-center rounded-radius-sm px-2 py-0.5 text-[12px] font-medium bg-success-soft text-success border border-border-subtle">
                  {t('platformAdmin:page.status.active')}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-radius-sm px-2 py-0.5 text-[12px] font-medium bg-error-soft text-error border border-border-subtle">
                  {t('platformAdmin:page.status.inactive')}
                </span>
              )}
            </TableCell>
            <TableCell label={t('platformAdmin:page.columns.actions')} className="px-4 py-2.5 text-right">
              <Dropdown
                align="right"
                trigger={({ toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-radius-sm text-text-tertiary hover:bg-bg-subtle hover:text-text-primary transition-colors cursor-pointer"
                    aria-label={t('platformAdmin:page.optionsAria')}
                  >
                    <MoreVerticalIcon className="h-4 w-4" />
                  </button>
                )}
              >
                {({ close }) => (
                  <div className="w-48 p-1">
                    {org.isActive ? (
                      <DropdownItem
                        className="text-error hover:bg-error-soft"
                        onClick={() => {
                          onDeactivate(org);
                          close();
                        }}
                      >
                        <LockIcon className="h-4 w-4 shrink-0" /> {t('platformAdmin:page.actionsMenu.deactivate')}
                      </DropdownItem>
                    ) : (
                      <DropdownItem
                        onClick={() => {
                          onReactivate(org.id);
                          close();
                        }}
                      >
                        <RefreshIcon className="h-4 w-4 shrink-0 text-text-secondary" /> {t('platformAdmin:page.actionsMenu.reactivate')}
                      </DropdownItem>
                    )}
                  </div>
                )}
              </Dropdown>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
});

