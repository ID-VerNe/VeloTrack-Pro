// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import MarkdownRenderer from '../MarkdownRenderer';

/**
 * XSS 消毒回归测试。
 * 修复前：marked 输出未经消毒直接 dangerouslySetInnerHTML 注入，
 * AI 返回内容若含恶意 HTML（img onerror / script / javascript: 链接）会被直接执行。
 */

function render(content: string): string {
  return renderToStaticMarkup(React.createElement(MarkdownRenderer, { content }));
}

describe('MarkdownRenderer XSS 消毒', () => {
  it('正常 markdown 正常渲染（标题/加粗/列表）', () => {
    const html = render('# 标题\n\n**加粗**\n\n- 列表项');
    expect(html).toContain('<h1>标题</h1>');
    expect(html).toContain('<strong>加粗</strong>');
    expect(html).toContain('<li>列表项</li>');
  });

  it('空内容渲染为空', () => {
    expect(render('')).toBe('<div class="markdown-body "></div>');
  });

  it('【核心回归】script 标签被移除', () => {
    const html = render('正常文本\n\n<script>alert("xss")</script>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert("xss")</script>');
  });

  it('【核心回归】img onerror 事件属性被剥离', () => {
    const html = render('!<x>](x)\n\n<img src=x onerror="alert(1)">');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('alert(1)');
  });

  it('【核心回归】iframe/object/embed 被移除', () => {
    const html = render('<iframe src="https://evil.example"></iframe><object data="x"></object>');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<object');
  });

  it('【核心回归】javascript: 协议链接被拦截', () => {
    const html = render('[点击领奖](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });

  it('正常 https 链接保留可点击', () => {
    const html = render('[官网](https://example.com)');
    expect(html).toContain('href="https://example.com"');
  });

  it('style 标签被移除（防止 CSS 注入窃取/破坏界面）', () => {
    const html = render('<style>body{display:none}</style>');
    expect(html).not.toContain('<style');
  });

  it('内联事件属性（onclick/onmouseover/onload）被剥离', () => {
    const html = render('<div onclick="alert(1)" onmouseover="alert(2)" onload="alert(3)">文本</div>');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('onmouseover');
    expect(html).not.toContain('onload');
  });
});
