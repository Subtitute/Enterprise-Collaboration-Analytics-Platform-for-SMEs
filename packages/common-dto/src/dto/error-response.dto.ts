/** Dinh dang loi chuan cho toan bo API - Technical_Spec.md muc 7. */
export interface ErrorResponseDto {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path?: string;
}
