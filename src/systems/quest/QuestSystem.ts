import { QuestData, QuestStatus, QuestProgressState } from '../../types/quests';
import { QUESTS_DATA } from '../../data/quests/quests';
import { GlobalSaveService } from '../../services/SaveService';
import { GlobalEventBus } from '../../core/EventBus';
import { GlobalAudioService } from '../../services/AudioService';

export class QuestSystem {
  private static instance: QuestSystem;

  private constructor() {
    this.initEventListeners();
  }

  public static getInstance(): QuestSystem {
    if (!QuestSystem.instance) {
      QuestSystem.instance = new QuestSystem();
    }
    return QuestSystem.instance;
  }

  private initEventListeners(): void {
    // 1. On Map Enter / Warp
    GlobalEventBus.on('map:warp', ({ targetMapId }) => {
      this.handleReachMap(targetMapId);
    });

    // 2. On Creature Caught
    GlobalEventBus.on('creature:caught', ({ speciesId }) => {
      this.handleCreatureCaught(speciesId);
    });

    // 3. Bloque 28A: Fragmentos de alma, ensamblaje de cuerpos y pergaminos de técnica
    GlobalEventBus.on('FragmentUsed', () => {
      if (GlobalSaveService.hasActiveState()) {
        this.handleObjectiveByType('use_fragment', 1);
      }
    });

    GlobalEventBus.on('BodyAssembled', () => {
      if (GlobalSaveService.hasActiveState()) {
        this.handleObjectiveByType('assemble_body', 1);
      }
    });

    GlobalEventBus.on('TechniqueLearned', () => {
      if (GlobalSaveService.hasActiveState()) {
        this.handleObjectiveByType('learn_technique', 1);
      }
    });
  }

  /**
   * Initializes quest state dictionary in GameState if missing
   */
  public ensureQuestsInitialized(): void {
    const state = GlobalSaveService.getCurrentState();
    if (!state.quests) {
      state.quests = {};
    }

    Object.keys(QUESTS_DATA).forEach((questId) => {
      if (!state.quests[questId]) {
        const isStarter = questId === 'main_1_starter';
        state.quests[questId] = {
          status: isStarter ? 'active' : 'locked',
          currentObjectiveIndex: 0,
          objectiveProgress: {},
        };
      }
    });

    this.recheckAvailableQuests();
  }

  /**
   * Evaluates unlock conditions and unlocks available quests
   */
  public recheckAvailableQuests(): void {
    const state = GlobalSaveService.getCurrentState();

    Object.values(QUESTS_DATA).forEach((quest) => {
      const qState = state.quests[quest.id];
      if (!qState || qState.status === 'locked') {
        let canUnlock = true;

        if (quest.unlockConditions) {
          // Check completed quest requirements
          if (quest.unlockConditions.requiredCompletedQuests) {
            const allMet = quest.unlockConditions.requiredCompletedQuests.every(
              (reqId) => state.quests[reqId]?.status === 'completed'
            );
            if (!allMet) canUnlock = false;
          }

          // Check flags
          if (quest.unlockConditions.requiredFlags) {
            const allFlags = quest.unlockConditions.requiredFlags.every(
              (flag) => state.flags[flag]
            );
            if (!allFlags) canUnlock = false;
          }
        }

        if (canUnlock) {
          if (!qState) {
            state.quests[quest.id] = {
              status: 'available',
              currentObjectiveIndex: 0,
              objectiveProgress: {},
            };
          } else {
            qState.status = 'available';
          }
        }
      }
    });
  }

  public getQuest(questId: string): QuestData | undefined {
    return QUESTS_DATA[questId];
  }

  public getQuestStatus(questId: string): QuestStatus {
    const state = GlobalSaveService.getCurrentState();
    return state.quests[questId]?.status || 'locked';
  }

