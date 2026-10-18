import { BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '@app/common-dto';

/**
 * Anh xa query-param `range` sang lua chon bang continuous aggregate + khoang thoi gian SQL.
 * Tach thanh ham thuan (pure function) de unit test doc lap voi Nest DI/DB - Technical_Spec.md
 * muc 10 (unit test bat buoc cho "tinh toan KPI cua Analytics").
 *
 * GET /analytics/task-trend?range=7d|30d|quarter (Wireframe.md muc 3, muc 7):
 * - 7d/30d  -> continuous aggregate `daily_task_summary` (rollup theo ngay).
 * - quarter -> continuous aggregate `weekly_project_progress` (rollup theo tuan, du lieu dai han hon).
 */
export type TaskTrendRange = '7d' | '30d' | 'quarter';
export type DocumentActivityRange = '7d' | '30d';

export interface TaskTrendConfig {
  table: 'daily_task_summary' | 'weekly_project_progress';
  /** Truyen truc tiep vao `now() - $n::interval` - vd '7 days', '3 months'. */
  sinceInterval: string;
}

const TASK_TREND_CONFIG: Record<TaskTrendRange, TaskTrendConfig> = {
  '7d': { table: 'daily_task_summary', sinceInterval: '7 days' },
  '30d': { table: 'daily_task_summary', sinceInterval: '30 days' },
  quarter: { table: 'weekly_project_progress', sinceInterval: '3 months' },
};

export function resolveTaskTrendConfig(range: string): TaskTrendConfig {
  const config = TASK_TREND_CONFIG[range as TaskTrendRange];
  if (!config) {
    throw new BadRequestException({
      message: `Khoang thoi gian khong hop le: '${range}' (chi chap nhan 7d, 30d, quarter)`,
      errorCode: ERROR_CODES.INVALID_RANGE_WITH_QUARTER,
      errorParams: { range },
    });
  }
  return config;
}

const DOCUMENT_ACTIVITY_INTERVAL: Record<DocumentActivityRange, string> = {
  '7d': '7 days',
  '30d': '30 days',
};

export function resolveDocumentActivityInterval(range: string): string {
  const interval = DOCUMENT_ACTIVITY_INTERVAL[range as DocumentActivityRange];
  if (!interval) {
    throw new BadRequestException({
      message: `Khoang thoi gian khong hop le: '${range}' (chi chap nhan 7d, 30d)`,
      errorCode: ERROR_CODES.INVALID_RANGE_NO_QUARTER,
      errorParams: { range },
    });
  }
  return interval;
}

// 15/10/2026: xu huong ban hang (Inventory Service, Technical_Spec.md muc 22) - mirror CHINH XAC
// DocumentActivityRange/resolveDocumentActivityInterval o tren (chi 7d/30d, khong co "quarter" -
// chi co 1 continuous aggregate daily_product_sales_summary, khong co ban rollup theo tuan nhu
// weekly_project_progress, dung tinh than toi gian ClaudeRule.md muc 8 cho tinh nang moi nay).
export type ProductSalesTrendRange = '7d' | '30d';

const PRODUCT_SALES_TREND_INTERVAL: Record<ProductSalesTrendRange, string> = {
  '7d': '7 days',
  '30d': '30 days',
};

export function resolveProductSalesTrendInterval(range: string): string {
  const interval = PRODUCT_SALES_TREND_INTERVAL[range as ProductSalesTrendRange];
  if (!interval) {
    throw new BadRequestException({
      message: `Khoang thoi gian khong hop le: '${range}' (chi chap nhan 7d, 30d)`,
      errorCode: ERROR_CODES.INVALID_RANGE_NO_QUARTER,
      errorParams: { range },
    });
  }
  return interval;
}
