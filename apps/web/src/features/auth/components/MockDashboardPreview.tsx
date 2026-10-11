import { memo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * MockDashboardPreview — B.3
 * Tĩnh hoàn toàn, vẽ bằng CSS và SVG thuần.
 * Không dùng thư viện chart, không animation, không box-shadow, không gradient.
 */
export const MockDashboardPreview = memo(function MockDashboardPreview() {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-[420px] rounded-radius-lg border border-white/[0.08] p-4 bg-transparent">
      <div className="flex flex-col gap-4">
        {/* Khối 1 — Metric Card */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] leading-4 font-semibold tracking-[0.06em] uppercase text-[#F7F6F3]/50">
            {t('auth:loginPage.previewRevenueTitle', 'DOANH THU THÁNG')}
          </span>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[22px] leading-7 font-medium text-[#F7F6F3]">
              {t('auth:loginPage.previewRevenueValue', '₫1.28B')}
            </span>
            <div className="flex items-center gap-1 text-success text-xs leading-4 font-medium">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m18 15-6-6-6 6" />
              </svg>
              <span>+12.4%</span>
            </div>
          </div>
        </div>

        {/* Khối 2 — Mini Chart (SVG thuần 7 điểm gấp khúc, stroke teal #0E5E5E, area fill opacity 0.12) */}
        <div className="w-full overflow-hidden">
          <svg viewBox="0 0 360 80" className="w-full h-auto block" fill="none">
            {/* Area fill */}
            <path
              d="M0,60 L60,48 L120,55 L180,32 L240,38 L300,18 L360,22 L360,80 L0,80 Z"
              fill="#0E5E5E"
              fillOpacity="0.12"
            />
            {/* Stroke line */}
            <path
              d="M0,60 L60,48 L120,55 L180,32 L240,38 L300,18 L360,22"
              stroke="#0E5E5E"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>

        {/* Khối 3 — Status Line */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-radius-full bg-[#2F6F44]" />
              <span className="text-xs leading-4 font-normal text-[#F7F6F3]/50">
                {t('auth:loginPage.previewSyncStatus', 'Đồng bộ 2 phút trước')}
              </span>
            </div>
            <span className="font-mono text-xs leading-4 font-medium text-[#F7F6F3]/70">
              98%
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1 w-full rounded-radius-full bg-white/[0.08] overflow-hidden">
            <div className="h-full bg-[#0E5E5E] rounded-radius-full" style={{ width: '98%' }} />
          </div>
        </div>
      </div>
    </div>
  );
});