  public getAllQuestsWithStatus(): Array<{ data: QuestData; state: QuestProgressState }> {
    this.ensureQuestsInitialized();
    const state = GlobalSaveService.getCurrentState();
    return Object.values(QUESTS_DATA).map((data) => ({
      data,
      state: state.quests[data.id] || {
        status: 'locked',
        currentObjectiveIndex: 0,
        objectiveProgress: {},
      },
    }));
  }

  public getActiveQuests(): Array<{ data: QuestData; state: QuestProgressState }> {
    return this.getAllQuestsWithStatus().filter(
      (q) => q.state.status === 'active' || q.state.status === 'completable'
    );
  }

  /**
   * Starts a quest
   */
  public startQuest(questId: string): boolean {
    this.ensureQuestsInitialized();
    const state = GlobalSaveService.getCurrentState();
    const quest = QUESTS_DATA[questId];
    if (!quest) return false;

    const qState = state.quests[questId];
    if (qState.status === 'completed' || qState.status === 'active') return false;

    qState.status = 'active';
    qState.currentObjectiveIndex = 0;
    qState.objectiveProgress = {};

    GlobalAudioService.playSfx('confirm');
    GlobalEventBus.emit('quest:started', { questId });
    GlobalEventBus.emit('toast:message', {
      text: `📜 Misión iniciada: "${quest.title}"`,
      duration: 3000,
    });

    this.saveState();
    return true;
  }

  /**
   * Advances an objective by a given delta
   */
  public advanceObjective(questId: string, objectiveId: string, amount = 1): void {
    const state = GlobalSaveService.getCurrentState();
    const qState = state.quests[questId];
    const quest = QUESTS_DATA[questId];
    if (!qState || qState.status !== 'active' || !quest) return;

    const currentObj = quest.objectives.find((o) => o.id === objectiveId);
    if (!currentObj) return;

    const cur = (qState.objectiveProgress[objectiveId] || 0) + amount;
    qState.objectiveProgress[objectiveId] = Math.min(cur, currentObj.requiredCount);

    GlobalEventBus.emit('quest:updated', {
      questId,
      objectiveId,
      current: qState.objectiveProgress[objectiveId],
      total: currentObj.requiredCount,
    });

    // Check if all objectives for this quest are met
    const allDone = quest.objectives.every((obj) => {
      const p = qState.objectiveProgress[obj.id] || 0;
      return p >= obj.requiredCount;
    });

    if (allDone) {
      qState.status = 'completable';
      GlobalAudioService.playSfx('start');
      GlobalEventBus.emit('toast:message', {
        text: `✨ ¡Misión completable: "${quest.title}"! Vuelve con ${quest.turnInNpcId}.`,
        duration: 3500,
      });
    }

    this.saveState();
  }

  /**
   * Completes a quest and distributes rewards
   */
  public completeQuest(questId: string): boolean {
    const state = GlobalSaveService.getCurrentState();
    const qState = state.quests[questId];
    const quest = QUESTS_DATA[questId];
    if (!qState || (qState.status !== 'active' && qState.status !== 'completable') || !quest) {
      return false;
    }

    qState.status = 'completed';

    // Distribute Rewards
    if (quest.rewards.money) {
      state.player.money = (state.player.money || 0) + quest.rewards.money;
    }
    if (quest.rewards.items) {
      quest.rewards.items.forEach(({ itemId, count }) => {
        state.inventory[itemId] = (state.inventory[itemId] || 0) + count;
      });
    }

    GlobalAudioService.playSfx('start');
    GlobalEventBus.emit('quest:completed', { questId });
    GlobalEventBus.emit('toast:message', {
      text: `🏆 ¡Misión completada: "${quest.title}"! ${quest.rewards.message || ''}`,
      duration: 4000,
    });

    // Check if new quests are unlocked
    this.recheckAvailableQuests();
    this.saveState();
    return true;
  }

  // --- Handlers for Game Events ---

