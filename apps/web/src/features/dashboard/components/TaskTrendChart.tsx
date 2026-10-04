import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { QueryState } from '@/components/ui/QueryState';
import { Spinner } from '@/components/ui/Spinner';
import { BarChartIcon } from '@/components/ui/Icons';
import type { DateRangeOption, TaskTrendPoint } from '@/types';

function BarChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; payload: { displayDate?: string; tooltipLabel?: string } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const dateStr = p.payload.tooltipLabel || (p.payload.displayDate ? `Ngày ${p.payload.displayDate}` : label || '');
  const completedItem = payload.find((item) => item.name === 'completed' || item.name === 'Hoàn thành');
  const createdItem = payload.find((item) => item.name === 'created' || item.name === 'Được tạo mới');

  const completedVal = completedItem?.value ?? 0;
  const createdVal = createdItem?.value ?? 0;

  return (
    <div className="rounded-md border border-[#E5E7EB] bg-white p-2.5 text-xs shadow-md space-y-1.5">
      <div className="flex items-center gap-2 text-[#374151]">
        <span className="h-2 w-2 rounded-full bg-[#10B981] shrink-0" />
        <span>
          {dateStr}: <strong className="text-[#10B981] font-bold">{completedVal}</strong> công việc hoàn thành
        </span>
      </div>
      <div className="flex items-center gap-2 text-[#374151]">
        <span className="h-2 w-2 rounded-full bg-[#F59E0B] shrink-0" />
        <span>
          {dateStr}: <strong className="text-[#F59E0B] font-bold">{createdVal}</strong> công việc được tạo mới
        </span>
      </div>
    </div>
  );
}

interface TaskTrendChartProps {
  data?: TaskTrendPoint[];
  range?: DateRangeOption;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  filterSelectId?: string;
}

