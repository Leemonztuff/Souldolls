export type QuestStatus = 'locked' | 'available' | 'active' | 'completable' | 'completed';

export type QuestObjectiveType =
  | 'talk_to'
  | 'catch_species'
  | 'defeat_trainer'
  | 'reach_map'
  | 'collect_item'
  | 'defeat_boss'
  | 'dex_count'
  | 'use_fragment'
  | 'assemble_body'
  | 'learn_technique';

export interface QuestObjective {
  id: string;
  type: QuestObjectiveType;
  description: string;
  targetId?: string; // NPC id, Species id, Map id, Item id
  requiredCount: number;
  currentCount: number;
  isCompleted: boolean;
}

export interface QuestReward {
  money?: number;
  items?: Array<{ itemId: string; count: number }>;
  message?: string;
}

export interface QuestData {
  id: string;
  title: string;
  category: 'main' | 'side';
  giverNpcId: string;
  turnInNpcId: string;
  summary: string;
  description: string;
  unlockConditions?: {
    requiredFlags?: string[];
    requiredCompletedQuests?: string[];
    minDexCount?: number;
  };
  objectives: QuestObjective[];
  rewards: QuestReward;
}

export interface QuestProgressState {
  status: QuestStatus;
  currentObjectiveIndex: number;
  objectiveProgress: Record<string, number>; // objectiveId -> currentCount
}