  public handleTalkToNpc(npcId: string): void {
    const state = GlobalSaveService.getCurrentState();
    Object.values(QUESTS_DATA).forEach((quest) => {
      const qState = state.quests[quest.id];
      if (!qState) return;
      const wasCompletable = qState.status === 'completable';
      if (qState.status === 'active') {
        quest.objectives.forEach((obj) => {
          if (obj.type === 'talk_to' && obj.targetId === npcId) {
            this.advanceObjective(quest.id, obj.id, 1);
          }
        });
      }
      if (qState.status === 'available' && quest.giverNpcId === npcId) {
        this.startQuest(quest.id);
      } else if (wasCompletable && qState.status === 'completable' && quest.turnInNpcId === npcId) {
        this.completeQuest(quest.id);
      }
    });
  }

  private handleReachMap(mapId: string): void {
    const state = GlobalSaveService.getCurrentState();
    Object.values(QUESTS_DATA).forEach((quest) => {
      const qState = state.quests[quest.id];
      if (qState && qState.status === 'active') {
        quest.objectives.forEach((obj) => {
          if (obj.type === 'reach_map' && obj.targetId === mapId) {
            this.advanceObjective(quest.id, obj.id, 1);
          }
        });
      }
    });
  }

  private handleObjectiveByType(
    type: 'use_fragment' | 'assemble_body' | 'learn_technique',
    amount = 1
  ): void {
    this.ensureQuestsInitialized();
    const state = GlobalSaveService.getCurrentState();
    Object.values(QUESTS_DATA).forEach((quest) => {
      const qState = state.quests[quest.id];
      // Permitir que misiones disponibles o activas de gacha se activen/avancen al ocurrir el evento
      if (qState && (qState.status === 'active' || qState.status === 'available')) {
        const hasType = quest.objectives.some((o) => o.type === type);
        if (hasType && qState.status === 'available') {
          qState.status = 'active';
        }
        if (qState.status === 'active') {
          quest.objectives.forEach((obj) => {
            if (obj.type === type) {
              this.advanceObjective(quest.id, obj.id, amount);
            }
          });
        }
      }
    });
  }

  private handleCreatureCaught(speciesId: string): void {
    const state = GlobalSaveService.getCurrentState();
    Object.values(QUESTS_DATA).forEach((quest) => {
      const qState = state.quests[quest.id];
      if (qState && qState.status === 'active') {
        quest.objectives.forEach((obj) => {
          if (obj.type === 'catch_species' && (!obj.targetId || obj.targetId === speciesId)) {
            this.advanceObjective(quest.id, obj.id, 1);
          }
          if (obj.type === 'dex_count') {
            const caughtCount = Object.values(state.pokedex || {}).filter((p) => p.caught).length;
            qState.objectiveProgress[obj.id] = caughtCount;
            if (caughtCount >= obj.requiredCount) {
              this.advanceObjective(quest.id, obj.id, obj.requiredCount);
            }
          }
        });
      }
    });
  }

  /**
   * Checks if an NPC has an available quest (!) or completable quest (?)
   */
  public getNpcQuestMarker(npcId: string): '!' | '?' | null {
    this.ensureQuestsInitialized();
    const state = GlobalSaveService.getCurrentState();

    // 1. Check Completable first (?)
    for (const quest of Object.values(QUESTS_DATA)) {
      const qState = state.quests[quest.id];
      if (
        (qState?.status === 'completable' || qState?.status === 'active') &&
        quest.turnInNpcId === npcId
      ) {
        // If all objectives are done, show '?'
        const allDone = quest.objectives.every((obj) => {
          const p = qState.objectiveProgress[obj.id] || 0;
          return p >= obj.requiredCount;
        });
        if (allDone) return '?';
      }
    }

    // 2. Check Available (!)
    for (const quest of Object.values(QUESTS_DATA)) {
      const qState = state.quests[quest.id];
      if (qState?.status === 'available' && quest.giverNpcId === npcId) {
        return '!';
      }
    }

    return null;
  }

  private saveState(): void {
    GlobalSaveService.save(GlobalSaveService.getActiveSlot());
  }
}

export const GlobalQuestSystem = QuestSystem.getInstance();
