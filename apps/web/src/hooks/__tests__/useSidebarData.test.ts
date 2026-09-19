import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSidebarData, INITIAL_SIDEBAR_PROFILE } from '../useSidebarData';
import * as riderService from '../../services/riderService';
import * as rideService from '../../services/rideService';

vi.mock('../../services/riderService', () => ({
  getRiderProfile: vi.fn(),
}));

vi.mock('../../services/rideService', () => ({
  getWeeklyStats: vi.fn(),
}));

describe('useSidebarData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes and fetches profile and weekly stats', async () => {
    vi.mocked(riderService.getRiderProfile).mockResolvedValue({
      ...INITIAL_SIDEBAR_PROFILE,
      name: 'VerNe Test',
      weight_kg: 72,
    } as any);

    vi.mocked(rideService.getWeeklyStats).mockResolvedValue({
      ridesCount: 42,
      goalPct: 85,
    });

    const { result } = renderHook(() => useSidebarData());

    await waitFor(() => {
      expect(result.current.profile.name).toBe('VerNe Test');
      expect(result.current.ridesCount).toBe(42);
      expect(result.current.goalPct).toBe(85);
    });
  });

  it('updates profile when profile-updated event is dispatched', async () => {
    let callCount = 0;
    vi.mocked(riderService.getRiderProfile).mockImplementation(async () => {
      callCount++;
      return {
        ...INITIAL_SIDEBAR_PROFILE,
        name: callCount === 1 ? 'Initial Rider' : 'Updated Rider',
      } as any;
    });

    vi.mocked(rideService.getWeeklyStats).mockResolvedValue({
      ridesCount: 10,
      goalPct: 50,
    });

    const { result } = renderHook(() => useSidebarData());

    await waitFor(() => {
      expect(result.current.profile.name).toBe('Initial Rider');
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('profile-updated'));
    });

    await waitFor(() => {
      expect(result.current.profile.name).toBe('Updated Rider');
    });
  });

  it('handles service errors gracefully without throwing', async () => {
    vi.mocked(riderService.getRiderProfile).mockRejectedValue(new Error('Profile error'));
    vi.mocked(rideService.getWeeklyStats).mockRejectedValue(new Error('Stats error'));

    const { result } = renderHook(() => useSidebarData());

    await act(async () => {
      await result.current.fetchProfile();
      await result.current.fetchRidesAndGoals();
    });

    expect(result.current.profile).toEqual(INITIAL_SIDEBAR_PROFILE);
    expect(result.current.ridesCount).toBe(0);
    expect(result.current.goalPct).toBe(0);
  });
});
