/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_WS_NOTIFICATION_URL: string;
  readonly VITE_WS_ANALYTICS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'xlsx' {
  export interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  }
  export function read(data: unknown, opts?: { type?: string }): WorkBook;
  export function writeFile(workbook: WorkBook, filename: string): void;
  export namespace utils {
    export function sheet_to_json<T = unknown>(sheet: unknown, opts?: { defval?: unknown }): T[];
    export function aoa_to_sheet(data: unknown[][]): unknown;
    export function book_new(): WorkBook;
    export function book_append_sheet(workbook: WorkBook, sheet: unknown, name?: string): void;
  }
}
