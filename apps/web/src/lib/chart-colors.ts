// Bang mau bieu do - lay tu dataviz skill (palette da duoc validate CVD-safe qua
// scripts/validate_palette.js). Chi dung mode light (ung dung nay chua co dark mode toggle).

/** Thu tu co dinh, KHONG xoay vong - gan theo vi tri chuoi (categorical identity). */
export const CATEGORICAL = [
  '#4f46e5', // 1 indigo-600 (mau chu dao)
  '#0d9488', // 2 teal-600
  '#8b5cf6', // 3 violet-500
  '#f59e0b', // 4 amber-500
  '#6366f1', // 5 indigo-500 (danh cho shares/tai lieu)
  '#f97316', // 6 orange-500
  '#06b6d4', // 7 cyan-500
  '#e11d48', // 8 rose-600
] as const;

/** Thang mot-hue (indigo/slate) dung cho du lieu tuan tu / magnitude (vd cuong do hoat dong). */
export const SEQUENTIAL_BLUE = ['#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#3730a3'];

/** Mau trang thai co dinh - khong dung lai cho series thong thuong. */
export const STATUS = {
  good: '#10b981',
  warning: '#f59e0b',
  serious: '#f97316',
  critical: '#ef4444',
};

export const CHART_INK = {
  primary: '#0b0b0b',
  secondary: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  baseline: '#c3c2b7',
  surface: '#fcfcfb',
};

/** TODO = Xám trung tính (slate-500 #64748b), DOING = Xanh dương (blue-500 #3b82f6), DONE = Xanh lá (emerald-500 #10b981). */
export const TASK_STATUS_COLOR: Record<string, string> = {
  TODO: '#64748b', // slate-500 (Cần làm)
  DOING: '#3b82f6', // blue-500 (Đang làm)
  DONE: '#10b981', // emerald-500 (Hoàn thành)
};

// 25/07/2026: xoa TASK_STATUS_BADGE_VARIANT - export chet, xac nhan qua grep khong co noi nao
// trong src import ten nay ca.