export function TaskTrendChart({
  data,
  range = '7d',
  isLoading,
  isError,
  onRetry,
  filterSelectId = 'dashboard-date-range-filter',
}: TaskTrendChartProps) {
  const { t } = useTranslation();

  // Chuyển đổi dữ liệu sang định dạng Bar Chart theo đúng yêu cầu nghiệp vụ:
  // - 7 ngày: hiển thị toàn bộ 7 ngày thực tế (nếu không có công việc nào hoàn thành/tạo mới thì hiển thị Empty State)
  // - 30 ngày: hiển thị tóm tắt 4 tuần gần nhất (ví dụ: 20 - 26/07, 27/07 - 02/08, ...)
  // - Quý này: hiển thị 3 tháng gần nhất tính đến thời điểm hiện tại (ví dụ: Thg 7, Thg 8, Thg 9)
  const chartData = useMemo(() => {
    // 1. Chế độ 7 ngày: Hiển thị 7 ngày gần nhất tính đến ngày hôm nay
    if (range === '7d') {
      const now = new Date();
      const daysList: Array<{
        date: string;
        displayDate: string;
        tooltipLabel: string;
        completed: number;
        created: number;
      }> = [];

      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dayStr = String(d.getDate()).padStart(2, '0');
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        const iso = d.toISOString().slice(0, 10);
        const displayDate = `${dayStr}-${monthStr}`;

        daysList.push({
          date: iso,
          displayDate,
          tooltipLabel: `Ngày ${displayDate}`,
          completed: 0,
          created: 0,
        });
      }

      if (data && data.length > 0) {
        for (const pt of data) {
          const ptDate = pt.date.includes('T') ? pt.date.slice(0, 10) : pt.date;
          const found = daysList.find((item) => item.date === ptDate);
          if (found) {
            found.completed += pt.completed ?? 0;
            found.created += pt.created ?? 0;
          }
        }
      }

      // Kiểm tra xem trong 7 ngày thực tế có hoạt động nào không
      const hasAnyActivity = daysList.some((d) => d.completed > 0 || d.created > 0);
      if (!hasAnyActivity) {
        return []; // Trả về mảng rỗng để hiển thị Empty State chuẩn mực
      }

      return daysList;
    }

    // 2. Chế độ 30 ngày: Hiển thị tóm tắt theo tuần, 4 tuần gần nhất
    if (range === '30d') {
      const now = new Date();
      const weeks: Array<{
        date: string;
        displayDate: string;
        tooltipLabel: string;
        startStr: string;
        endStr: string;
        completed: number;
        created: number;
      }> = [];

      for (let w = 3; w >= 0; w--) {
        const endD = new Date(now);
        endD.setDate(now.getDate() - w * 7);
        const startD = new Date(now);
        startD.setDate(now.getDate() - (w * 7 + 6));

        const startDay = String(startD.getDate()).padStart(2, '0');
        const startMonth = String(startD.getMonth() + 1).padStart(2, '0');
        const endDay = String(endD.getDate()).padStart(2, '0');
        const endMonth = String(endD.getMonth() + 1).padStart(2, '0');

        const startIso = startD.toISOString().slice(0, 10);
        const endIso = endD.toISOString().slice(0, 10);

        // Định dạng nhãn hiển thị: ví dụ "20 - 26/07" (cùng tháng) hoặc "27/07 - 02/08" (khác tháng)
        const displayDate =
          startMonth === endMonth
            ? `${startDay} - ${endDay}/${startMonth}`
            : `${startDay}/${startMonth} - ${endDay}/${endMonth}`;

        weeks.push({
          date: startIso,
          displayDate,
          tooltipLabel: `Tuần ${displayDate}`,
          startStr: startIso,
          endStr: endIso,
          completed: 0,
          created: 0,
        });
      }

      if (data && data.length > 0) {
        for (const pt of data) {
          const ptDate = pt.date.includes('T') ? pt.date.slice(0, 10) : pt.date;
          for (const week of weeks) {
            if (ptDate >= week.startStr && ptDate <= week.endStr) {
              week.completed += pt.completed ?? 0;
              week.created += pt.created ?? 0;
              break;
            }
          }
        }
      }

      const hasAnyActivity = weeks.some((w) => w.completed > 0 || w.created > 0);
      if (!hasAnyActivity) {
        return []; // Trả về mảng rỗng để hiển thị Empty State nếu không có dữ liệu
      }

      return weeks;
    }

    // 3. Chế độ Quý này: Hiển thị 3 tháng gần nhất tính đến thời điểm hiện tại
    if (range === 'quarter') {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed (ví dụ: tháng 9 là 8)

      const months: Array<{
        date: string;
        displayDate: string;
        tooltipLabel: string;
        monthKey: string; // YYYY-MM
        completed: number;
        created: number;
      }> = [];

      for (let m = 2; m >= 0; m--) {
        const targetDate = new Date(currentYear, currentMonth - m, 1);
        const y = targetDate.getFullYear();
        const mon = targetDate.getMonth() + 1;
        const monthKey = `${y}-${String(mon).padStart(2, '0')}`;
        const displayDate = `Thg ${mon}`;

        months.push({
          date: `${monthKey}-01`,
          displayDate,
          tooltipLabel: `Tháng ${mon}/${y}`,
          monthKey,
          completed: 0,
          created: 0,
        });
      }

      if (data && data.length > 0) {
        for (const pt of data) {
          const ptMonth = pt.date.includes('T') ? pt.date.slice(0, 7) : pt.date.slice(0, 7);
          for (const m of months) {
            if (ptMonth === m.monthKey) {
              m.completed += pt.completed ?? 0;
              m.created += pt.created ?? 0;
              break;
            }
          }
        }
      }

      const hasAnyActivity = months.some((m) => m.completed > 0 || m.created > 0);
      if (!hasAnyActivity) {
        return []; // Trả về mảng rỗng để hiển thị Empty State
      }

      return months;
    }

    return [];
  }, [data, range]);

  // Tính toán giới hạn trục Y tự động
  const maxY = useMemo(() => {
    if (chartData.length === 0) return 10;
    const maxVal = Math.max(...chartData.map((d) => Math.max(d.completed, d.created, 0)));
    return Math.max(10, Math.ceil((maxVal + 2) / 2) * 2);
  }, [chartData]);

  const handleFocusFilter = () => {
    const el = document.getElementById(filterSelectId);
    if (el) {
      el.focus();
      el.click();
    }
  };

  const isEmpty = chartData.length === 0;

  return (
    <QueryState
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      loadingFallback={
        <div className="flex h-[280px] items-center justify-center">
          <Spinner />
        </div>
      }
      errorTitle={t('dashboard:taskTrendChart.errorTitle')}
      errorDescription={t('dashboard:taskTrendChart.errorDescription')}
    >
      {isEmpty ? (
        <div className="flex h-[280px] flex-col items-center justify-center text-center px-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F4F6] text-[#6B7280] mb-3">
            <BarChartIcon className="h-6 w-6 stroke-[1.5]" />
          </div>
          <p className="text-[13px] text-[#6B7280] max-w-[320px] leading-relaxed">
            Chưa có dữ liệu trong khoảng thời gian này. Vui lòng chọn khoảng thời gian khác.
          </p>
          <button
            type="button"
            onClick={handleFocusFilter}
            className="mt-3.5 inline-flex items-center rounded-lg border border-[#1E3A8A] bg-white px-3 py-1.5 text-xs font-semibold text-[#1E3A8A] transition-colors hover:bg-[#EFF6FF] cursor-pointer shadow-2xs active:scale-[0.98]"
          >
            Chọn khoảng thời gian
          </button>
        </div>
      ) : (
        <div className="relative">
          {/* Annotation chú thích nhỏ ở góc phải trên của biểu đồ */}
          <div className="absolute right-2 -top-2 z-10 select-none">
            <span className="font-sans text-[11px] italic text-[#9CA3AF]">
              Dữ liệu chỉ hiển thị khi có phát sinh
            </span>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 20, right: 16, left: -10, bottom: 0 }}>
              {/* Grid line ngang & dọc nét đứt màu #F3F4F6 */}
              <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="#F3F4F6" />
              <XAxis
                dataKey="displayDate"
                tick={{ fill: '#6B7280', fontSize: 12, fontFamily: 'Roboto, sans-serif' }}
                axisLine={{ stroke: '#E5E7EB' }}
                tickLine={false}
                dy={8}
              />
              <YAxis
                domain={[0, maxY]}
                allowDecimals={false}
                tick={{ fill: '#6B7280', fontSize: 12, fontFamily: 'Roboto, sans-serif' }}
                axisLine={false}
                tickLine={false}
                width={34}
              />
              <Tooltip content={<BarChartTooltip />} cursor={{ fill: '#F9FAFB' }} />
              <Legend
                verticalAlign="bottom"
                wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }}
                content={() => (
                  <div className="flex items-center justify-center gap-6 pt-3 text-xs text-[#6B7280]">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
                      <span>Hoàn thành</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
                      <span>Được tạo mới</span>
                    </span>
                  </div>
                )}
              />

              {/* Cột Hoàn thành: #10B981, bo góc trên 4px. Với giá trị 0, vẽ dấu gạch ngang nhỏ #E5E7EB ở mức 0 */}
              <Bar
                dataKey="completed"
                name="Hoàn thành"
                fill="#10B981"
                radius={[4, 4, 0, 0]}
                maxBarSize={range === '7d' ? 24 : range === '30d' ? 32 : 40}
                shape={(props: any) => {
                  const { x, y, width, height, payload } = props;
                  if (payload && payload.completed === 0 && payload.created === 0) {
                    // Vẽ dấu gạch ngang nhỏ màu #E5E7EB ở mức 0 trên trục X
                    const dashWidth = Math.min(width, 18);
                    const dashX = x + (width - dashWidth) / 2;
                    return (
                      <line
                        x1={dashX}
                        y1={y}
                        x2={dashX + dashWidth}
                        y2={y}
                        stroke="#E5E7EB"
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                    );
                  }
                  if (height <= 0) return <path d="" />;
                  return (
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill="#10B981"
                      rx={4}
                      ry={4}
                    />
                  );
                }}
              >
                <LabelList
                  dataKey="completed"
                  position="top"
                  fill="#10B981"
                  fontSize={11}
                  fontWeight={600}
                  formatter={(val: any) => (Number(val) > 0 ? val : '')}
                />
              </Bar>

              {/* Cột Được tạo mới: #F59E0B, bo góc trên 4px */}
              <Bar
                dataKey="created"
                name="Được tạo mới"
                fill="#F59E0B"
                radius={[4, 4, 0, 0]}
                maxBarSize={range === '7d' ? 24 : range === '30d' ? 32 : 40}
                shape={(props: any) => {
                  const { x, y, width, height } = props;
                  if (height <= 0) return <path d="" />;
                  return (
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill="#F59E0B"
                      rx={4}
                      ry={4}
                    />
                  );
                }}
              >
                <LabelList
                  dataKey="created"
                  position="top"
                  fill="#F59E0B"
                  fontSize={11}
                  fontWeight={600}
                  formatter={(val: any) => (Number(val) > 0 ? val : '')}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </QueryState>
  );
}

