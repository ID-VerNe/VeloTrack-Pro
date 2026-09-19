package com.velotrack.sync

import com.velotrack.sync.core.*
import com.velotrack.sync.data.GeoPoint
import com.velotrack.sync.data.PrivacyZone
import com.velotrack.sync.data.RideUploadPayload
import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream

class CoreEngineTest {

    @Test
    fun testWgs84ToGcj02() {
        // 测试坐标: 30.0, 120.0
        val gcj = GeoCalculations.wgs84ToGcj02(30.0, 120.0)
        // 确保纠偏后有实际偏移且在合理范围内 (中国境内约几百米)
        assertTrue(gcj.first != 30.0)
        assertTrue(gcj.second != 120.0)
        assertTrue(Math.abs(gcj.first - 30.0) < 0.05)
        assertTrue(Math.abs(gcj.second - 120.0) < 0.05)
    }

    @Test
    fun testHaversineDistance() {
        // 同一点距离为 0
        val d0 = GeoCalculations.getHaversineDistanceMeters(30.0, 120.0, 30.0, 120.0)
        assertEquals(0.0, d0, 0.001)

        // 经度相隔 1 度的赤道距离约 111.3 km
        val dEq = GeoCalculations.getHaversineDistanceMeters(0.0, 0.0, 0.0, 1.0)
        assertTrue(dEq > 111000 && dEq < 112000)
    }

    @Test
    fun testPolylineEncoder() {
        // 编码一组简单点
        val points = listOf(
            Pair(38.5, -120.2),
            Pair(40.7, -120.95),
            Pair(43.252, -126.453)
        )
        val encoded = PolylineEncoder.encode(points)
        assertEquals("_p~iF~ps|U_ulLnnqC_mqNvxq`@", encoded)
    }

    @Test
    fun testPrivacyScrubber() {
        // 构造位于 (30.0, 120.0) 半径 500 米的隐私圈
        val zone = PrivacyZone(
            id = "z1",
            name = "Home",
            latitude = 30.0,
            longitude = 120.0,
            radiusMeters = 500.0
        )

        // 点 1: 圈内点 (30.0001, 120.0001)，距离圆心十几米
        // 点 2: 圈边缓冲内点 (30.004, 120.004)，触发起点安全保护 (500m + 300m = 800m 范围内)
        // 点 3: 安全远点 (30.05, 120.05)，距离圆心数公里
        // 点 4: 安全远点 (30.06, 120.06)
        val points = listOf(
            GeoPoint(time = 1000L, lat = 30.0001, lng = 120.0001),
            GeoPoint(time = 2000L, lat = 30.004, lng = 120.004),
            GeoPoint(time = 3000L, lat = 30.05, lng = 120.05),
            GeoPoint(time = 4000L, lat = 30.06, lng = 120.06)
        )

        val dummyPayload = RideUploadPayload(
            id = "1000",
            title = "Test",
            startTime = 1000L,
            endTime = 4000L,
            elapsedTimeSeconds = 3,
            movingTimeSeconds = 3,
            distanceMeters = 8000,
            maxSpeedKmh = 25.0,
            avgSpeedKmh = 20.0,
            totalAscentMeters = 10,
            totalDescentMeters = 5,
            maxAltitudeMeters = 50,
            avgHeartRate = 140,
            maxHeartRate = 160,
            avgCadence = 80,
            maxCadence = 90
        )

        val (scrubbedPayload, scrubbedPoints) = PrivacyScrubber.scrub(
            dummyPayload,
            points,
            listOf(zone)
        )

        // 圈内与起点缓冲点经纬度应被清除为 null
        assertNull(scrubbedPoints[0].lat)
        assertNull(scrubbedPoints[0].lng)
        assertNull(scrubbedPoints[1].lat)
        assertNull(scrubbedPoints[1].lng)

        // 圈外远点经纬度保持保留
        assertNotNull(scrubbedPoints[2].lat)
        assertNotNull(scrubbedPoints[2].lng)
        assertNotNull(scrubbedPoints[3].lat)
        assertNotNull(scrubbedPoints[3].lng)

        // 起点坐标应自动修正为第一个安全点 (点 3)
        assertEquals(30.05, scrubbedPayload.startLat!!, 0.0001)
        assertEquals(120.05, scrubbedPayload.startLng!!, 0.0001)
    }

    @Test
    fun testTcxParser() {
        val tcxSample = """<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Biking">
      <Id>2024-05-01T10:00:00Z</Id>
      <Lap StartTime="2024-05-01T10:00:00Z">
        <TotalTimeSeconds>120</TotalTimeSeconds>
        <DistanceMeters>1000</DistanceMeters>
        <Calories>45</Calories>
        <Track>
          <Trackpoint>
            <Time>2024-05-01T10:00:00Z</Time>
            <Position>
              <LatitudeDegrees>23.1291</LatitudeDegrees>
              <LongitudeDegrees>113.2644</LongitudeDegrees>
            </Position>
            <AltitudeMeters>25.0</AltitudeMeters>
            <HeartRateBpm><Value>135</Value></HeartRateBpm>
            <Cadence>80</Cadence>
            <Extensions>
              <TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
                <Speed>6.0</Speed>
              </TPX>
            </Extensions>
          </Trackpoint>
          <Trackpoint>
            <Time>2024-05-01T10:01:00Z</Time>
            <Position>
              <LatitudeDegrees>23.1310</LatitudeDegrees>
              <LongitudeDegrees>113.2660</LongitudeDegrees>
            </Position>
            <AltitudeMeters>30.0</AltitudeMeters>
            <HeartRateBpm><Value>155</Value></HeartRateBpm>
            <Cadence>85</Cadence>
            <Extensions>
              <TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
                <Speed>8.0</Speed>
              </TPX>
            </Extensions>
          </Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>"""

        val (payload, points) = TcxParser.parse(ByteArrayInputStream(tcxSample.toByteArray(Charsets.UTF_8)), "天河夜骑")

        assertEquals("天河夜骑", payload.title)
        assertEquals(2, points.size)
        assertEquals(120L, payload.elapsedTimeSeconds)
        assertEquals(1000L, payload.distanceMeters)
        assertEquals(5L, payload.totalAscentMeters) // 30 - 25 = 5m 爬升
        assertEquals(145, payload.avgHeartRate) // (135 + 155) / 2 = 145
        assertEquals(155, payload.maxHeartRate)
        assertEquals(82, payload.avgCadence) // (80 + 85) / 2 = 82
        assertEquals(85, payload.maxCadence)
        assertEquals(45L, payload.calories)
        assertNotNull(payload.summaryPolyline)
    }
}
