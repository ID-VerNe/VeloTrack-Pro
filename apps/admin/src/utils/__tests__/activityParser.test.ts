import { describe, it, expect } from 'vitest';
import gcoord from 'gcoord';
import { parseGPX, parseActivityFile } from '../activityParser';

// 含命名空间、lat/lon 属性、TrackPointExtension(hr/cad/speed) 与 trk 级 extensions 的真实 GPX 样例
const GPX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Garmin Connect" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>周末晨骑</name>
    <type>cycling</type>
    <extensions>
      <totalTime>3600</totalTime>
      <totalDistance>20000</totalDistance>
      <cumulativeClimb>120</cumulativeClimb>
      <cumulativeDecrease>80</cumulativeDecrease>
    </extensions>
    <trkseg>
      <trkpt lat="30.0" lon="120.0">
        <ele>100</ele>
        <time>2024-01-01T00:00:00Z</time>
        <extensions>
          <TrackPointExtension>
            <hr>150</hr>
            <cad>85</cad>
            <speed>8.5</speed>
          </TrackPointExtension>
        </extensions>
      </trkpt>
      <trkpt lat="30.001" lon="120.001">
        <ele>110</ele>
        <time>2024-01-01T00:05:00Z</time>
        <extensions>
          <TrackPointExtension>
            <hr>160</hr>
            <cad>90</cad>
            <speed>9.0</speed>
          </TrackPointExtension>
        </extensions>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe('parseGPX 基础解析', () => {
  it('解析 lat/lon 属性、海拔与 TrackPointExtension 的 hr/cad/speed', () => {
    const r = parseGPX(GPX_XML, '周末晨骑');
    expect(r.points.length).toBe(2);
    expect(r.points[0].time).toBe(Date.parse('2024-01-01T00:00:00Z'));
    expect(r.points[0].altitude).toBe(100);
    expect(r.points[0].hr).toBe(150);
    expect(r.points[0].cadence).toBe(85);
    expect(r.points[0].speed).toBeCloseTo(8.5 * 3.6, 6); // m/s → km/h
    expect(r.points[1].speed).toBeCloseTo(9.0 * 3.6, 6);
  });

  it('坐标经 WGS84→GCJ02 转换，与 gcoord 独立计算结果一致', () => {
    const r = parseGPX(GPX_XML, 't');
    const expected0 = gcoord.transform([120.0, 30.0], gcoord.WGS84, gcoord.GCJ02);
    expect(r.points[0].lng).toBeCloseTo(expected0[0], 6);
    expect(r.points[0].lat).toBeCloseTo(expected0[1], 6);
    const expected1 = gcoord.transform([120.001, 30.001], gcoord.WGS84, gcoord.GCJ02);
    expect(r.points[1].lng).toBeCloseTo(expected1[0], 6);
    expect(r.points[1].lat).toBeCloseTo(expected1[1], 6);
  });

  it('trk 级 extensions 的 totalTime/totalDistance/cumulativeClimb/cumulativeDecrease 生效', () => {
    const r = parseGPX(GPX_XML, 't');
    expect(r.elapsed_time_seconds).toBe(3600);
    expect(r.distance_meters).toBe(20000);
    expect(r.total_ascent_meters).toBe(120);
    expect(r.total_descent_meters).toBe(80);
  });

  it('传入标题时优先使用传入标题，否则回退到 trk.name', () => {
    const withTitle = parseGPX(GPX_XML, '自定义标题');
    expect(withTitle.title).toBe('自定义标题');
    const fallback = parseGPX(GPX_XML, '');
    expect(fallback.title).toBe('周末晨骑');
  });

  it('未传标题且无 trk.name 时回退到 trk.type', () => {
    const xml = GPX_XML.replace('<name>周末晨骑</name>', '');
    const r = parseGPX(xml, '');
    expect(r.title).toBe('cycling');
  });

  it('无 trk.name/type 且未传标题时使用默认标题', () => {
    const xml = GPX_XML.replace('<name>周末晨骑</name>', '').replace('<type>cycling</type>', '');
    const r = parseGPX(xml, '');
    expect(r.title).toBe('骑行记录');
  });
});

describe('parseGPX 错误处理', () => {
  it('无 <gpx> 根元素时报错', () => {
    expect(() => parseGPX('<foo><bar/></foo>', 't')).toThrow(
      'Invalid GPX file: No <gpx> root element found.'
    );
  });

  it('有 <gpx> 根但无 <trk> 时报错', () => {
    // 注意：空的 <gpx></gpx> 会被 fast-xml-parser 解析为空串从而走"无根元素"分支，
    // 因此这里用含非 trk 子元素的 gpx 来触发"无 trk"分支
    expect(() => parseGPX('<gpx version="1.1"><metadata><name>m</name></metadata></gpx>', 't')).toThrow(
      'Invalid GPX file: No <trk> track element found.'
    );
  });

  it('有 <trk> 但无 <trkseg> 时报错', () => {
    expect(() => parseGPX('<gpx><trk><name>x</name></trk></gpx>', 't')).toThrow(
      'No track segments found in GPX.'
    );
  });
});

