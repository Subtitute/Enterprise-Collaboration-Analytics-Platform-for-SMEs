import { BadRequestException } from '@nestjs/common';
import { resolveDocumentActivityInterval, resolveTaskTrendConfig } from './range.util';

/**
 * Unit test cho logic anh xa range query-param -> SQL interval/table-choice
 * (Technical_Spec.md muc 10 - unit test bat buoc cho "tinh toan KPI cua Analytics").
 */
describe('range.util', () => {
  describe('resolveTaskTrendConfig', () => {
    it('7d -> daily_task_summary, interval 7 days', () => {
      expect(resolveTaskTrendConfig('7d')).toEqual({
        table: 'daily_task_summary',
        sinceInterval: '7 days',
      });
    });

    it('30d -> daily_task_summary, interval 30 days', () => {
      expect(resolveTaskTrendConfig('30d')).toEqual({
        table: 'daily_task_summary',
        sinceInterval: '30 days',
      });
    });

    it('quarter -> weekly_project_progress, interval 3 months', () => {
      expect(resolveTaskTrendConfig('quarter')).toEqual({
        table: 'weekly_project_progress',
        sinceInterval: '3 months',
      });
    });

    it('nem BadRequestException voi range khong hop le', () => {
      expect(() => resolveTaskTrendConfig('1y')).toThrow(BadRequestException);
    });

    it('nem BadRequestException voi chuoi rong', () => {
      expect(() => resolveTaskTrendConfig('')).toThrow(BadRequestException);
    });
  });

  describe('resolveDocumentActivityInterval', () => {
    it('7d -> 7 days', () => {
      expect(resolveDocumentActivityInterval('7d')).toBe('7 days');
    });

    it('30d -> 30 days', () => {
      expect(resolveDocumentActivityInterval('30d')).toBe('30 days');
    });

    it('nem BadRequestException voi range khong hop le (vd quarter khong duoc ho tro o day)', () => {
      expect(() => resolveDocumentActivityInterval('quarter')).toThrow(BadRequestException);
    });
  });
});
