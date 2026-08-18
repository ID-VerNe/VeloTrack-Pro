import { describe, it, expect } from 'vitest';
import gcoord from 'gcoord';
import { parseTCX } from '../tcxParser';

// 构造含命名空间、多 Lap、多 Track/Trackpoint 的真实 TCX 样例
const TCX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
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
            <Position>
              <LatitudeDegrees>30.0</LatitudeDegrees>
              <LongitudeDegrees>120.0</LongitudeDegrees>
            </Position>
            <AltitudeMeters>100</AltitudeMeters>
            <DistanceMeters>0</DistanceMeters>
            <HeartRateBpm><Value>150</Value></HeartRateBpm>
            <Cadence>85</Cadence>
            <Extensions>
              <TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
                <Speed>8.5</Speed>
              </TPX>
            </Extensions>
          </Trackpoint>
          <Trackpoint>
            <Time>2024-01-01T00:05:00Z</Time>
            <AltitudeMeters>110</AltitudeMeters>
          </Trackpoint>
          <Trackpoint>
            <Position>
              <LatitudeDegrees>30.1</LatitudeDegrees>
              <LongitudeDegrees>120.1</LongitudeDegrees>
            </Position>
            <AltitudeMeters>120</AltitudeMeters>
          </Trackpoint>
        </Track>
      </Lap>
      <Lap StartTime="2024-01-01T00:20:00Z">
        <TotalTimeSeconds>600</TotalTimeSeconds>
        <DistanceMeters>5000</DistanceMeters>
        <Calories>300</Calories>
        <Track>
          <Trackpoint>
            <Time>2024-01-01T00:20:00Z</Time>
            <Position>
              <LatitudeDegrees>31.0</LatitudeDegrees>
              <LongitudeDegrees>121.0</LongitudeDegrees>
            </Position>
            <AltitudeMeters>130</AltitudeMeters>
            <HeartRateBpm><Value>160</Value></HeartRateBpm>
            <Cadence>90</Cadence>
            <Extensions>
              <TPX>
                <Speed>9.0</Speed>
              </TPX>
            </Extensions>
          </Trackpoint>
        </Track>
      </Lap>
      <Lap StartTime="2024-01-01T00:30:00Z">
        <TotalTimeSeconds>300</TotalTimeSeconds>
        <Calories>100</Calories>
      </Lap>
      <Lap StartTime="2024-01-01T00:35:00Z">
        <Calories>50</Calories>
        <Track>
          <Trackpoint/>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

describe('parseTCX 基础校验', () => {
  it('没有 Activity 节点时抛出错误', () => {
    const xml = `<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"></TrainingCenterDatabase>`;
    expect(() => parseTCX(xml, '测试')).toThrow('Invalid TCX file: No Activity found.');
  });

  it('完全没有 TCX 根结构时抛出错误', () => {
    expect(() => parseTCX('<foo><bar/></foo>', '测试')).toThrow('Invalid TCX file: No Activity found.');
  });
});

