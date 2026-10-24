// 24/10/2026: unit test AskQuestionDto - cau hoi chi gom khoang trang phai bi tu choi (400) TRUOC khi
// tru han ngach/goi LLM; cau hoi hop le duoc cat khoang trang 2 dau.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AskQuestionDto } from './ask-question.dto';

async function check(question: unknown) {
  const dto = plainToInstance(AskQuestionDto, { question });
  return { dto, errors: await validate(dto) };
}

describe('AskQuestionDto', () => {
  it.each(['   ', '\n\t  \n'])('chi gom khoang trang (%j) -> loi', async (question) => {
    const { errors } = await check(question);
    expect(errors.map((error) => error.property)).toEqual(['question']);
  });

  it('cat khoang trang 2 dau, giu nguyen noi dung (unicode/emoji)', async () => {
    const { dto, errors } = await check('  Xin chào 👋 今日は?  ');
    expect(errors).toEqual([]);
    expect(dto.question).toBe('Xin chào 👋 今日は?');
  });

  it('khong phai chuoi -> loi (khong bi Transform nuot mat)', async () => {
    const { errors } = await check(123);
    expect(errors.map((error) => error.property)).toEqual(['question']);
  });
});
