import { useMemo } from 'react';
import { parseAnswerBlocks, parseInline } from '../utils/formatAnswer';

// 24/10/2026: render cau tra loi cua Chat bot tu cac khoi da tach (utils/formatAnswer.ts) - moi noi dung
// deu la text node React (tu escape), khong co duong nao chen HTML tho vao DOM.
function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((token, index) => {
        if (token.kind === 'bold') return <strong key={index} className="font-semibold">{token.text}</strong>;
        if (token.kind === 'code') {
          return (
            <code key={index} className="rounded-[4px] bg-bg-subtle px-1 font-mono text-[12px]">
              {token.text}
            </code>
          );
        }
        return <span key={index}>{token.text}</span>;
      })}
    </>
  );
}

export function ChatbotAnswer({ content }: { content: string }) {
  const blocks = useMemo(() => parseAnswerBlocks(content), [content]);
  return (
    <div className="space-y-2 break-words">
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          return (
            <p key={index} className="font-semibold">
              <InlineText text={block.text} />
            </p>
          );
        }
        if (block.kind === 'list') {
          return (
            <ul key={index} className="space-y-1">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex gap-2" style={{ paddingLeft: `${item.depth * 14}px` }}>
                  <span aria-hidden className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
                  <span className="min-w-0">
                    <InlineText text={item.text} />
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            <InlineText text={block.text} />
          </p>
        );
      })}
    </div>
  );
}