describe('parseTCX 多 Lap 聚合', () => {
  it('累加各 Lap 的 Calories / DistanceMeters / TotalTimeSeconds，合并全部 Trackpoint', () => {
    const r = parseTCX(TCX_XML, '晨间骑行');
    expect(r.title).toBe('晨间骑行');
    // 四个 Lap 的卡路里：200+300+100+50
    expect(r.calories).toBe(650);
    // 距离：10000+5000（未提供 per-point distance 时取 Lap 累计）
    expect(r.distance_meters).toBe(15000);
    // 时间：1200+600+300
    expect(r.elapsed_time_seconds).toBe(2100);

    // 有效点：Lap1 tp1、tp2（tp3 无 Time 被跳过）+ Lap2 tp1 = 3 个
    expect(r.points.length).toBe(3);
    expect(r.points[0].time).toBe(Date.parse('2024-01-01T00:00:00Z'));
    expect(r.points[1].time).toBe(Date.parse('2024-01-01T00:05:00Z'));
    expect(r.points[2].time).toBe(Date.parse('2024-01-01T00:20:00Z'));
  });

  it('坐标经 WGS84→GCJ02 转换，与 gcoord 独立计算结果一致', () => {
    const r = parseTCX(TCX_XML, 't');
    const expected0 = gcoord.transform([120.0, 30.0], gcoord.WGS84, gcoord.GCJ02);
    expect(r.points[0].lng).toBeCloseTo(expected0[0], 6);
    expect(r.points[0].lat).toBeCloseTo(expected0[1], 6);
    const expected2 = gcoord.transform([121.0, 31.0], gcoord.WGS84, gcoord.GCJ02);
    expect(r.points[2].lng).toBeCloseTo(expected2[0], 6);
    expect(r.points[2].lat).toBeCloseTo(expected2[1], 6);
  });

  it('解析海拔、心率、踏频与扩展速度（m/s → km/h）', () => {
    const r = parseTCX(TCX_XML, 't');
    expect(r.points[0].altitude).toBe(100);
    expect(r.points[0].hr).toBe(150);
    expect(r.points[0].cadence).toBe(85);
    expect(r.points[0].speed).toBeCloseTo(8.5 * 3.6, 6); // 30.6 km/h
    expect(r.points[2].hr).toBe(160);
    expect(r.points[2].cadence).toBe(90);
    expect(r.points[2].speed).toBeCloseTo(9.0 * 3.6, 6); // 32.4 km/h
    expect(r.max_heart_rate).toBe(160);
    expect(r.avg_heart_rate).toBe(155); // (150+160)/2
    expect(r.max_cadence).toBe(90);
    expect(r.avg_cadence).toBe(88); // Math.round((85+90)/2)
    expect(r.max_altitude_meters).toBe(130);
    expect(r.max_speed_kmh).toBe(32.4);
  });

  it('DistanceMeters 为 0 时该字段不写入点（falsy 分支）', () => {
    const r = parseTCX(TCX_XML, 't');
    // Lap1 tp1 的 DistanceMeters=0 → 不写入
    expect(r.points[0].distance).toBeUndefined();
  });

  it('缺 Position 的点保留但无经纬度；start 取第一个有效 GPS 点', () => {
    const r = parseTCX(TCX_XML, 't');
    expect(r.points[1].lat).toBeUndefined();
    expect(r.points[1].lng).toBeUndefined();
    const expected = gcoord.transform([120.0, 30.0], gcoord.WGS84, gcoord.GCJ02);
    expect(r.start_lat).toBeCloseTo(expected[1], 6);
    expect(r.start_lng).toBeCloseTo(expected[0], 6);
  });
});

describe('parseTCX 单 Lap / Trackpoint 自带距离', () => {
  it('单个 Lap、单个 Track、单个 Trackpoint（对象而非数组）也能解析', () => {
    const xml = `<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
      <Activities>
        <Activity Sport="Running">
          <Id>2024-01-02T00:00:00Z</Id>
          <Lap StartTime="2024-01-02T00:00:00Z">
            <TotalTimeSeconds>60</TotalTimeSeconds>
            <DistanceMeters>250</DistanceMeters>
            <Calories>10</Calories>
            <Track>
              <Trackpoint>
                <Time>2024-01-02T00:00:00Z</Time>
                <Position>
                  <LatitudeDegrees>30.0</LatitudeDegrees>
                  <LongitudeDegrees>120.0</LongitudeDegrees>
                </Position>
                <AltitudeMeters>100</AltitudeMeters>
                <DistanceMeters>250</DistanceMeters>
                <HeartRateBpm><Value>140</Value></HeartRateBpm>
                <Cadence>80</Cadence>
              </Trackpoint>
            </Track>
          </Lap>
        </Activity>
      </Activities>
    </TrainingCenterDatabase>`;
    const r = parseTCX(xml, '单圈跑步');
    expect(r.points.length).toBe(1);
    // per-point DistanceMeters 优先于 Lap 累计
    expect(r.points[0].distance).toBe(250);
    expect(r.distance_meters).toBe(250);
    expect(r.calories).toBe(10);
    expect(r.elapsed_time_seconds).toBe(60);
  });

  it('单个 Lap 含多个 Track 时合并解析（Track 为数组分支）', () => {
    const xml = `<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
      <Activities>
        <Activity Sport="Biking">
          <Id>2024-01-03T00:00:00Z</Id>
          <Lap StartTime="2024-01-03T00:00:00Z">
            <TotalTimeSeconds>120</TotalTimeSeconds>
            <DistanceMeters>500</DistanceMeters>
            <Calories>20</Calories>
            <Track>
              <Trackpoint>
                <Time>2024-01-03T00:00:00Z</Time>
                <Position><LatitudeDegrees>30.0</LatitudeDegrees><LongitudeDegrees>120.0</LongitudeDegrees></Position>
              </Trackpoint>
            </Track>
            <Track>
              <Trackpoint>
                <Time>2024-01-03T00:01:00Z</Time>
                <Position><LatitudeDegrees>30.0</LatitudeDegrees><LongitudeDegrees>120.001</LongitudeDegrees></Position>
              </Trackpoint>
            </Track>
          </Lap>
        </Activity>
      </Activities>
    </TrainingCenterDatabase>`;
    const r = parseTCX(xml, '双 Track');
    expect(r.points.length).toBe(2);
    expect(r.points[1].time).toBe(Date.parse('2024-01-03T00:01:00Z'));
  });
});

