// 24/10/2026: unit test bo tach markdown nhe cho cau tra loi Chat bot (formatAnswer.ts).
import { describe, it, expect } from 'vitest';
import { parseAnswerBlocks, parseInline } from './formatAnswer';

describe('parseAnswerBlocks', () => {
  it('tach doan van, tieu de va danh sach gach dau dong (co long nhau)', () => {
    const content = [
      '### Ngày phép',
      'Theo [Quy-dinh.pdf]:',
      '',
      '* **Số ngày tối đa:** 2 ngày',
      '  * Áp dụng cho nhân viên chính thức',
      '- Đăng ký trước 17 giờ thứ Sáu',
      'Kết luận cuối.',
    ].join('\n');

    expect(parseAnswerBlocks(content)).toEqual([
      { kind: 'heading', text: 'Ngày phép' },
      { kind: 'paragraph', text: 'Theo [Quy-dinh.pdf]:' },
      {
        kind: 'list',
        items: [
          { depth: 0, text: '**Số ngày tối đa:** 2 ngày' },
          { depth: 1, text: 'Áp dụng cho nhân viên chính thức' },
          { depth: 0, text: 'Đăng ký trước 17 giờ thứ Sáu' },
        ],
      },
      { kind: 'paragraph', text: 'Kết luận cuối.' },
    ]);
  });

  it('dong bat dau bang **dam** KHONG bi hieu nham la gach dau dong', () => {
    expect(parseAnswerBlocks('**Lưu ý:** nội dung')).toEqual([{ kind: 'paragraph', text: '**Lưu ý:** nội dung' }]);
  });

  it('giu xuong dong trong cung 1 doan, bo dong trong thua', () => {
    expect(parseAnswerBlocks('Dòng 1\r\nDòng 2\n\n\n\nDòng 3')).toEqual([
      { kind: 'paragraph', text: 'Dòng 1\nDòng 2' },
      { kind: 'paragraph', text: 'Dòng 3' },
    ]);
  });
});

describe('parseInline', () => {
  it('tach chu dam va ma code, phan con lai giu nguyen dang text', () => {
    expect(parseInline('Trạng thái **DOING** (mã `ACTIVE`).')).toEqual([
      { kind: 'text', text: 'Trạng thái ' },
      { kind: 'bold', text: 'DOING' },
      { kind: 'text', text: ' (mã ' },
      { kind: 'code', text: 'ACTIVE' },
      { kind: 'text', text: ').' },
    ]);
  });

  it('noi dung giong HTML chi la text thuan (khong bi dien giai)', () => {
    expect(parseInline('<img src=x onerror=alert(1)>')).toEqual([{ kind: 'text', text: '<img src=x onerror=alert(1)>' }]);
  });
});
