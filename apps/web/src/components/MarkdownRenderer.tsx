import React, { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface Props {
  content: string;
  className?: string;
}

/**
 * Markdown 渲染组件。
 * 安全修复：AI 返回的内容属于不可信输入，marked 本身不消毒 HTML，
 * 原先直接 dangerouslySetInnerHTML 存在存储型 XSS 风险
 * （如 AI 输出被注入 `<img onerror>` / `<script>` 片段）。
 * 现在统一经 DOMPurify 消毒后再注入，并显式禁止任何脚本与事件属性。
 */
export default function MarkdownRenderer({ content, className = '' }: Props) {
  const htmlContent = useMemo(() => {
    if (!content) return '';
    try {
      marked.setOptions({
        gfm: true,
        breaks: true,
      });
      const rawHtml = marked.parse(content) as string;
      return DOMPurify.sanitize(rawHtml, {
        // 允许常规排版标签与属性，禁止脚本类内容
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
        FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'formaction'],
        // 禁止任何自动跳转到危险协议的链接
        ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|data:image\/(?:png|jpeg|gif|webp);base64,|#|\/)/i,
      });
    } catch {
      // 解析失败时降级为纯文本（React 自动转义，无 XSS 风险）
      return content.replace(/[<>&"']/g, (ch) =>
        ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[ch] || ch)
      );
    }
  }, [content]);

  return (
    <div
      className={`markdown-body ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}
