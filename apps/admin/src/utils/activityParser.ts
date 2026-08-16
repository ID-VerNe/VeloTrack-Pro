import { XMLParser } from 'fast-xml-parser';
import gcoord from 'gcoord';
import { parseTCX } from './tcxParser';
import { 
  aggregateActivityData, 
  type ParsedTCX, 
  type TCXPoint 
} from './activityAggregator';

export type { ParsedTCX, TCXPoint };

/**
 * 解析 GPX XML 原始文本并提取轨迹数据
 */
export function parseGPX(xmlString: string, title: string = '骑行记录'): ParsedTCX {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true });
  const doc = parser.parse(xmlString);

  const gpx = doc.gpx;
  if (!gpx) throw new Error('Invalid GPX file: No <gpx> root element found.');

  const trk = Array.isArray(gpx.trk) ? gpx.trk[0] : gpx.trk;
  if (!trk) throw new Error('Invalid GPX file: No <trk> track element found.');

  const activityTitle = title || trk.name || trk.type || '骑行记录';

  const ext = trk.extensions || {};
  const totalTimeSeconds = parseFloat(ext.totalTime) || 0;
  const totalDistance = parseFloat(ext.totalDistance) || 0;
  const cumulativeClimb = parseFloat(ext.cumulativeClimb) || 0;
  const cumulativeDecrease = parseFloat(ext.cumulativeDecrease) || 0;

  let segments = trk.trkseg;
  if (!segments) throw new Error('No track segments found in GPX.');
  if (!Array.isArray(segments)) segments = [segments];

  const points: TCXPoint[] = [];

  for (const seg of segments) {
    let trkpts = seg.trkpt;
    if (!trkpts) continue;
    if (!Array.isArray(trkpts)) trkpts = [trkpts];

    for (const tp of trkpts) {
      if (!tp.time) continue;
      const pt: TCXPoint = { time: new Date(tp.time).getTime() };

      const latAttr = tp['@_lat'] || tp.lat;
      const lonAttr = tp['@_lon'] || tp.lon;

      if (latAttr && lonAttr) {
        const wgsLat = parseFloat(latAttr);
        const wgsLng = parseFloat(lonAttr);
        if (!isNaN(wgsLat) && !isNaN(wgsLng)) {
          const gcj = gcoord.transform([wgsLng, wgsLat], gcoord.WGS84, gcoord.GCJ02);
          pt.lng = Number(gcj[0].toFixed(6));
          pt.lat = Number(gcj[1].toFixed(6));
        }
      }

      if (tp.ele) {
        const ele = parseFloat(tp.ele);
        if (!isNaN(ele)) pt.altitude = ele;
      }

      // Check Garmin TrackPointExtension for hr/cad/speed
      if (tp.extensions?.TrackPointExtension) {
        const tpx = tp.extensions.TrackPointExtension;
        if (tpx.hr) pt.hr = parseInt(tpx.hr, 10);
        if (tpx.cad) pt.cadence = parseInt(tpx.cad, 10);
        if (tpx.speed) pt.speed = parseFloat(tpx.speed) * 3.6;
      }

      points.push(pt);
    }
  }

  return aggregateActivityData({
    title: activityTitle,
    points,
    explicitElapsedTimeSeconds: totalTimeSeconds,
    explicitDistanceMeters: totalDistance,
    cumulativeClimbMeters: cumulativeClimb,
    cumulativeDecreaseMeters: cumulativeDecrease,
  });
}

/**
 * 统一文件解析入口，自动识别 GPX / TCX 格式
 */
export function parseActivityFile(content: string, fileName: string): ParsedTCX {
  const cleanTitle = fileName.replace(/\.(tcx|gpx)$/i, '');
  if (content.includes('<gpx') || fileName.toLowerCase().endsWith('.gpx')) {
    return parseGPX(content, cleanTitle);
  }
  return parseTCX(content, cleanTitle);
}
