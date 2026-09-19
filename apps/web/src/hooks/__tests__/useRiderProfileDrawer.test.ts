import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRiderProfileDrawer, INITIAL_RIDER_PROFILE } from '../useRiderProfileDrawer';
import * as riderService from '../../services/riderService';

vi.mock('../../services/riderService', () => ({
  updateRiderProfile: vi.fn(),
  upsertRiderMemory: vi.fn(),
  deleteRiderMemory: vi.fn(),
}));

describe('useRiderProfileDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          profile: { ...INITIAL_RIDER_PROFILE, name: 'Test Rider', weight_kg: 70 },
          memories: [{ id: 1, category: 'health', content: '膝盖良好' }],
        }),
      })
    );
  });

  it('initializes with default values and does not fetch if isOpen is false', () => {
    const { result } = renderHook(() => useRiderProfileDrawer(false));

    expect(result.current.activeTab).toBe('manual');
    expect(result.current.profile).toEqual(INITIAL_RIDER_PROFILE);
    expect(result.current.memories).toEqual([]);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.saveSuccess).toBe(false);
    expect(result.current.saveError).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches profile and memories when isOpen is true', async () => {
    const { result } = renderHook(() => useRiderProfileDrawer(true));

    await waitFor(() => {
      expect(result.current.profile.name).toBe('Test Rider');
      expect(result.current.memories).toHaveLength(1);
    });
  });

  it('switches tabs correctly', () => {
    const { result } = renderHook(() => useRiderProfileDrawer(false));

    act(() => {
      result.current.setActiveTab('memories');
    });
    expect(result.current.activeTab).toBe('memories');

    act(() => {
      result.current.setActiveTab('gateway');
    });
    expect(result.current.activeTab).toBe('gateway');
  });

  it('handles save profile successfully', async () => {
    vi.mocked(riderService.updateRiderProfile).mockResolvedValue({} as any);

    const { result } = renderHook(() => useRiderProfileDrawer(true));

    await waitFor(() => expect(result.current.profile.name).toBe('Test Rider'));

    await act(async () => {
      await result.current.handleSaveProfile();
    });

    expect(riderService.updateRiderProfile).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test Rider' })
    );
    expect(result.current.saveSuccess).toBe(true);
    expect(result.current.isSaving).toBe(false);
  });

  it('handles save profile failure', async () => {
    vi.mocked(riderService.updateRiderProfile).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useRiderProfileDrawer(true));

    await waitFor(() => expect(result.current.profile.name).toBe('Test Rider'));

    await act(async () => {
      await result.current.handleSaveProfile();
    });

    expect(result.current.saveError).toBe('Network error');
    expect(result.current.saveSuccess).toBe(false);
    expect(result.current.isSaving).toBe(false);
  });

  it('handles adding and deleting memory', async () => {
    vi.mocked(riderService.upsertRiderMemory).mockResolvedValue({} as any);
    vi.mocked(riderService.deleteRiderMemory).mockResolvedValue({} as any);

    const { result } = renderHook(() => useRiderProfileDrawer(true));

    await waitFor(() => expect(result.current.memories).toHaveLength(1));

    await act(async () => {
      await result.current.handleAddMemory('goal', '坚持每周骑行');
    });

    expect(riderService.upsertRiderMemory).toHaveBeenCalledWith(
      'goal',
      expect.stringContaining('manual_goal_'),
      '坚持每周骑行',
      'manual',
      4
    );

    await act(async () => {
      await result.current.handleDeleteMemory(1);
    });

    expect(riderService.deleteRiderMemory).toHaveBeenCalledWith(1);
    expect(result.current.memories).toHaveLength(0);
  });
});
