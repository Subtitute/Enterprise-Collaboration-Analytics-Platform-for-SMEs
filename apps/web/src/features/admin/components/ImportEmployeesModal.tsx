import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/Table';
import { DownloadIcon, UploadIcon, CheckCircleIcon, AlertCircleIcon } from '@/components/ui/Icons';
import { toast } from '@/stores/toast.store';
import { extractErrorMessage } from '@/lib/api-client';
import { usePermissions } from '@/stores/auth.store';
import { PERMISSIONS } from '@/constants/permissions';
import { useDepartmentsQuery, useRolesQuery } from '../hooks';
import { inviteUser } from '../api';
import {
  TEMPLATE_HEADERS,
  buildRows,
  type ParsedRow,
  type RowOutcome,
} from './import-employees.utils';

export function ImportEmployeesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [outcomes, setOutcomes] = useState<RowOutcome[]>([]);

  const departmentsQuery = useDepartmentsQuery();
  const rolesQuery = useRolesQuery();
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const canManageRoles = permissions.includes(PERMISSIONS.USER_MANAGE);

  const isPending = departmentsQuery.isLoading || rolesQuery.isLoading;
  const validRows = rows.filter((r) => !r.error);
  const invalidRows = rows.filter((r) => r.error);
  const hasResults = outcomes.length > 0;

  function reset() {
    setRows([]);
    setFileName('');
    setParseError('');
    setOutcomes([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleDownloadTemplate() {
    // Dong vi du minh hoa trong file mau tai ve - du lieu mau (ten nguoi, ten phong ban), khong
    // phai van ban giao dien. i18n-lint-ignore (24/09/2026)
    const sheet = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      ['Nguyễn Văn A', 'nguyen.van.a@congty.vn', '', 'Kinh doanh', 'Employee'], // i18n-lint-ignore (24/09/2026)
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Nhân viên'); // i18n-lint-ignore (24/09/2026)
    XLSX.writeFile(workbook, 'mau-nhap-nhan-vien.xlsx');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError('');
    setOutcomes([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) throw new Error('empty-workbook');
        const sheet = workbook.Sheets[firstSheetName];
        const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        setRows(buildRows(records, departmentsQuery.data ?? [], rolesQuery.data ?? [], canManageRoles));
      } catch {
        setParseError(t('admin:importEmployeesModal.parseError'));
        setRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    setIsImporting(true);
    const results: RowOutcome[] = [];
    for (const row of validRows) {
      try {
        await inviteUser({
          email: row.email,
          fullName: row.fullName,
          initialPassword: row.initialPassword,
          departmentId: row.departmentId,
          roleIds: row.roleId ? [row.roleId] : undefined,
        });
        results.push({ rowNumber: row.rowNumber, status: 'success', message: t('admin:importEmployeesModal.rowSuccess') });
      } catch (err) {
        results.push({ rowNumber: row.rowNumber, status: 'error', message: extractErrorMessage(err) });
      }
      // Cap nhat tien do TAM THOI sau moi dong (khong doi tra ve mang moi de tranh render lai qua nhieu).
      setOutcomes([...results]);
    }
    setIsImporting(false);

    const successCount = results.filter((r) => r.status === 'success').length;
    const failCount = results.length - successCount;
    if (successCount > 0) {
      // 24/09/2026: goi thang inviteUser() (khong qua useInviteUser()) de xu ly loi TUNG DONG rieng
      // biet - nen phai tu invalidate cache o day, dung CHINH XAC 2 queryKey ma useInviteUser() da
      // invalidate (hooks.ts) de danh sach Thanh vien lam moi ngay sau khi nhap.
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
      toast.success(t('admin:importEmployeesModal.importSummary', { success: successCount, fail: failCount }));
    } else if (failCount > 0) {
      toast.error(t('admin:importEmployeesModal.importAllFailed'));
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      preventCloseWhilePending={isImporting}
      title={t('admin:importEmployeesModal.title')}
      size="xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-radius-md border border-border-subtle bg-bg-subtle p-3.5">
          <p className="text-[13px] leading-5 text-text-secondary">{t('admin:importEmployeesModal.instructions')}</p>
          <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <DownloadIcon className="h-4 w-4" /> {t('admin:importEmployeesModal.downloadTemplate')}
          </Button>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            id="import-employees-file"
          />
          <label
            htmlFor="import-employees-file"
            className="flex cursor-pointer items-center justify-center gap-2 rounded-radius-md border-2 border-dashed border-border-strong bg-bg-subtle/60 px-4 py-6 text-[13px] font-medium text-text-secondary transition-colors hover:border-accent hover:bg-accent-soft/30 hover:text-text-primary"
          >
            <UploadIcon className="h-5 w-5 text-slate-400" />
            {fileName || t('admin:importEmployeesModal.selectFile')}
          </label>
          {parseError && <p className="mt-2 text-sm text-rose-600">{parseError}</p>}
        </div>

        {!canManageRoles && rows.some((r) => r.roleName) && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200/70 rounded-lg px-3 py-2">
            {t('admin:importEmployeesModal.roleColumnIgnored')}
          </p>
        )}

        {rows.length > 0 && (
          <>
            <div className="flex items-center gap-4 text-sm">
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <CheckCircleIcon className="h-4 w-4" />
                {t('admin:importEmployeesModal.validCount', { count: validRows.length })}
              </span>
              {invalidRows.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-rose-600">
                  <AlertCircleIcon className="h-4 w-4" />
                  {t('admin:importEmployeesModal.invalidCount', { count: invalidRows.length })}
                </span>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHead>
                  <tr>
                    <TableHeadCell>{t('admin:importEmployeesModal.columns.row')}</TableHeadCell>
                    <TableHeadCell>{t('admin:importEmployeesModal.columns.fullName')}</TableHeadCell>
                    <TableHeadCell>{t('admin:importEmployeesModal.columns.email')}</TableHeadCell>
                    <TableHeadCell>{t('admin:importEmployeesModal.columns.department')}</TableHeadCell>
                    <TableHeadCell>{t('admin:importEmployeesModal.columns.role')}</TableHeadCell>
                    <TableHeadCell>{t('admin:importEmployeesModal.columns.status')}</TableHeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const outcome = outcomes.find((o) => o.rowNumber === row.rowNumber);
                    return (
                      <TableRow key={row.rowNumber}>
                        <TableCell label={t('admin:importEmployeesModal.columns.row')}>{row.rowNumber}</TableCell>
                        <TableCell label={t('admin:importEmployeesModal.columns.fullName')}>{row.fullName || '—'}</TableCell>
                        <TableCell label={t('admin:importEmployeesModal.columns.email')} className="text-xs">
                          {row.email || '—'}
                          {row.passwordWasDefaulted && !row.error && (
                            <span className="ml-1.5 text-slate-400">{t('admin:importEmployeesModal.defaultPasswordNote')}</span>
                          )}
                        </TableCell>
                        <TableCell label={t('admin:importEmployeesModal.columns.department')}>{row.departmentName || '—'}</TableCell>
                        <TableCell label={t('admin:importEmployeesModal.columns.role')}>{row.roleName || '—'}</TableCell>
                        <TableCell label={t('admin:importEmployeesModal.columns.status')}>
                          {outcome ? (
                            <span className={outcome.status === 'success' ? 'text-emerald-700' : 'text-rose-600'}>
                              {outcome.status === 'success' ? t('admin:importEmployeesModal.rowSuccess') : outcome.message}
                            </span>
                          ) : row.error ? (
                            <span className="text-rose-600">{t(`admin:importEmployeesModal.rowErrors.${row.error}`)}</span>
                          ) : (
                            <span className="text-slate-400">{t('admin:importEmployeesModal.rowPending')}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isImporting}>
            {hasResults ? t('common:actions.close') : t('admin:importEmployeesModal.cancel')}
          </Button>
          {!hasResults && (
            <Button
              type="button"
              onClick={handleImport}
              disabled={validRows.length === 0 || isPending || isImporting}
              isLoading={isImporting}
            >
              {t('admin:importEmployeesModal.submit', { count: validRows.length })}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
