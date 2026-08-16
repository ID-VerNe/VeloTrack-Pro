/**
 * 将骑行活动及经纬度坐标导出为标准 GPX 文件并触发浏览器下载
 */
export function exportRideAsGPX(ride: any, routeCoordinates: [number, number][]): void {
  if (!ride || routeCoordinates.length === 0) return;

  const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="VeloTrack" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${ride.title || 'Cycling Activity'}</name>
    <time>${new Date(ride.start_time).toISOString()}</time>
  </metadata>
  <trk>
    <name>${ride.title || 'Cycling Activity'}</name>
    <trkseg>
      ${routeCoordinates.map((c) => `<trkpt lat="${c[1]}" lon="${c[0]}"></trkpt>`).join('\n      ')}
    </trkseg>
  </trk>
</gpx>`;

  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${ride.title || 'ride'}_${ride.id}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
