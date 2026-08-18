// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportRideAsGPX } from '../gpxExport';

/**
 * GPX 导出 XML 转义回归测试。
 * 修复前：ride.title（用户输入或 AI 生成）未转义直接拼进 GPX XML，
 * 含 <>&"' 时会生成格式损坏的文件，甚至注入任意 XML 结构。
 */

let capturedBlob: Blob | null = null;

beforeEach(() => {
  capturedBlob = null;
  // jsdom 未实现 createObjectURL，手动 stub 并捕获 Blob 以便读取内容
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:mock';
    }),
    revokeObjectURL: vi.fn(),
  });
});

async function getGpxContent(ride: any, coords: [number, number][]): Promise<string> {
  exportRideAsGPX(ride, coords);
  expect(capturedBlob).not.toBeNull();
  return await capturedBlob!.text();
}

describe('exportRideAsGPX XML 转义', () => {
  const coords: [number, number][] = [
    [120.0, 30.0],
    [120.001, 30.001],
  ];

  it('【核心回归】标题含 XML 特殊字符时被正确转义，文件结构完好', async () => {
    const gpx = await getGpxContent(
      { id: 'r1', title: '黎明<"夜骑"&坡\'">>', start_time: 1700000000000 },
      coords
    );
    // 实体形式存在
    expect(gpx).toContain('&lt;');
    expect(gpx).toContain('&quot;');
    expect(gpx).toContain('&apos;');
    expect(gpx).toContain('&amp;');
    // 原始字符不出现在 <name> 中（未被转义的 < 会破坏 XML 结构）
    const nameMatch = gpx.match(/<name>([\s\S]*?)<\/name>/);
    expect(nameMatch).not.toBeNull();
    expect(nameMatch![1]).not.toMatch(/[<>"']/);
  });

  it('正常标题原样输出', async () => {
    const gpx = await getGpxContent({ id: 'r2', title: '周末晨骑', start_time: 1700000000000 }, coords);
    expect(gpx).toContain('<name>周末晨骑</name>');
  });

  it('trackpoint 经纬度正确写入（lat/lng 不互换）', async () => {
    const gpx = await getGpxContent({ id: 'r3', title: 't', start_time: 1700000000000 }, coords);
    expect(gpx).toContain('<trkpt lat="30" lon="120"></trkpt>');
    expect(gpx).toContain('<trkpt lat="30.001" lon="120.001"></trkpt>');
  });

  it('缺少时间字段时使用当前时间兜底，不抛异常', async () => {
    const gpx = await getGpxContent({ id: 'r4', title: 't' }, coords);
    expect(gpx).toMatch(/<time>\d{4}-\d{2}-\d{2}T/);
  });

  it('无坐标时不触发下载', () => {
    expect(() => exportRideAsGPX({ id: 'r5', title: 't' }, [])).not.toThrow();
    expect(capturedBlob).toBeNull();
  });
});
