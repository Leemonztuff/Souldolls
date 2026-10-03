import { AbilityDef } from '../../types/abilities';

export const ABILITIES_DATA: Record<string, AbilityDef> = {
  mar_llamas: {
    id: 'mar_llamas',
    name: 'Mar Llamas',
    description: 'Potencia movimientos de Fuego x1.5 si los PS bajan de un tercio.',
    onDamage: (ctx) => {
      if (ctx.move && ctx.move.type === 'Fuego' && ctx.user.currentHp <= ctx.user.maxHp / 3) {
        return { damageMultiplier: 1.5, message: `¡La habilidad Mar Llamas de ${ctx.user.nickname || ctx.user.speciesId} potenció el fuego!` };
      }
      return null;
    },
  },
  torrente: {
    id: 'torrente',
    name: 'Torrente',
    description: 'Potencia movimientos de Agua x1.5 si los PS bajan de un tercio.',
    onDamage: (ctx) => {
      if (ctx.move && ctx.move.type === 'Agua' && ctx.user.currentHp <= ctx.user.maxHp / 3) {
        return { damageMultiplier: 1.5, message: `¡La habilidad Torrente de ${ctx.user.nickname || ctx.user.speciesId} potenció el agua!` };
      }
      return null;
    },
  },
  espesura: {
    id: 'espesura',
    name: 'Espesura',
    description: 'Potencia movimientos de Planta x1.5 si los PS bajan de un tercio.',
    onDamage: (ctx) => {
      if (ctx.move && ctx.move.type === 'Planta' && ctx.user.currentHp <= ctx.user.maxHp / 3) {
        return { damageMultiplier: 1.5, message: `¡La habilidad Espesura de ${ctx.user.nickname || ctx.user.speciesId} potenció la planta!` };
      }
      return null;
    },
  },
  mar_vivo: {
    id: 'mar_vivo',
    name: 'Mar Vivo',
    description: 'Potencia movimientos de Agua x1.3 y recupera vitalidad al final del turno.',
    onDamage: (ctx) => {
      if (ctx.move && ctx.move.type === 'Agua') {
        return { damageMultiplier: 1.3, message: `¡Mar Vivo vigoriza el torrente de agua!` };
      }
      return null;
    },
    onTurnEnd: (ctx) => {
      if (ctx.weather === 'rain' || ctx.user.currentHp < ctx.user.maxHp) {
        return { healPercent: 0.0625, message: `¡Mar Vivo regenera los PS de ${ctx.user.nickname || ctx.user.speciesId}!` };
      }
      return null;
    },
  },
  levitar: {
    id: 'levitar',
    name: 'Levitar',
    description: 'Otorga inmunidad total frente a ataques de tipo Tierra.',
    onDamage: (ctx) => {
      if (ctx.move && ctx.move.type === 'Tierra') {
        return { immune: true, message: `¡${ctx.user.nickname || ctx.user.speciesId} levita esquivando los movimientos de Tierra!` };
      }
      return null;
    },
  },
  electricidad_estatica: {
    id: 'electricidad_estatica',
    name: 'Elec. Estática',
    description: 'Genera una carga que potencia ataques eléctricos x1.2.',
    onDamage: (ctx) => {
      if (ctx.move && ctx.move.type === 'Eléctrico') {
        return { damageMultiplier: 1.2, message: `¡La electricidad estática amplifica la descarga!` };
      }
      return null;
    },
  },
  cabeza_roca: {
    id: 'cabeza_roca',
    name: 'Cabeza Roca',
    description: 'Reduce el daño recibido un 10% gracias a una coraza impenetrable.',
    onDamage: (ctx) => {
      if (ctx.damage && ctx.damage > 0) {
        return { damageMultiplier: 0.9, message: `¡La dura coraza de ${ctx.user.nickname || ctx.user.speciesId} amortigua el impacto!` };
      }
      return null;
    },
  },
  intimidacion: {
    id: 'intimidacion',
    name: 'Intimidación',
    description: 'Baja el Ataque del rival al saltar al combate.',
    onSwitchIn: (ctx) => {
      return {
        message: `¡${ctx.user.nickname || ctx.user.speciesId} intimida a su adversario con una mirada fiera!`,
        statChanges: [{ target: 'target', stat: 'atk', stages: -1 }],
      };
    },
  },
  sombra_trampa: {
    id: 'sombra_trampa',
    name: 'Sombra Trampa',
    description: 'Emite un aura que reduce la Defensa Especial del rival al entrar.',
    onSwitchIn: (ctx) => {
      return {
        message: `¡Las sombras de ${ctx.user.nickname || ctx.user.speciesId} envuelven y desconciertan al rival!`,
        statChanges: [{ target: 'target', stat: 'spDef', stages: -1 }],
      };
    },
  },
  sebo: {
    id: 'sebo',
    name: 'Sebo',
    description: 'Amortigua y reduce a la mitad el daño recibido de Fuego y Hielo.',
    onDamage: (ctx) => {
      if (ctx.move && (ctx.move.type === 'Fuego' || ctx.move.type === 'Hielo')) {
        return { damageMultiplier: 0.5, message: `¡La gruesa capa de Sebo amortigua el impacto térmico!` };
      }
      return null;
    },
  },
  manto_niveo: {
    id: 'manto_niveo',
    name: 'Manto Níveo',
    description: 'Potencia movimientos de Hielo x1.25 en combate.',
    onDamage: (ctx) => {
      if (ctx.move && ctx.move.type === 'Hielo') {
        return { damageMultiplier: 1.25, message: `¡El Manto Níveo potencia los ataques congelantes!` };
      }
      return null;
    },
  },
  gracia_feerica: {
    id: 'gracia_feerica',
    name: 'Gracia Feérica',
    description: 'Potencia movimientos de Hada x1.25 y sana gradualmente.',
    onDamage: (ctx) => {
      if (ctx.move && ctx.move.type === 'Hada') {
        return { damageMultiplier: 1.25, message: `¡La Gracia Feérica bendice el ataque con poder radiante!` };
      }
      return null;
    },
    onTurnEnd: (ctx) => {
      if ((ctx.user.friendship || 0) >= 120 && ctx.user.currentHp < ctx.user.maxHp) {
        return { healPercent: 0.05, message: `¡El vínculo de amistad con ${ctx.user.nickname || ctx.user.speciesId} restaura PS!` };
      }
      return null;
    },
  },
  presion: {
    id: 'presion',
    name: 'Presión',
    description: 'Ejerce una presencia colosal reduciendo el Ataque del rival.',
    onSwitchIn: (ctx) => {
      return {
        message: `¡La imponente Presión de ${ctx.user.nickname || ctx.user.speciesId} domina el campo!`,
        statChanges: [{ target: 'target', stat: 'atk', stages: -1 }],
      };
    },
  },
  regeneracion: {
    id: 'regeneracion',
    name: 'Regeneración',
    description: 'Recupera un 6% de PS máximos al final de cada turno.',
    onTurnEnd: (ctx) => {
      if (ctx.user.currentHp < ctx.user.maxHp) {
        return { healPercent: 0.0625, message: `¡${ctx.user.nickname || ctx.user.speciesId} se regenera!` };
      }
      return null;
    },
  },
};

/**
 * Returns ability definition or a safe fallback
 */
export function getAbility(abilityId?: string): AbilityDef | null {
  if (!abilityId) return null;
  return ABILITIES_DATA[abilityId] || null;
}
