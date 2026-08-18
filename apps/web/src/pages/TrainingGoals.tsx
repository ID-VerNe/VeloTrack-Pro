import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Edit2, RefreshCw } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { computeGoalStatsFromRides } from '../utils/goalCalculations';

import GoalTargetCards from '../components/goals/GoalTargetCards';
import CoachPlanSection from '../components/goals/CoachPlanSection';
import GoalEvolutionTimeline from '../components/goals/GoalEvolutionTimeline';
import AchievementsGrid from '../components/goals/AchievementsGrid';
import EditGoalsModal, { type UserTargets } from '../components/goals/EditGoalsModal';
import type { GoalMilestone } from '../types/rider';

const DEFAULT_TARGETS: UserTargets = {
  weeklyDistanceKm: 60.0,
  targetAvgSpeedKmh: 18.0,
  monthlyDistanceKm: 180.0,
  annualDistanceKm: 1000.0,
  coachNotes: '换档至46/17T（第3档），绿灯路段锁90rpm巡航23km/h，红灯停车挂轻档准备起步。',
};

export default function TrainingGoals() {
  const navigate = useNavigate();
  const [rides, setRides] = useState<any[]>([]);
  const [targets, setTargets] = useState<UserTargets>(DEFAULT_TARGETS);
  const [milestones, setMilestones] = useState<GoalMilestone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditingTargets, setIsEditingTargets] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [ridesRes, goalsRes] = await Promise.all([
        fetch('/api/rides').then((r) => r.json()),
        fetch('/api/ai/goals').then((r) => r.json()),
      ]);

      if (ridesRes.rides) setRides(ridesRes.rides);
      if (goalsRes.goals) {
        const g = goalsRes.goals;
        setTargets({
          weeklyDistanceKm: g.weekly_distance_km || 60.0,
          targetAvgSpeedKmh: g.target_avg_speed_kmh || 18.0,
          monthlyDistanceKm: g.monthly_distance_km || 180.0,
          annualDistanceKm: g.annual_distance_km || 1000.0,
          coachNotes: g.coach_notes || '',
        });
      }
      if (goalsRes.milestones) {
        setMilestones(goalsRes.milestones);
      }
    } catch (err) {
      console.error(err);
      setLoadError('训练目标数据加载失败，请检查后端服务');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveTargets = async (updatedTargets: UserTargets) => {
    await fetch('/api/ai/goals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weekly_distance_km: updatedTargets.weeklyDistanceKm,
        target_avg_speed_kmh: updatedTargets.targetAvgSpeedKmh,
        monthly_distance_km: updatedTargets.monthlyDistanceKm,
        annual_distance_km: updatedTargets.annualDistanceKm,
        coach_notes: updatedTargets.coachNotes,
      }),
    });
    setTargets(updatedTargets);
    await fetchData();
  };

  const handleAskCoachForGoals = () => {
    navigate(
      '/ai-coach?prompt=' +
        encodeURIComponent(
          '请结合我近期的实战双均速与踩踏做功数据，帮我评估当前目标并量身定制下阶段的进阶课表'
        )
    );
  };

  const realStats = useMemo(() => computeGoalStatsFromRides(rides), [rides]);

  return (
    <div className="h-screen w-screen bg-[#F8FAFC] font-sans flex text-slate-900 overflow-hidden select-none">
      <Sidebar />

      <main className="flex-1 h-full flex flex-col bg-white overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="h-16 px-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/90 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <Target className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 leading-tight">
                训练目标与进阶课表
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                以巡航 20km/h 与 50km 耐力为核心导向的科学量化目标
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsEditingTargets(true)}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer flex items-center space-x-1.5"
          >
            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
            <span>调整目标参数</span>
          </button>
        </header>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 [scrollbar-width:none]">
          {isLoading ? (
            <div className="h-96 flex items-center justify-center text-slate-500 text-xs font-medium" role="status">
              <RefreshCw className="w-4 h-4 animate-spin mr-2 text-sky-600" />
              正在同步训练目标与达成数据...
            </div>
          ) : loadError ? (
            <div className="h-96 flex flex-col items-center justify-center bg-rose-50/60 rounded-2xl border border-rose-100 text-xs font-medium space-y-3" role="alert">
              <p className="text-rose-700">{loadError}</p>
              <button
                onClick={fetchData}
                className="px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-slate-800 transition-all cursor-pointer active:scale-95"
              >
                重新加载
              </button>
            </div>
          ) : (
            <>
              {/* 1. Progress Metric Cards Grid */}
              <GoalTargetCards targets={targets} realStats={realStats} />

              {/* 2. Coach Strategy & 4-Week Plan */}
              <CoachPlanSection
                coachNotes={targets.coachNotes}
                onAskCoach={handleAskCoachForGoals}
              />

              {/* 3. Goal Evolution Milestones Timeline */}
              <GoalEvolutionTimeline
                milestones={milestones}
              />

              {/* 4. Milestones & Achievements Grid */}
              <AchievementsGrid achievements={realStats.achievements} />
            </>
          )}
        </div>
      </main>

      {/* Edit Goals Modal */}
      <EditGoalsModal
        isOpen={isEditingTargets}
        initialValues={targets}
        onClose={() => setIsEditingTargets(false)}
        onSave={handleSaveTargets}
      />
    </div>
  );
}
