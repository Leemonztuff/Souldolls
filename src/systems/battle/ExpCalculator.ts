import { ExpGroup, CreatureSpecies } from '../../types/creatures';

export class ExpCalculator {
  /**
   * Total cumulative EXP required to reach a specific level
   */
  public static getExpForLevel(level: number, group: ExpGroup = 'medium_fast'): number {
    if (level <= 1) return 0;
    const n = Math.min(100, Math.max(1, level));

    switch (group) {
      case 'fast':
        return Math.floor((4 * Math.pow(n, 3)) / 5);

      case 'medium_fast':
        return Math.floor(Math.pow(n, 3));

      case 'medium_slow':
        return Math.max(0, Math.floor(1.2 * Math.pow(n, 3) - 15 * Math.pow(n, 2) + 100 * n - 140));

      case 'slow':
        return Math.floor((5 * Math.pow(n, 3)) / 4);
    }
  }

  /**
   * Calculates experience gained from defeating an enemy creature
   */
  public static calculateExpYield(
    defeatedSpecies: CreatureSpecies,
    defeatedLevel: number,
    isTrainer = false
  ): number {
    const base = defeatedSpecies.baseExp || 60;
    const trainerBonus = isTrainer ? 1.5 : 1.0;
    const exp = Math.floor((base * defeatedLevel * trainerBonus) / 7);
    return Math.max(1, exp);
  }

  /**
   * Evaluates if added exp causes one or more level ups
   */
  public static evaluateExp(
    currentExp: number,
    currentLevel: number,
    group: ExpGroup = 'medium_fast'
  ): {
    newLevel: number;
    didLevelUp: boolean;
    levelsGained: number;
    expIntoCurrentLevel: number;
    expForNextLevel: number;
  } {
    let level = currentLevel;
    const initialLevel = currentLevel;

    while (level < 100 && currentExp >= this.getExpForLevel(level + 1, group)) {
      level++;
    }

    const currentLevelBaseExp = this.getExpForLevel(level, group);
    const nextLevelExp = this.getExpForLevel(level + 1, group);

    return {
      newLevel: level,
      didLevelUp: level > initialLevel,
      levelsGained: level - initialLevel,
      expIntoCurrentLevel: currentExp - currentLevelBaseExp,
      expForNextLevel: nextLevelExp - currentLevelBaseExp,
    };
  }
}
