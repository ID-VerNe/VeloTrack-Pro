/**
 * 将骑行活动及经纬度坐标导出为标准 GPX 文件并触发浏览器下载
 */

/** XML 实体转义：标题等用户/AI 生成文本直接拼进 GPX 会被特殊字符破坏甚至注入 XML */
function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 文件名安全化：剔除路径分隔符与控制字符，防止非法下载文件名 */
function safeFileName(str: string): string {
  // 有意匹配控制字符区间以将其替换为下划线，禁用 no-control-regex 告警
  // eslint-disable-next-line no-control-regex
  return String(str).replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').trim().slice(0, 80) || 'ride';
}

export function exportRideAsGPX(ride: any, routeCoordinates: [number, number][]): void {
  if (!ride || routeCoordinates.length === 0) return;

  // 修复：title 来自用户输入或 AI 生成，原先未转义直接拼接，含 <>&" 字符会生成损坏的 GPX
  const safeTitle = escapeXml(ride.title || 'Cycling Activity');
  const startTime = ride.start_time ? new Date(ride.start_time).toISOString() : new Date().toISOString();

  const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="VeloTrack" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${safeTitle}</name>
    <time>${startTime}</time>
  </metadata>
  <trk>
    <name>${safeTitle}</name>
    <trkseg>
      ${routeCoordinates.map((c) => `<trkpt lat="${c[1]}" lon="${c[0]}"></trkpt>`).join('\n      ')}
    </trkseg>
  </trk>
</gpx>`;

  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(ride.title || 'ride')}_${ride.id}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
