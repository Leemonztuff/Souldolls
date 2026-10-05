import { DialogueNode, DialogueTree, DialogueEffect, DialogueOption } from '../../types/dialogue';
import { DIALOGUE_TREES } from '../../data/dialogue/dialogues';
import { GlobalSaveService } from '../../services/SaveService';
import { GlobalQuestSystem } from '../quest/QuestSystem';
import { GlobalAudioService } from '../../services/AudioService';
import { GlobalEventBus } from '../../core/EventBus';
import { GlobalSceneManager } from '../../core/SceneManager';
import { CREATURES_DATA } from '../../data/creatures/creatures';
import { MOVES_DATA } from '../../data/moves/moves';
import { CreatureInstance } from '../../types';
import { PokedexSystem } from '../PokedexSystem';
import { StatCalculator } from '../battle/StatCalculator';

export class DialogueSystem {
  private static instance: DialogueSystem;
  private currentTree: DialogueTree | null = null;
  private currentNode: DialogueNode | null = null;

  private constructor() {}

  public static getInstance(): DialogueSystem {
    if (!DialogueSystem.instance) {
      DialogueSystem.instance = new DialogueSystem();
    }
    return DialogueSystem.instance;
  }

  /**
   * Starts a dialogue from a registered tree ID
   */
  public startDialogue(treeId: string): DialogueNode | null {
    const tree = DIALOGUE_TREES[treeId];
    if (!tree) {
      console.warn(`[DialogueSystem] Dialogue tree "${treeId}" not found.`);
      return null;
    }

    this.currentTree = tree;
    let startNodeId = tree.startNodeId;

    // Condition check for starter choice
    const state = GlobalSaveService.getCurrentState();
    if (treeId === 'prof_roble_intro' && state.flags.has_starter) {
      startNodeId = 'node_already_has_starter';
    }

    this.currentNode = tree.nodes[startNodeId] || null;
    if (this.currentNode) {
      this.applyNodeEffects(this.currentNode);
    }
    return this.currentNode;
  }

  public getCurrentNode(): DialogueNode | null {
    return this.currentNode;
  }

  /**
   * Selects an option from the current node or advances to nextNodeId
   */
  public selectOption(optionIndex: number): DialogueNode | null {
    if (!this.currentTree || !this.currentNode) return null;

    if (this.currentNode.options && this.currentNode.options[optionIndex]) {
      const option = this.currentNode.options[optionIndex];
      // Apply option effects
      if (option.effects) {
        option.effects.forEach((eff) => this.applyEffect(eff));
      }

      if (option.nextNodeId && this.currentTree.nodes[option.nextNodeId]) {
        this.currentNode = this.currentTree.nodes[option.nextNodeId];
        this.applyNodeEffects(this.currentNode);
        return this.currentNode;
      } else {
        this.currentNode = null;
        return null;
      }
    }

    // Direct advance if no options
    if (this.currentNode.nextNodeId && this.currentTree.nodes[this.currentNode.nextNodeId]) {
      this.currentNode = this.currentTree.nodes[this.currentNode.nextNodeId];
      this.applyNodeEffects(this.currentNode);
      return this.currentNode;
    }

    this.currentNode = null;
    return null;
  }

  public advance(): DialogueNode | null {
    if (!this.currentTree || !this.currentNode) return null;
    if (this.currentNode.options && this.currentNode.options.length > 0) {
      // Cannot advance without picking an option
      return this.currentNode;
    }

    if (this.currentNode.nextNodeId && this.currentTree.nodes[this.currentNode.nextNodeId]) {
      this.currentNode = this.currentTree.nodes[this.currentNode.nextNodeId];
      this.applyNodeEffects(this.currentNode);
      return this.currentNode;
    }

    this.currentNode = null;
    return null;
  }

  private applyNodeEffects(node: DialogueNode): void {
    if (node.effects) {
      node.effects.forEach((eff) => this.applyEffect(eff));
    }
  }

