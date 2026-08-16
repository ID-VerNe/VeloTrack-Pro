export interface RiderProfile {
  id?: number;
  name: string;
  gender: 'male' | 'female';
  weight_kg: number;
  height_cm: number;
  max_hr: number;
  resting_hr: number;
  ftp_watts: number;
  current_bike: string;
  gear_ratio?: string;
  tires?: string;
  bike_weight_kg?: number;
  bike_specs: string;
  custom_specs?: string | Record<string, any>;
  injuries_notes: string;
  primary_goal: string;
  updated_at?: number;
}

export interface RiderMemory {
  id: number;
  category: 'health' | 'gear' | 'habit' | 'preference' | 'physiology' | 'goal' | 'coaching' | string;
  memory_key: string;
  content: string;
  source: 'coach' | 'manual' | 'auto_extracted' | 'interview' | string;
  importance?: number;
  is_active?: number;
  created_at: number;
  updated_at?: number;
}

export interface GoalMilestone {
  id: number;
  weekly_distance_km: number;
  target_avg_speed_kmh: number;
  monthly_distance_km?: number;
  primary_goal?: string;
  rationale: string;
  source: string;
  created_at: number;
}

export interface ChatMessage {
  id: string | number;
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: string | any[];
  created_at?: number;
  isError?: boolean;
  actionMeta?: {
    type: 'goals' | 'profile';
    title: string;
    details?: string;
  };
}

export interface SessionSummary {
  session_id: string;
  last_activity: number;
  message_count: number;
  first_question: string | null;
}