describe('parseGPX 多段与异常点', () => {
  it('多个 trkseg 的点按顺序合并', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="30.0" lon="120.0">
        <time>2024-01-01T00:00:00Z</time>
      </trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="30.0" lon="120.001">
        <time>2024-01-01T00:01:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;
    const r = parseGPX(xml, '多段');
    expect(r.points.length).toBe(2);
    expect(r.points[1].time).toBe(Date.parse('2024-01-01T00:01:00Z'));
  });

  it('trkseg 中无 trkpt 或 trkpt 无 time 时跳过该点', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="30.0" lon="120.0">
        <time>2024-01-01T00:00:00Z</time>
      </trkpt>
      <trkpt lat="30.0" lon="120.001">
        <ele>5</ele>
      </trkpt>
    </trkseg>
    <trkseg/>
  </trk>
</gpx>`;
    const r = parseGPX(xml, '跳过异常点');
    expect(r.points.length).toBe(1);
  });

  it('lat/lon 缺失或非法时不写入经纬度，但保留时间点', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="abc" lon="120.0">
        <time>2024-01-01T00:00:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;
    const r = parseGPX(xml, '非法坐标');
    expect(r.points.length).toBe(1);
    expect(r.points[0].lat).toBeUndefined();
    expect(r.points[0].lng).toBeUndefined();
  });
});

describe('parseActivityFile 自动识别格式', () => {
  it('.gpx 文件名按 GPX 解析，标题剥离扩展名', () => {
    const r = parseActivityFile(GPX_XML, 'morning_ride.gpx');
    expect(r.title).toBe('morning_ride');
    expect(r.points.length).toBe(2);
  });

  it('.tcx 文件名按 TCX 解析，标题剥离扩展名', () => {
    const tcxXml = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Biking">
      <Id>2024-01-01T00:00:00Z</Id>
      <Lap StartTime="2024-01-01T00:00:00Z">
        <TotalTimeSeconds>1200</TotalTimeSeconds>
        <DistanceMeters>10000</DistanceMeters>
        <Calories>200</Calories>
        <Track>
          <Trackpoint>
            <Time>2024-01-01T00:00:00Z</Time>
            <Position><LatitudeDegrees>30.0</LatitudeDegrees><LongitudeDegrees>120.0</LongitudeDegrees></Position>
          </Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
    const r = parseActivityFile(tcxXml, 'afternoon_ride.tcx');
    expect(r.title).toBe('afternoon_ride');
    expect(r.points.length).toBe(1);
    expect(r.calories).toBe(200);
  });

  it('内容含 <gpx 时即使文件名是 .tcx 也按 GPX 解析', () => {
    const r = parseActivityFile(GPX_XML, 'weird.tcx');
    expect(r.title).toBe('weird');
    expect(r.points.length).toBe(2);
  });

  it('大写扩展名也能剥离', () => {
    const r = parseActivityFile(GPX_XML, 'RIDE.GPX');
    expect(r.title).toBe('RIDE');
  });
});

describe('parseGPX 边界分支补充', () => {
  it('多个 <trk> 时取第一个 <trk> 解析', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>第一段</name>
    <trkseg>
      <trkpt lat="30.0" lon="120.0">
        <time>2024-01-01T00:00:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
  <trk>
    <name>第二段</name>
    <trkseg>
      <trkpt lat="31.0" lon="121.0">
        <time>2024-01-01T00:01:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;
    const r = parseGPX(xml, '多轨');
    // 只取第一个 trk 的点
    expect(r.points.length).toBe(1);
    expect(r.points[0].time).toBe(Date.parse('2024-01-01T00:00:00Z'));
  });

  it('trkpt 用 <lat>/<lon> 子元素（无属性）时也能解析坐标', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt>
        <lat>30.0</lat>
        <lon>120.0</lon>
        <time>2024-01-01T00:00:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;
    const r = parseGPX(xml, '子元素坐标');
    expect(r.points.length).toBe(1);
    const expected = gcoord.transform([120.0, 30.0], gcoord.WGS84, gcoord.GCJ02);
    expect(r.points[0].lng).toBeCloseTo(expected[0], 6);
    expect(r.points[0].lat).toBeCloseTo(expected[1], 6);
  });

  it('<ele> 值为非数字时不写入 altitude', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="30.0" lon="120.0">
        <ele>abc</ele>
        <time>2024-01-01T00:00:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;
    const r = parseGPX(xml, '异常海拔');
    expect(r.points[0].altitude).toBeUndefined();
  });

  it('TrackPointExtension 存在但 hr/cad/speed 缺失时不写入对应字段', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="30.0" lon="120.0">
        <time>2024-01-01T00:00:00Z</time>
        <extensions>
          <TrackPointExtension>
            <hr></hr>
          </TrackPointExtension>
        </extensions>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;
    const r = parseGPX(xml, '缺扩展字段');
    expect(r.points[0].hr).toBeUndefined();
    expect(r.points[0].cadence).toBeUndefined();
    expect(r.points[0].speed).toBeUndefined();
  });
});
