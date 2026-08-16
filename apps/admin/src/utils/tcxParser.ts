import { XMLParser } from 'fast-xml-parser';
import gcoord from 'gcoord';
import { 
  aggregateActivityData, 
  type TCXPoint, 
  type ParsedTCX 
} from './activityAggregator';

export type { TCXPoint, ParsedTCX };

/**
 * 解析 TCX XML 原始文本并提取轨迹数据
 */
export function parseTCX(xmlString: string, title: string = '骑行记录'): ParsedTCX {
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
  const doc = parser.parse(xmlString);

  const activity = doc.TrainingCenterDatabase?.Activities?.Activity;
  if (!activity) throw new Error('Invalid TCX file: No Activity found.');

  const points: TCXPoint[] = [];
  let laps = activity.Lap;
  if (!Array.isArray(laps)) laps = [laps];

  let totalCalories = 0;
  let lapDistanceMeters = 0;
  let lapTotalTimeSeconds = 0;

  for (const lap of laps) {
    if (lap.Calories) {
      const cal = parseInt(lap.Calories, 10);
      if (!isNaN(cal)) totalCalories += cal;
    }
    if (lap.DistanceMeters) {
      const dist = parseFloat(lap.DistanceMeters);
      if (!isNaN(dist)) lapDistanceMeters += dist;
    }
    if (lap.TotalTimeSeconds) {
      const t = parseFloat(lap.TotalTimeSeconds);
      if (!isNaN(t)) lapTotalTimeSeconds += t;
    }

    let tracks = lap.Track;
    if (!tracks) continue;
    if (!Array.isArray(tracks)) tracks = [tracks];

    for (const track of tracks) {
      let tps = track.Trackpoint;
      if (!tps) continue;
      if (!Array.isArray(tps)) tps = [tps];

      for (const tp of tps) {
        if (!tp.Time) continue;
        const pt: TCXPoint = { time: new Date(tp.Time).getTime() };

        if (tp.Position) {
          const wgsLat = parseFloat(tp.Position.LatitudeDegrees);
          const wgsLng = parseFloat(tp.Position.LongitudeDegrees);
          if (!isNaN(wgsLat) && !isNaN(wgsLng)) {
            // Transform WGS-84 to GCJ-02 for China map calibration
            const gcj = gcoord.transform([wgsLng, wgsLat], gcoord.WGS84, gcoord.GCJ02);
            pt.lng = Number(gcj[0].toFixed(6));
            pt.lat = Number(gcj[1].toFixed(6));
          }
        }

        if (tp.AltitudeMeters) {
          const alt = parseFloat(tp.AltitudeMeters);
          if (!isNaN(alt)) pt.altitude = alt;
        }

        if (tp.DistanceMeters) {
          const dist = parseFloat(tp.DistanceMeters);
          if (!isNaN(dist)) pt.distance = dist;
        }

        if (tp.HeartRateBpm?.Value) {
          const hr = parseInt(tp.HeartRateBpm.Value, 10);
          if (!isNaN(hr)) pt.hr = hr;
        }

        if (tp.Cadence) {
          const cad = parseInt(tp.Cadence, 10);
          if (!isNaN(cad)) pt.cadence = cad;
        }

        if (tp.Extensions?.TPX?.Speed) {
          const spd = parseFloat(tp.Extensions.TPX.Speed) * 3.6; // m/s -> km/h
          if (!isNaN(spd)) pt.speed = spd;
        }

        points.push(pt);
      }
    }
  }

  return aggregateActivityData({
    title,
    points,
    explicitElapsedTimeSeconds: lapTotalTimeSeconds,
    explicitDistanceMeters: lapDistanceMeters,
    explicitCalories: totalCalories,
  });
}
