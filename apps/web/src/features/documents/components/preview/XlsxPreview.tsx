import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkBook } from 'xlsx';
import { Tabs } from '@/components/ui/Tabs';
import { buildSheetView, readWorkbook, visibleSheetNames } from './xlsx-view';
import { PreviewLoadingOverlay } from './PreviewLoading';
import type { OfficePreviewProps } from './preview-type';

// 27/10/2026: xem truoc .xlsx/.xls - tab trang tinh (Tabs dung chung) + bang gia tri (React element,
// khong innerHTML). Nap lazy tu FilePreviewModal; logic doc/cat bang nam o xlsx-view.ts.
export default function XlsxPreview({ data, onError }: OfficePreviewProps) {
  const { t } = useTranslation();
  const [workbook, setWorkbook] = useState<WorkBook | null>(null);
  const [activeSheet, setActiveSheet] = useState('');

  useEffect(() => {
    let cancelled = false;
    // Tre 1 nhip de spinner kip hien truoc khi SheetJS phan tich dong bo tren luong chinh.
    const timer = window.setTimeout(() => {
      try {
        const wb = readWorkbook(data);
        if (cancelled) return;
        setWorkbook(wb);
        setActiveSheet(visibleSheetNames(wb)[0] ?? '');
      } catch {
        if (!cancelled) onError();
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [data, onError]);

  const sheetNames = useMemo(() => (workbook ? visibleSheetNames(workbook) : []), [workbook]);
  const view = useMemo(() => (workbook ? buildSheetView(workbook, activeSheet) : null), [workbook, activeSheet]);

  if (!view) return <PreviewLoadingOverlay />;

  const isTruncated = view.rows.length < view.totalRows || view.columns.length < view.totalCols;

  return (
    <div className="flex w-full h-full flex-col bg-white">
      {sheetNames.length > 0 && (
        <div className="shrink-0 overflow-x-auto px-2">
          <Tabs
            tabs={sheetNames.map((name) => ({ value: name, label: name }))}
            value={activeSheet}
            onChange={setActiveSheet}
            className="w-max min-w-full whitespace-nowrap"
          />
        </div>
      )}
      {isTruncated && (
        <p className="shrink-0 border-b border-border-subtle bg-[#FFF8E6] px-3 py-1.5 text-[12px] text-text-secondary">
          {t('documents:preview.sheetTruncated', {
            rows: view.rows.length,
            totalRows: view.totalRows,
            cols: view.columns.length,
            totalCols: view.totalCols,
          })}
        </p>
      )}
      <div className="flex-1 overflow-auto">
        {view.rows.length === 0 ? (
          <p className="py-8 text-center text-xs italic text-slate-400">{t('documents:preview.sheetEmpty')}</p>
        ) : (
          <table className="border-separate border-spacing-0 text-left text-xs text-slate-700">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 min-w-[40px] border-b border-r border-slate-200 bg-slate-100" />
                {view.columns.map((col) => (
                  <th
                    key={col}
                    className="sticky top-0 z-10 border-b border-r border-slate-200 bg-slate-100 px-2 py-1 text-center font-semibold text-slate-500"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.rows.map((row, rIdx) => (
                <tr key={view.rowNumbers[rIdx]} className="hover:bg-slate-50/60">
                  <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-100 px-2 py-1 text-right font-mono font-medium text-slate-500 tabular-nums">
                    {view.rowNumbers[rIdx]}
                  </th>
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className="max-w-[320px] border-b border-r border-slate-100 px-2 py-1 align-top whitespace-pre-wrap break-words"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
