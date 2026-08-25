// Bang mau bieu do - lay tu dataviz skill (palette da duoc validate CVD-safe qua
// scripts/validate_palette.js). Chi dung mode light (ung dung nay chua co dark mode toggle).

/** Thu tu co dinh, KHONG xoay vong - gan theo vi tri chuoi (categorical identity). */
export const CATEGORICAL = [
  '#2a78d6', // 1 blue
  '#008300', // 2 green
  '#e87ba4', // 3 magenta
  '#eda100', // 4 yellow
  '#1baf7a', // 5 aqua
  '#eb6834', // 6 orange
  '#4a3aa7', // 7 violet
  '#e34948', // 8 red
] as const;

/** Thang mot-hue (blue) dung cho du lieu tuan tu / magnitude (vd cuong do hoat dong). */
export const SEQUENTIAL_BLUE = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];

/** Mau trang thai co dinh - khong dung lai cho series thong thuong. */
export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
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
