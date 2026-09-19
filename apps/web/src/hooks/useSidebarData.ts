import { useState, useEffect, useCallback } from 'react';
import type { RiderProfile } from '../types/rider';
import { getRiderProfile } from '../services/riderService';

export const INITIAL_SIDEBAR_PROFILE: RiderProfile = {
  name: '',
  gender: 'male',
  weight_kg: 75,
  height_cm: 175,
  max_hr: 188,
  resting_hr: 60,
  ftp_watts: 200,
  current_bike: '',
  bike_specs: '',
  injuries_notes: '',
  primary_goal: '',
};

export function useSidebarData() {
  const [profile, setProfile] = useState<RiderProfile>(INITIAL_SIDEBAR_PROFILE);
  const [ridesCount, setRidesCount] = useState(0);
  const [goalPct, setGoalPct] = useState(0);

  const fetchProfile = useCallback(async () => {
    try {
      const p = await getRiderProfile();
      setProfile(p as unknown as RiderProfile);
    } catch {}
  }, []);

  const fetchRidesAndGoals = useCallback(async () => {
    try {
      const { getWeeklyStats } = await import('../services/rideService');
      const stats = await getWeeklyStats();
      if (stats) {
        setRidesCount(stats.ridesCount);
        setGoalPct(stats.goalPct);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchRidesAndGoals();

    const handleProfileUpdated = () => {
      fetchProfile();
    };
    window.addEventListener('profile-updated', handleProfileUpdated);
    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdated);
    };
  }, [fetchProfile, fetchRidesAndGoals]);

  return {
    profile,
    ridesCount,
    goalPct,
    fetchProfile,
    fetchRidesAndGoals,
  };
}
