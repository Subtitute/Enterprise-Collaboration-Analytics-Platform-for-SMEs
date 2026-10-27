import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Input';
import { Stepper } from '@/components/ui/Stepper';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/Table';
import { AlertTriangleIcon, CheckCircleIcon, DownloadIcon, InfoIcon, RefreshIcon, UploadIcon, XIcon } from '@/components/ui/Icons';
import { extractErrorMessage } from '@/lib/api-client';
import { normalizeFacePhoto } from '@/lib/image-normalize';
import { usePermissions } from '@/stores/auth.store';
import { PERMISSIONS } from '@/constants/permissions';
import { fetchFaceStatuses, inspectFacePhoto, uploadUserFace } from '@/features/face/api';
import type { FaceStatus } from '@/types';
import { useDepartmentsQuery, useRolesQuery } from '../hooks';
import { fetchUsers, fetchWholeDirectory, inviteUser, updateUser } from '../api';
import {
  COLUMNS,
  LIMITS,
  TEMPLATE_HEADERS,
  ZipLimitError,
  buildReportRows,
  classifyRows,
  emailIndex,
  hasReportableRows,
  matchPhoto,
  photoDisplayState,
  parseRows,
  photoIsWritable,
  readPhotoZip,
  rowIsWritable,
  unmatchedPhotos,
  type ImportRow,
  type ZipIndex,
} from './import-employees.utils';

type Step = 1 | 2 | 3 | 4;
const REQUEST_GAP_MS = 400; // <= 2,5 request/giay (Gateway gioi han 300/phut/nguoi)
const SYNC_RETRY_DELAYS_MS = [2000, 4000, 8000, 16000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function errorCodeOf(err: unknown): string | undefined {
  return axios.isAxiosError(err) ? (err.response?.data as { errorCode?: string } | undefined)?.errorCode : undefined;
}

/** 429 -> cho theo Retry-After (toi da 3 lan); 409 USER_NOT_SYNCED (khi `syncRetry`) -> 2/4/8/16 giay. */
async function withRetry<T>(call: () => Promise<T>, syncRetry = false): Promise<T> {
  let rateLimitAttempts = 0;
  let syncAttempt = 0;
  for (;;) {
    try {
      return await call();
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 429 && rateLimitAttempts < 3) {
        rateLimitAttempts += 1;
        const retryAfter = Number(axios.isAxiosError(err) ? err.response?.headers?.['retry-after'] : undefined);
        await sleep((Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 5) * 1000);
        continue;
      }
      if (syncRetry && status === 409 && errorCodeOf(err) === 'USER_NOT_SYNCED' && syncAttempt < SYNC_RETRY_DELAYS_MS.length) {
        await sleep(SYNC_RETRY_DELAYS_MS[syncAttempt]);
        syncAttempt += 1;
        continue;
      }
      throw err;
    }
  }
}

/**
 * 24/09/2026: "Nhap Excel" - nhap hang loat nhan vien, trinh duyet goi tuan tu POST /users/invite.
 *
 * 26/10/2026: trinh nhap Excel + ZIP anh nhan dien 4 buoc (Technical_Spec.md muc 27.9, Wireframe muc
 * 16.4): (1) Tep - Excel + ZIP tuy chon, xu ly HOAN TOAN trong trinh duyet (anh chuan hoa canvas ->
 * JPEG, mat EXIF); (2) Xem truoc - kiem tra client + phan loai Moi moi/Cap nhat/Ngoai pham vi + kiem
 * tra tung anh qua POST /ml/face/inspect (khong luu); (3) Dang nhap - moi dong 2 buoc doc lap Tai
 * khoan roi Anh (ban CHO nhan vien xac nhan), co tam dung, 429/USER_NOT_SYNCED thu lai; (4) Ket qua -
 * thu lai cac buoc loi, tai bao cao loi .xlsx (khong chua mat khau). Chay lai = upsert theo email.
 */
