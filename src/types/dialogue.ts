import { QuestStatus } from './quests';

export interface DialogueCondition {
  hasFlag?: string;
  notFlag?: string;
  hasItem?: { itemId: string; count?: number };
  questState?: { questId: string; status: QuestStatus };
  hasStarter?: boolean;
}

export interface DialogueEffect {
  setFlag?: { flag: string; value: boolean };
  giveItem?: { itemId: string; count: number };
  giveMoney?: number;
  giveCreature?: { speciesId: string; level: number };
  healParty?: boolean;
  startQuest?: string;
  advanceQuest?: { questId: string; objectiveId?: string; amount?: number };
  completeQuest?: string;
  openShop?: boolean;
  startBattle?: { trainerId?: string; speciesId?: string; level?: number };
}

export interface DialogueOption {
  label: string;
  nextNodeId?: string;
  effects?: DialogueEffect[];
}

export interface DialogueNode {
  id: string;
  speakerName: string;
  speakerPaletteId?: string;
  text: string;
  portrait?: string; // species or palette id
  options?: DialogueOption[];
  nextNodeId?: string;
  effects?: DialogueEffect[];
}

export interface DialogueTree {
  id: string;
  startNodeId: string;
  nodes: Record<string, DialogueNode>;
}

export interface ConditionalDialogue {
  condition: DialogueCondition;
  dialogueTreeId: string;
  priority: number; // higher priority checked first
}