  private applyEffect(eff: DialogueEffect): void {
    const state = GlobalSaveService.getCurrentState();

    // 1. Set Flag
    if (eff.setFlag) {
      state.flags[eff.setFlag.flag] = eff.setFlag.value;
    }

    // 2. Give Item
    if (eff.giveItem) {
      const cur = state.inventory[eff.giveItem.itemId] || 0;
      state.inventory[eff.giveItem.itemId] = cur + eff.giveItem.count;
      GlobalEventBus.emit('item:obtained', eff.giveItem);
      GlobalEventBus.emit('toast:message', {
        text: `🎁 ¡Obtuviste ${eff.giveItem.count}x ${eff.giveItem.itemId}!`,
        duration: 2500,
      });
    }

    // 3. Give Money
    if (eff.giveMoney) {
      state.player.money = (state.player.money || 0) + eff.giveMoney;
      GlobalEventBus.emit('toast:message', {
        text: `💰 ¡Recibiste $${eff.giveMoney}!`,
        duration: 2000,
      });
    }

    // 4. Give Creature Starter
    if (eff.giveCreature) {
      this.awardCreature(eff.giveCreature.speciesId, eff.giveCreature.level);
    }

    // 5. Heal Party & Restore Body Parts (Souldoll Parts)
    if (eff.healParty) {
      state.party.forEach((c) => {
        c.currentHp = c.maxHp;
        if (c.partHP && c.maxPartHP) {
          c.partHP.head = c.maxPartHP.head;
          c.partHP.torso = c.maxPartHP.torso;
          c.partHP.arms = c.maxPartHP.arms;
          c.partHP.legs = c.maxPartHP.legs;
        }
        c.status = null;
        c.moves.forEach((m) => {
          m.currentPp = m.maxPp;
        });
      });
      GlobalAudioService.playSfx('confirm');
      GlobalEventBus.emit('toast:message', {
        text: '¡El ki de tus Souldolls y todos sus cuerpos han sido restaurados al 100%!',
        duration: 2500,
      });
    }

    // 6. Quests
    if (eff.startQuest) {
      GlobalQuestSystem.startQuest(eff.startQuest);
    }
    if (eff.advanceQuest) {
      GlobalQuestSystem.advanceObjective(
        eff.advanceQuest.questId,
        eff.advanceQuest.objectiveId || '',
        eff.advanceQuest.amount || 1
      );
    }
    if (eff.completeQuest) {
      GlobalQuestSystem.completeQuest(eff.completeQuest);
    }

    // 7. Open Integrated Scenes (Shop, Workshop, StorageBox) via EventBus from NPC dialogue (Bloque 43 Req. 6)
    if (eff.openShop) {
      GlobalAudioService.playSfx('select');
      GlobalEventBus.emit('OpenShop', { mode: eff.shopMode || 'buy', source: 'npc_dialogue' });
      GlobalSceneManager.pushScene('Shop', { mode: eff.shopMode || 'buy' });
    }
    if (eff.openWorkshop) {
      GlobalAudioService.playSfx('select');
      GlobalEventBus.emit('OpenWorkshop', { source: 'npc_dialogue' });
      GlobalSceneManager.pushScene('Workshop');
    }
    if (eff.openStorageBox) {
      GlobalAudioService.playSfx('select');
      GlobalEventBus.emit('OpenStorage', { source: 'npc_dialogue' });
      GlobalSceneManager.pushScene('StorageBox');
    }

    GlobalSaveService.save(GlobalSaveService.getActiveSlot());
  }

  private awardCreature(speciesId: string, level: number): void {
    const state = GlobalSaveService.getCurrentState();
    const species = CREATURES_DATA[speciesId];
    if (!species) return;

    const newInstance = StatCalculator.createCreatureInstance(speciesId, level);

    state.party.push(newInstance);

    // Register in Pokedex / SoulCodex
    PokedexSystem.markCaught(speciesId);

    GlobalAudioService.playSfx('start');
    GlobalEventBus.emit('creature:caught', { speciesId, level });
    GlobalEventBus.emit('toast:message', {
      text: `🎉 ¡${species.name} (Nv. ${level}) se unió a tu equipo!`,
      duration: 3500,
    });
  }
}

export const GlobalDialogueSystem = DialogueSystem.getInstance();
