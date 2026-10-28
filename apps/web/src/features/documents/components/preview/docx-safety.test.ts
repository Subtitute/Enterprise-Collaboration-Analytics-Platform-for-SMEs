// 27/10/2026: test lam sach ket qua docx-preview truoc khi gan vao DOM.
import { hardenDocxOutput } from './docx-safety';

describe('hardenDocxOutput', () => {
  it('keeps only http/https/mailto links (opened safely) and in-document anchors', () => {
    const root = document.createElement('div');
    root.innerHTML = [
      '<a id="web" href="https://example.com/a">web</a>',
      '<a id="mail" href="mailto:hr@example.com">mail</a>',
      '<a id="anchor" href="#_Toc1">toc</a>',
      '<a id="js" href="javascript:alert(1)">js</a>',
      '<a id="jsUpper" href=" JaVaScRiPt:alert(1)">js2</a>',
      '<a id="data" href="data:text/html,<script>alert(1)</script>">data</a>',
      '<a id="relative" href="../admin">rel</a>',
      '<a id="empty" href="">empty</a>',
    ].join('');
    hardenDocxOutput(root);
    const a = (id: string) => root.querySelector(`#${id}`) as HTMLAnchorElement;

    expect(a('web').getAttribute('href')).toBe('https://example.com/a');
    expect(a('web').target).toBe('_blank');
    expect(a('web').rel).toBe('noopener noreferrer');
    expect(a('mail').getAttribute('rel')).toBe('noopener noreferrer');
    expect(a('anchor').getAttribute('href')).toBe('#_Toc1');
    for (const id of ['js', 'jsUpper', 'data', 'relative', 'empty']) {
      expect(a(id).hasAttribute('href')).toBe(false);
    }
  });

  it('removes embedded frames and scripts (altChunk and similar)', () => {
    const fragment = document.createDocumentFragment();
    const section = document.createElement('section');
    section.innerHTML = '<p>ok</p><iframe srcdoc="<script>alert(1)</script>"></iframe><object data="x"></object>';
    fragment.appendChild(section);
    fragment.appendChild(document.createElement('script'));
    hardenDocxOutput(fragment);
    expect(fragment.querySelector('iframe, object, script')).toBeNull();
    expect(fragment.querySelector('p')?.textContent).toBe('ok');
  });
});