describe('parseTCX 字段值为非数字时容错', () => {
  // 覆盖各字段存在但值无法解析为数字（NaN）的分支，以及缺失 Calories 的 Lap
  const BAD_VALUES_XML = `<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
    <Activities>
      <Activity Sport="Biking">
        <Id>2024-01-05T00:00:00Z</Id>
        <Lap StartTime="2024-01-05T00:00:00Z">
          <Calories>abc</Calories>
          <DistanceMeters>xyz</DistanceMeters>
          <TotalTimeSeconds>notnum</TotalTimeSeconds>
          <Track>
            <Trackpoint>
              <Time>2024-01-05T00:00:00Z</Time>
              <Position>
                <LatitudeDegrees>abc</LatitudeDegrees>
                <LongitudeDegrees>def</LongitudeDegrees>
              </Position>
              <AltitudeMeters>abc</AltitudeMeters>
              <DistanceMeters>def</DistanceMeters>
              <HeartRateBpm><Value>xyz</Value></HeartRateBpm>
              <Cadence>xyz</Cadence>
              <Extensions>
                <TPX><Speed>abc</Speed></TPX>
              </Extensions>
            </Trackpoint>
          </Track>
        </Lap>
        <Lap StartTime="2024-01-05T00:10:00Z">
          <!-- 无 Calories / DistanceMeters / TotalTimeSeconds / Track -->
        </Lap>
      </Activity>
    </Activities>
  </TrainingCenterDatabase>`;

  it('非数字的 Calories/DistanceMeters/TotalTimeSeconds 被忽略，缺失字段的 Lap 也跳过', () => {
    const r = parseTCX(BAD_VALUES_XML, '异常值 TCX');
    // 两个 Lap 的数值字段全部无效 → 均为 0
    expect(r.calories).toBe(0);
    expect(r.distance_meters).toBe(0);
    // 只有第一个 Lap 有有效 Trackpoint；时间范围差为 0 → 兜底 1 秒
    expect(r.elapsed_time_seconds).toBe(1);
    expect(r.points.length).toBe(1);
  });

  it('经纬度/海拔/距离/心率/踏频/速度字段值为非数字时不写入对应属性', () => {
    const r = parseTCX(BAD_VALUES_XML, '异常值 TCX');
    const pt = r.points[0];
    expect(pt.lat).toBeUndefined();
    expect(pt.lng).toBeUndefined();
    expect(pt.altitude).toBeUndefined();
    expect(pt.distance).toBeUndefined();
    expect(pt.hr).toBeUndefined();
    expect(pt.cadence).toBeUndefined();
    expect(pt.speed).toBeUndefined();
  });
});