export function ImportEmployeesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canManageUsers = usePermissions().includes(PERMISSIONS.USER_MANAGE);
  const departmentsQuery = useDepartmentsQuery();
  const rolesQuery = useRolesQuery();

  const [step, setStep] = useState<Step>(1);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [zipIndex, setZipIndex] = useState<ZipIndex | null>(null);
  const [, setVersion] = useState(0);
  const [inspectProgress, setInspectProgress] = useState({ done: 0, total: 0 });
  const [runProgress, setRunProgress] = useState({ done: 0, total: 0, current: '' });
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const cancelledRef = useRef(false);
  const thumbUrls = useRef(new Map<number, string>());
  const isRunning = step === 3;

  const bump = () => setVersion((v) => v + 1);

  function revokeThumbs() {
    for (const url of thumbUrls.current.values()) URL.revokeObjectURL(url);
    thumbUrls.current.clear();
  }

  function reset() {
    cancelledRef.current = true;
    revokeThumbs();
    setStep(1);
    setExcelFile(null);
    setZipFile(null);
    setFileError('');
    setRows([]);
    setZipIndex(null);
    setOnlyErrors(false);
    setPaused(false);
    pausedRef.current = false;
  }

  useEffect(() => () => revokeThumbs(), []);

  function handleClose() {
    reset();
    onClose();
  }

  function translateReason(code: string): string {
    if (code.startsWith('FACE_') || code === 'USER_NOT_SYNCED') return t(`errors:${code}`);
    return t(`admin:importWizard.reasons.${code}`);
  }

  function thumbOf(row: ImportRow): string | undefined {
    if (!row.photo?.blob) return undefined;
    let url = thumbUrls.current.get(row.rowNumber);
    if (!url) {
      url = URL.createObjectURL(row.photo.blob);
      thumbUrls.current.set(row.rowNumber, url);
    }
    return url;
  }

  function handleDownloadTemplate() {
    // Dong vi du minh hoa - du lieu mau (ten nguoi, ten phong ban), khong phai van ban giao dien. i18n-lint-ignore (26/10/2026)
    const sheet = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      ['Nguyễn Văn An', 'an.nguyen@congty.vn', '0912345678', 'NV001', 'Kinh doanh', 'Employee', '', 'an.nguyen.jpg'], // i18n-lint-ignore (26/10/2026)
      ['Trần Thị Bình', 'binh.tran@congty.vn', '0283 812 3456', 'NV002', 'Kỹ thuật', 'Employee', '', ''], // i18n-lint-ignore (26/10/2026)
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Nhân viên'); // i18n-lint-ignore (24/09/2026)
    XLSX.writeFile(workbook, 'mau-nhap-nhan-vien.xlsx');
  }

  function handleExcelChange(e: ChangeEvent<HTMLInputElement>) {
    setFileError('');
    setExcelFile(e.target.files?.[0] ?? null);
  }

  function handleZipChange(e: ChangeEvent<HTMLInputElement>) {
    setFileError('');
    setZipFile(e.target.files?.[0] ?? null);
  }

  async function fetchAllOrgUsers() {
    const all = [];
    for (let page = 1; page <= 20; page += 1) {
      const res = await fetchUsers({ page, limit: 500 });
      all.push(...res.data);
      if (all.length >= res.meta.total || res.data.length === 0) break;
    }
    return all;
  }

  // ------------------------------------------------------------ Buoc 1 -> 2: doc tep + phan loai --
  async function handlePrepare() {
    if (!excelFile) return;
    if (excelFile.size > LIMITS.excelBytes) return setFileError(t('admin:importWizard.errors.excelTooLarge'));
    if (zipFile && zipFile.size > LIMITS.zipBytes) return setFileError(t('admin:importWizard.errors.zipTooLarge'));
    setPreparing(true);
    cancelledRef.current = false;
    try {
      let records: Record<string, unknown>[];
      try {
        const workbook = XLSX.read(await excelFile.arrayBuffer(), { type: 'array' });
        const first = workbook.SheetNames[0];
        if (!first) throw new Error('empty-workbook');
        records = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[first], { defval: '' });
      } catch {
        return setFileError(t('admin:importEmployeesModal.parseError'));
      }
      if (records.length === 0) return setFileError(t('admin:importWizard.errors.excelEmpty'));
      if (records.length > LIMITS.rows) return setFileError(t('admin:importWizard.errors.tooManyRows', { max: LIMITS.rows }));

      let zip: ZipIndex | null = null;
      if (zipFile) {
        try {
          zip = readPhotoZip(new Uint8Array(await zipFile.arrayBuffer()));
        } catch (err) {
          return setFileError(t(`admin:importWizard.errors.${err instanceof ZipLimitError ? err.message : 'zipUnreadable'}`));
        }
      }

      const parsed = parseRows(records);
      for (const row of parsed) {
        const match = matchPhoto(row, zip);
        if (!match) continue;
        if ('error' in match) {
          row.photo = { fileName: match.fileName, error: match.error };
          continue;
        }
        try {
          row.photo = { fileName: match.fileName, blob: await normalizeFacePhoto(new Blob([new Uint8Array(match.bytes)])) };
        } catch {
          row.photo = { fileName: match.fileName, error: 'photoUnreadable' };
        }
      }

      const [orgUsers, scopeUsers] = await Promise.all([fetchAllOrgUsers(), fetchWholeDirectory()]);
      const scopeIds = new Set(scopeUsers.map((u) => u.id));
      const orgEmails = emailIndex(orgUsers);
      const existingIds = parsed.map((r) => orgEmails.get(r.email)).filter((id): id is string => Boolean(id && scopeIds.has(id)));
      const faceStatusById: Record<string, FaceStatus> = {};
      for (let i = 0; i < existingIds.length; i += 200) {
        for (const s of await fetchFaceStatuses(existingIds.slice(i, i + 200))) if (s.userId) faceStatusById[s.userId] = s.status;
      }
      classifyRows(parsed, {
        orgEmails,
        scopeIds,
        departments: departmentsQuery.data ?? [],
        roles: rolesQuery.data ?? [],
        canManageUsers,
        faceStatusById,
      });
      setZipIndex(zip);
      setRows(parsed);
      setStep(2);
      void inspectPhotos(parsed);
    } catch (err) {
      setFileError(extractErrorMessage(err));
    } finally {
      setPreparing(false);
    }
  }

  // ------------------------------------------------------------ Buoc 2: kiem tra anh qua server ---
  async function inspectPhotos(list: ImportRow[]) {
    const targets = list.filter((r) => rowIsWritable(r) && r.photo?.blob && !r.photo.error && !r.photo.skipReason);
    setInspectProgress({ done: 0, total: targets.length });
    for (const [index, row] of targets.entries()) {
      if (cancelledRef.current) return;
      const photo = row.photo;
      const blob = photo?.blob;
      if (!photo || !blob) continue;
      try {
        const result = await withRetry(() => inspectFacePhoto(blob, row.userId));
        photo.inspect = result;
        if (!result.ok) photo.error = result.errorCode ?? 'FACE_INVALID_IMAGE';
      } catch (err) {
        photo.error = errorCodeOf(err) ?? 'FACE_INVALID_IMAGE';
      }
      setInspectProgress({ done: index + 1, total: targets.length });
      bump();
      await sleep(REQUEST_GAP_MS);
    }
  }

  // ------------------------------------------------------------ Buoc 3: ghi tuan tu --------------
  async function runImport() {
    setStep(3);
    cancelledRef.current = false;
    // Chay lai chi lam cac buoc chua xong/loi (buoc da ok/bo qua khong goi lai API).
    const needsWork = (r: ImportRow) =>
      (r.account.status === 'pending' || r.account.status === 'error') || r.photoStep.status === 'pending' || r.photoStep.status === 'error';
    const targets = rows.filter((r) => rowIsWritable(r) && needsWork(r));
    setRunProgress({ done: 0, total: targets.length, current: '' });
    for (const [index, row] of targets.entries()) {
      while (pausedRef.current && !cancelledRef.current) await sleep(300);
      if (cancelledRef.current) return;
      setRunProgress({ done: index, total: targets.length, current: t('admin:importWizard.running.account', { row: row.rowNumber }) });
      await writeAccount(row);
      bump();
      if (row.account.status !== 'error') {
        setRunProgress({ done: index, total: targets.length, current: t('admin:importWizard.running.photo', { row: row.rowNumber }) });
        await writePhoto(row);
        bump();
      }
    }
    setRunProgress((p) => ({ ...p, done: p.total, current: '' }));
    queryClient.invalidateQueries({ queryKey: ['admin'] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['face'] });
    setStep(4);
  }

  async function writeAccount(row: ImportRow) {
    if (row.account.status === 'ok' || row.account.status === 'skipped') return;
    try {
      if (row.action === 'invite') {
        const created = await withRetry(() =>
          inviteUser({
            email: row.email,
            fullName: row.fullName,
            initialPassword: row.password || undefined,
            departmentId: row.departmentId,
            roleIds: row.roleId ? [row.roleId] : undefined,
            phoneNumber: canManageUsers && row.phoneNumber ? row.phoneNumber : undefined,
            employeeCode: canManageUsers && row.employeeCode ? row.employeeCode : undefined,
          }),
        );
        row.userId = created.id;
        row.account = { status: 'ok', message: row.password ? 'invited' : 'invitedEmail' };
      } else {
        // Cap nhat: CHI so dien thoai/ma NV (Org Admin), o trong = giu nguyen.
        const payload = canManageUsers
          ? { ...(row.phoneNumber ? { phoneNumber: row.phoneNumber } : {}), ...(row.employeeCode ? { employeeCode: row.employeeCode } : {}) }
          : {};
        if (Object.keys(payload).length === 0) {
          row.account = { status: 'skipped', message: 'nothingToUpdate' };
        } else {
          await withRetry(() => updateUser(row.userId as string, payload));
          row.account = { status: 'ok', message: 'updated' };
        }
      }
    } catch (err) {
      row.account = { status: 'error', message: extractErrorMessage(err) };
    }
    await sleep(REQUEST_GAP_MS);
  }

  async function writePhoto(row: ImportRow) {
    if (row.photoStep.status === 'ok') return;
    if (!row.photo) {
      row.photoStep = { status: 'skipped' };
      return;
    }
    if (row.photo.skipReason) {
      row.photoStep = { status: 'skipped', message: row.photo.skipReason };
      return;
    }
    const blob = row.photo.blob;
    const userId = row.userId;
    if (!photoIsWritable(row) || !userId || !blob) {
      row.photoStep = { status: 'error', message: translateReason(row.photo.error ?? 'FACE_INVALID_IMAGE') };
      return;
    }
    try {
      await withRetry(() => uploadUserFace(userId, blob, 'IMPORT'), true);
      row.photoStep = { status: 'ok' };
    } catch (err) {
      row.photoStep = { status: 'error', message: extractErrorMessage(err) };
    }
    await sleep(REQUEST_GAP_MS);
  }

  function togglePause() {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }

  function handleDownloadReport() {
    const sheet = XLSX.utils.aoa_to_sheet(buildReportRows(rows, translateReason));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Báo cáo lỗi'); // i18n-lint-ignore (26/10/2026)
    XLSX.writeFile(workbook, 'bao-cao-loi-nhap-nhan-vien.xlsx');
  }

  // ------------------------------------------------------------ tong hop hien thi ----------------
  const summary = useMemo(() => {
    const writable = rows.filter(rowIsWritable);
    return {
      total: rows.length,
      invite: writable.filter((r) => r.action === 'invite').length,
      update: writable.filter((r) => r.action === 'update').length,
      warning: writable.filter((r) => r.notes.length || r.photo?.inspect?.warnings.length || r.photo?.skipReason || r.photo?.error).length,
      error: rows.length - writable.length,
      writable: writable.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, inspectProgress, runProgress]);

  const results = useMemo(() => {
    const processed = rows.filter(rowIsWritable);
    const failed = processed.filter((r) => r.account.status === 'error');
    const partial = processed.filter((r) => r.account.status !== 'error' && r.photoStep.status === 'error');
    return { success: processed.length - failed.length - partial.length, partial, failed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, step, runProgress]);

  const unmatched = useMemo(() => unmatchedPhotos(rows, zipIndex), [rows, zipIndex]);
  const inspecting = step === 2 && inspectProgress.done < inspectProgress.total;
  const visibleRows = onlyErrors ? rows.filter((r) => !rowIsWritable(r) || r.photo?.error) : rows;
  const steps = [1, 2, 3, 4].map((id) => ({ id, label: t(`admin:importWizard.steps.${id}`) }));

  function photoCell(row: ImportRow) {
    const p = row.photo;
    const state = photoDisplayState(row);
    if (!p || state === 'none') return <span className="text-text-tertiary">—</span>;
    // 26/10/2026: dong loi khong kiem tra anh -> hien ten tep thay vi "Dang kiem tra..." mai mai.
    if (state === 'notChecked') return <span className="text-text-tertiary">{t('admin:importWizard.preview.photoNotChecked', { file: p.fileName ?? '' })}</span>;
    if (p.error)
      return (
        <span className="flex items-start gap-1 text-error">
          <XIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {translateReason(p.error)}
          {p.fileName ? ` (${p.fileName})` : ''}
        </span>
      );
    if (p.skipReason)
      return <span className="text-warning">⊘ {translateReason(p.skipReason)}</span>;
    if (!p.inspect) return <span className="text-text-tertiary">{t('admin:importWizard.preview.photoChecking')}</span>;
    return (
      <span className="space-y-0.5">
        <span className="flex items-center gap-1 text-success">
          <CheckCircleIcon className="h-3.5 w-3.5" /> {t('admin:importWizard.preview.oneFace')}
        </span>
        {p.inspect.warnings.map((w) => (
          <span key={w} className="flex items-center gap-1 text-warning">
            <AlertTriangleIcon className="h-3.5 w-3.5" /> {t(`errors:${w}`)}
          </span>
        ))}
      </span>
    );
  }

  function statusCell(row: ImportRow) {
    if (!rowIsWritable(row)) return <span className="text-error">✖ {row.errors.map(translateReason).join(', ')}</span>;
    if (row.photo?.error) return <span className="text-error">{t('admin:importWizard.preview.photoError')}</span>;
    if (row.notes.length || row.photo?.skipReason || row.photo?.inspect?.warnings.length)
      return <span className="text-warning" title={row.notes.map(translateReason).join('; ')}>{t('admin:importWizard.preview.warning')}</span>;
    return <span className="text-success">{t('admin:importWizard.preview.valid')}</span>;
  }

  return (
    <Modal open={open} onClose={handleClose} preventCloseWhilePending={isRunning || preparing} title={t('admin:importEmployeesModal.title')} size="xl">
      <div className="space-y-4">
        <Stepper steps={steps} currentStep={step} className="mb-4" />

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-radius-md border border-border-subtle bg-bg-subtle p-3.5">
              <p className="text-[13px] leading-5 text-text-secondary">{t('admin:importWizard.file.instructions')}</p>
              <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <DownloadIcon className="h-4 w-4" /> {t('admin:importEmployeesModal.downloadTemplate')}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-radius-md border-2 border-dashed border-border-strong bg-bg-subtle/60 px-4 py-5 text-center text-[13px] text-text-secondary hover:border-accent">
                <UploadIcon className="h-5 w-5 text-slate-400" />
                <span className="font-medium text-text-primary">{t('admin:importWizard.file.excelLabel')}</span>
                <span>{excelFile ? excelFile.name : t('admin:importEmployeesModal.selectFile')}</span>
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelChange} />
              </label>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-radius-md border-2 border-dashed border-border-strong bg-bg-subtle/60 px-4 py-5 text-center text-[13px] text-text-secondary hover:border-accent">
                <UploadIcon className="h-5 w-5 text-slate-400" />
                <span className="font-medium text-text-primary">{t('admin:importWizard.file.zipLabel')}</span>
                <span>{zipFile ? zipFile.name : t('admin:importWizard.file.selectZip')}</span>
                <input type="file" accept=".zip" className="hidden" onChange={handleZipChange} />
              </label>
            </div>
            <p className="flex items-start gap-2 text-[12px] text-text-secondary">
              <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('admin:importWizard.file.matchingNote', { column: COLUMNS.photo })}
            </p>
            {!canManageUsers && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200/70 rounded-lg px-3 py-2">{t('admin:importWizard.file.managerNote')}</p>}
            {fileError && <p className="text-sm text-rose-600">{fileError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                {t('admin:importEmployeesModal.cancel')}
              </Button>
              <Button type="button" onClick={handlePrepare} disabled={!excelFile || departmentsQuery.isLoading} isLoading={preparing}>
                {t('admin:importWizard.file.continue')}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {inspecting && (
              <div className="space-y-1">
                <p className="text-[13px] text-text-secondary">{t('admin:importWizard.preview.inspecting', inspectProgress)}</p>
                <ProgressBar value={(inspectProgress.done / Math.max(1, inspectProgress.total)) * 100} />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 text-[13px]">
              <span>{t('admin:importWizard.preview.summary', summary)}</span>
              <label className="ml-auto flex items-center gap-1.5 text-text-secondary">
                <Checkbox checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} /> {t('admin:importWizard.preview.onlyErrors')}
              </label>
            </div>
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHead>
                  <tr>
                    <TableHeadCell>#</TableHeadCell>
                    <TableHeadCell>{t('admin:importWizard.columns.photo')}</TableHeadCell>
                    <TableHeadCell>{t('admin:importEmployeesModal.columns.email')}</TableHeadCell>
                    <TableHeadCell>{t('admin:importWizard.columns.action')}</TableHeadCell>
                    <TableHeadCell>{t('admin:importWizard.columns.face')}</TableHeadCell>
                    <TableHeadCell>{t('admin:importEmployeesModal.columns.status')}</TableHeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {visibleRows.map((row) => (
                    <TableRow key={row.rowNumber}>
                      <TableCell label="#">{row.rowNumber}</TableCell>
                      <TableCell label={t('admin:importWizard.columns.photo')}>
                        {thumbOf(row) ? <img src={thumbOf(row)} alt="" className="h-9 w-9 rounded object-cover" /> : '—'}
                      </TableCell>
                      <TableCell label={t('admin:importEmployeesModal.columns.email')} className="text-xs">{row.email || '—'}</TableCell>
                      <TableCell label={t('admin:importWizard.columns.action')} className="text-xs">
                        {row.action ? t(`admin:importWizard.actions.${row.action}`) : '—'}
                      </TableCell>
                      <TableCell label={t('admin:importWizard.columns.face')} className="text-xs">{photoCell(row)}</TableCell>
                      <TableCell label={t('admin:importEmployeesModal.columns.status')} className="text-xs">{statusCell(row)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="flex items-start gap-2 text-[12px] text-text-secondary">
              <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('admin:importWizard.preview.updateNote')}
            </p>
            {unmatched.length > 0 && (
              <p className="flex items-start gap-2 text-[12px] text-warning">
                <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('admin:importWizard.preview.unmatched', { count: unmatched.length })}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={reset}>
                {t('admin:importWizard.preview.back')}
              </Button>
              <Button type="button" onClick={runImport} disabled={summary.writable === 0 || inspecting}>
                {t('admin:importWizard.preview.submit', { count: summary.writable })}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-[13px] text-text-secondary">{t('admin:importWizard.running.progress', runProgress)}</p>
            <ProgressBar value={(runProgress.done / Math.max(1, runProgress.total)) * 100} />
            <p className="text-[12px] text-text-tertiary">{runProgress.current}</p>
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={togglePause}>
                {t(paused ? 'admin:importWizard.running.resume' : 'admin:importWizard.running.pause')}
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="text-[14px] font-medium text-text-primary">
              {t('admin:importWizard.result.summary', { success: results.success, partial: results.partial.length, failed: results.failed.length + summary.error })}
            </p>
            {[...results.failed, ...results.partial].length > 0 && (
              <div className="max-h-64 overflow-y-auto">
                <Table>
                  <TableHead>
                    <tr>
                      <TableHeadCell>#</TableHeadCell>
                      <TableHeadCell>{t('admin:importEmployeesModal.columns.email')}</TableHeadCell>
                      <TableHeadCell>{t('admin:importWizard.columns.account')}</TableHeadCell>
                      <TableHeadCell>{t('admin:importWizard.columns.face')}</TableHeadCell>
                      <TableHeadCell>{t('admin:importWizard.columns.reason')}</TableHeadCell>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {[...results.failed, ...results.partial].map((row) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell label="#">{row.rowNumber}</TableCell>
                        <TableCell label={t('admin:importEmployeesModal.columns.email')} className="text-xs">{row.email}</TableCell>
                        <TableCell label={t('admin:importWizard.columns.account')} className="text-xs">{t(`admin:importWizard.reasons.step.${row.account.status}`)}</TableCell>
                        <TableCell label={t('admin:importWizard.columns.face')} className="text-xs">{t(`admin:importWizard.reasons.step.${row.photoStep.status}`)}</TableCell>
                        <TableCell label={t('admin:importWizard.columns.reason')} className="text-xs text-error">
                          {row.account.status === 'error' ? row.account.message : row.photoStep.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="flex items-start gap-2 text-[12px] text-info">
              <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('admin:importWizard.result.pendingNote')}
            </p>
            <p className="flex items-start gap-2 text-[12px] text-warning">
              <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('admin:importWizard.result.deleteSourceNote')}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              {[...results.failed, ...results.partial].length > 0 && (
                <Button type="button" variant="outline" onClick={runImport}>
                  <RefreshIcon className="h-4 w-4" /> {t('admin:importWizard.result.retry')}
                </Button>
              )}
              {/* 26/10/2026: chi hien khi co dong loi (truoc day hien ca khi 0 loi -> tai ve tep rong). */}
              {hasReportableRows(rows) && (
                <Button type="button" variant="outline" onClick={handleDownloadReport}>
                  <DownloadIcon className="h-4 w-4" /> {t('admin:importWizard.result.downloadReport')}
                </Button>
              )}
              <Button type="button" onClick={handleClose}>
                {t('common:actions.close')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
