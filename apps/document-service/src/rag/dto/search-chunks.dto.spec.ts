// 24/10/2026 (fix kiem thu RAG): unit test validate body POST /files/search-chunks - mirror
// ValidationPipe({ transform: true }) cua main.ts (plainToInstance roi validate).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchChunksDto } from './search-chunks.dto';

async function errorsOf(body: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(plainToInstance(SearchChunksDto, body));
  return errors.map((e) => e.property);
}

describe('SearchChunksDto', () => {
  it('query chi gom khoang trang/xuong dong -> bi tu choi (truoc day lot qua, ton 1 lan goi Gemini)', async () => {
    expect(await errorsOf({ query: '   ' })).toEqual(['query']);
    expect(await errorsOf({ query: '\n\t\n' })).toEqual(['query']);
  });

  it('query hop le duoc trim', async () => {
    const dto = plainToInstance(SearchChunksDto, { query: '  phong hop tang 5  ' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.query).toBe('phong hop tang 5');
  });

  it('topK: 1..10 so nguyen, chuoi so duoc chuyen kieu', async () => {
    expect(await errorsOf({ query: 'a', topK: 0 })).toEqual(['topK']);
    expect(await errorsOf({ query: 'a', topK: 11 })).toEqual(['topK']);
    expect(await errorsOf({ query: 'a', topK: 'abc' })).toEqual(['topK']);
    expect(await errorsOf({ query: 'a', topK: '3' })).toEqual([]);
  });
});
