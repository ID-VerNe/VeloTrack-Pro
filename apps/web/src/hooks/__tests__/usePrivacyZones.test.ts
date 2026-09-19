import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePrivacyZones } from '../usePrivacyZones';
import * as adminApiClient from '../../utils/activity/adminApiClient';

describe('usePrivacyZones Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads privacy zones on mount and activates them all by default', async () => {
    const mockZones = [
      { id: 'zone-1', name: '家', lat: 22.5, lng: 114.0, radius_meters: 500 },
      { id: 'zone-2', name: '公司', lat: 22.6, lng: 114.1, radius_meters: 600 },
    ];
    vi.spyOn(adminApiClient, 'fetchPrivacyZones').mockResolvedValue(mockZones as any);
    vi.spyOn(adminApiClient, 'getAdminToken').mockReturnValue('mock-token');

    const { result } = renderHook(() => usePrivacyZones());

    // Initially
    expect(result.current.adminToken).toBe('mock-token');

    // Wait for loadZones
    await act(async () => {
      await result.current.loadZones();
    });

    expect(result.current.zones).toHaveLength(2);
    expect(result.current.activeZoneIds.has('zone-1')).toBe(true);
    expect(result.current.activeZoneIds.has('zone-2')).toBe(true);
    expect(result.current.zonesError).toBeNull();
  });

  it('toggles active zone ID in and out of set', async () => {
    vi.spyOn(adminApiClient, 'fetchPrivacyZones').mockResolvedValue([
      { id: 'z1', name: 'A', lat: 22, lng: 114, radius_meters: 300 },
    ] as any);

    const { result } = renderHook(() => usePrivacyZones());

    await act(async () => {
      await result.current.loadZones();
    });

    expect(result.current.activeZoneIds.has('z1')).toBe(true);

    act(() => {
      result.current.handleToggleZone('z1');
    });
    expect(result.current.activeZoneIds.has('z1')).toBe(false);

    act(() => {
      result.current.handleToggleZone('z1');
    });
    expect(result.current.activeZoneIds.has('z1')).toBe(true);
  });

  it('handles load error safely', async () => {
    vi.spyOn(adminApiClient, 'fetchPrivacyZones').mockRejectedValue(new Error('Network offline'));

    const { result } = renderHook(() => usePrivacyZones());

    await act(async () => {
      await result.current.loadZones();
    });

    expect(result.current.zones).toEqual([]);
    expect(result.current.activeZoneIds.size).toBe(0);
    expect(result.current.zonesError).toBe('Network offline');
  });
});
