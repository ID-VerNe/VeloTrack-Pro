import { useState, useEffect, useCallback } from 'react';
import type { RiderProfile, RiderMemory } from '../types/rider';
import { updateRiderProfile, upsertRiderMemory, deleteRiderMemory } from '../services/riderService';

export const INITIAL_RIDER_PROFILE: RiderProfile = {
  name: 'VerNe Yuu',
  gender: 'male',
  weight_kg: 75,
  height_cm: 173,
  max_hr: 188,
  resting_hr: 55,
  ftp_watts: 165,
  current_bike: '大行 P8',
  chainring: 46,
  cogs: [11, 13, 15, 17, 19, 21, 24, 28],
  wheel_spec: '20x2.0',
  tires: '马牌 Contact Urban 2.0 轮胎 (75-80 psi)',
  bike_weight_kg: 11.5,
  custom_specs: '{"pedals": "平踏", "wheelset": "20寸406"}',
  primary_goal: '',
};

export type ProfileDrawerTab = 'manual' | 'interview' | 'memories' | 'gateway';

export function useRiderProfileDrawer(isOpen: boolean) {
  const [activeTab, setActiveTab] = useState<ProfileDrawerTab>('manual');
  const [profile, setProfile] = useState<RiderProfile>(INITIAL_RIDER_PROFILE);
  const [memories, setMemories] = useState<RiderMemory[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchProfileAndMemories = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/rider/profile');
      const data = await res.json();
      if (data.profile) {
        let parsedCogs = data.profile.cogs;
        if (typeof parsedCogs === 'string' && parsedCogs.trim() !== '') {
          try {
            parsedCogs = JSON.parse(parsedCogs);
          } catch (_) {
            parsedCogs = INITIAL_RIDER_PROFILE.cogs;
          }
        }
        if (!Array.isArray(parsedCogs)) {
          parsedCogs = INITIAL_RIDER_PROFILE.cogs;
        }
        setProfile({ ...data.profile, cogs: parsedCogs });
      }
      if (data.memories) setMemories(data.memories);
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSaveError(null);
      fetchProfileAndMemories();
    }
  }, [isOpen, fetchProfileAndMemories]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await updateRiderProfile(profile);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      console.error(err);
      setSaveError(err.message || '保存档案失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMemory = async (category: string, content: string) => {
    const slugKey = `manual_${category}_${Date.now().toString().slice(-6)}`;
    try {
      await upsertRiderMemory(category, slugKey, content, 'manual', 4);
      await fetchProfileAndMemories();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMemory = async (id: number) => {
    try {
      await deleteRiderMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return {
    activeTab,
    setActiveTab,
    profile,
    setProfile,
    memories,
    isSaving,
    saveSuccess,
    saveError,
    fetchProfileAndMemories,
    handleSaveProfile,
    handleAddMemory,
    handleDeleteMemory,
  };
}
