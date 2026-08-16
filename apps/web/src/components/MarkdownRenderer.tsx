import React, { useMemo } from 'react';
import { marked } from 'marked';

interface Props {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = '' }: Props) {
  const htmlContent = useMemo(() => {
    if (!content) return '';
    try {
      marked.setOptions({
        gfm: true,
        breaks: true,
      });
      return marked.parse(content);
    } catch {
      return content;
    }
  }, [content]);

  return (
    <div
      className={`markdown-body ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent as string }}
    />
  );
}
