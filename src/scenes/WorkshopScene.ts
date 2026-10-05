import { Container, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalSaveService } from '../services/SaveService';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalInput } from '../core/Input';
import { StatCalculator } from '../systems/battle/StatCalculator';
import { BODY_CHASSIS_DATA } from '../data/bodies/chassis';
import { BodyPart } from '../types/bodies';
import { HumanoidPartSilhouette } from '../render/ui/HumanoidPartSilhouette';
import {
  ScreenFrame,
  KitCard,
  KitTabBar,
  KitListRow,
  KitButton,
  KitBadge,
  KitBar,
  FocusManager,
  UIKitLinter,
} from '../ui/kit';
import { COLOR_HEX, FONTS } from '../ui/styles';
import { buildWorkshopVM, resolveDollBody, WorkshopTabId } from '../ui/viewmodels/GroupBViewModels';
import esText from '../data/text/es.json';

export class WorkshopScene implements IScene {
  public name = 'Workshop';
  private container: Container = new Container();
  private screenFrame!: ScreenFrame;
  private focusManager: FocusManager = new FocusManager();
  private currentTab: WorkshopTabId = 'heal';
  private selectedPartyIndex = 0;
  private statusMessage = '';

  public async enter(params?: { tab?: WorkshopTabId }): Promise<void> {
    if (params?.tab) {
      this.currentTab = params.tab;
    }
    this.container = new Container();
    this.container.roundPixels = true;
    this.container.zIndex = 1000;
    GlobalPixiRenderer.menuLayer.addChild(this.container);
    this.renderWorkshop();
  }

  public pause(): void {
    if (this.container && !this.container.destroyed) {
      this.container.visible = false;
    }
  }

  public async resume(): Promise<void> {
    if (!this.container || this.container.destroyed) {
      this.container = new Container();
      this.container.roundPixels = true;
      this.container.zIndex = 1000;
    }
    this.container.visible = true;
    if (this.container.parent !== GlobalPixiRenderer.menuLayer) {
      GlobalPixiRenderer.menuLayer.addChild(this.container);
    }
    this.renderWorkshop();
  }

  public onResize(_width: number, _height: number): void {
    this.renderWorkshop();
  }

  private renderWorkshop(): void {
    this.container.removeChildren();
    this.focusManager.clear();

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;
    const isDesktop = width >= 840;
    const state = GlobalSaveService.getCurrentState();
    const vm = buildWorkshopVM(state);
    const t = (esText as any).terms.group_b.workshop;

    if (this.selectedPartyIndex >= vm.party.length) {
      this.selectedPartyIndex = Math.max(0, vm.party.length - 1);
    }

    this.screenFrame = new ScreenFrame({
      width,
      height,
      title: t.title,
      currencies: [
        { iconId: 'coin', value: vm.money },
        { iconId: 'soul_fragment', value: vm.soulFragments },
        { iconId: 'ki_dust', value: vm.kiDust },
      ],
      onClose: () => {
        GlobalAudioService.playSfx('cancel');
        GlobalSceneManager.popScene();
      },
      secondaryAction: {
        label: t.btn_back,
        iconId: 'back',
        onClick: () => {
          GlobalAudioService.playSfx('cancel');
          GlobalSceneManager.popScene();
        },
      },
      primaryAction: {
        label: t.btn_open_binder,
        iconId: 'soul_bottle',
        onClick: () => {
          GlobalAudioService.playSfx('confirm');
          GlobalSceneManager.pushScene('SoulBinding');
        },
      },
    });
    this.container.addChild(this.screenFrame);

    const cw = this.screenFrame.contentWidth;

    const tabBar = new KitTabBar({
      width: cw,
      absX: 0,
      tabs: [
        { id: 'heal', label: t.tab_heal, iconId: 'heart' },
        { id: 'repair', label: t.tab_repair, iconId: 'workshop' },
        { id: 'purge', label: t.tab_purge, iconId: 'spark' },
        { id: 'upgrade', label: t.tab_upgrade, iconId: 'star' },
        { id: 'bind', label: t.tab_bind, iconId: 'soul_bottle' },
        { id: 'unbind', label: t.tab_unbind, iconId: 'storage' },
      ],
      activeId: this.currentTab,
      onSelect: (id) => {
        this.currentTab = id as WorkshopTabId;
        this.statusMessage = '';
        this.renderWorkshop();
      },
    });
    tabBar.position.set(0, 0);
    this.screenFrame.contentRoot.addChild(tabBar);

    const leftW = isDesktop ? Math.floor(cw * 0.42) : cw;
    const rightW = isDesktop ? cw - leftW - 12 : cw;

    const rowH = 54;
    const leftH = Math.max(180, vm.party.length * (rowH + 6) + 52);
    const leftCard = new KitCard({
      width: leftW,
      height: leftH,
      variant: 'smokedWood',
      title: t.sec_party,
    });
    leftCard.position.set(0, 48);
    this.screenFrame.contentRoot.addChild(leftCard);

    if (vm.party.length === 0) {
      const emptyTxt = new Text({
        text: t.empty_party,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 13,
          fill: COLOR_HEX.smoke,
        }),
      });
      emptyTxt.position.set(14, 48);
      leftCard.addChild(emptyTxt);
    } else {
      vm.party.forEach((member, idx) => {
        const isSel = idx === this.selectedPartyIndex;
        const row = new KitListRow({
          width: leftW - 20,
          height: rowH,
          iconId: member.hasBody ? 'party' : 'soul_bottle',
          title: `${member.name} (Nv.${member.level})`,
          subtitle: `${member.chassisName} · Dur ${member.durability}%`,
          valueText: `PS ${member.hpCur}/${member.hpMax}`,
          selected: isSel,
          onClick: () => {
            this.selectedPartyIndex = idx;
            this.statusMessage = '';
            this.renderWorkshop();
          },
        });
        row.position.set(10, 38 + idx * (rowH + 6));
        leftCard.addChild(row);

        this.focusManager.register({
          container: row,
          width: leftW - 20,
          height: rowH,
          onActivate: () => {
            this.selectedPartyIndex = idx;
            this.statusMessage = '';
            this.renderWorkshop();
          },
        });
      });
    }

    const rightY = isDesktop ? 48 : 48 + leftH + 12;
    const rightH = 380;
    const rightCard = new KitCard({
      width: rightW,
      height: rightH,
      variant: 'parchment',
      title: t.sec_action,
    });
    rightCard.position.set(isDesktop ? leftW + 12 : 0, rightY);
    this.screenFrame.contentRoot.addChild(rightCard);

    const activeMember = vm.party[this.selectedPartyIndex];
    const activeDoll = state.party[this.selectedPartyIndex];

    if (this.currentTab === 'heal') {
      const desc = new Text({
        text: t.heal_desc,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 13,
          fontWeight: 'bold',
          fill: COLOR_HEX.inkCrypt,
          wordWrap: true,
          wordWrapWidth: rightW - 28,
        }),
      });
      desc.position.set(14, 44);
      rightCard.addChild(desc);

      const healBtn = new KitButton({
        width: rightW - 28,
        height: 44,
        label: t.btn_heal_all,
        variant: 'primary',
        iconId: 'heart',
        onClick: () => {
          state.party.forEach((doll) => {
            StatCalculator.ensurePartHp(doll);
            doll.partHP = { ...doll.maxPartHP };
            doll.currentHp = doll.maxHp;
            doll.status = null;
            doll.moves.forEach((m) => (m.currentPp = m.maxPp));
            const b = resolveDollBody(state, doll.bodyInstanceId);
            if (b) {
              b.partDurability = { head: 100, torso: 100, arms: 100, legs: 100 };
            }
          });
          GlobalSaveService.save();
          GlobalAudioService.playSfx('heal');
          this.statusMessage = t.healed_ok;
          this.renderWorkshop();
        },
      });
      healBtn.position.set(14, 110);
      rightCard.addChild(healBtn);
      this.focusManager.register(healBtn.toFocusable());
    } else if (this.currentTab === 'repair' && activeMember && activeDoll) {
      const sil = new HumanoidPartSilhouette();
      sil.position.set(22, 46);
      sil.updateParts(
        {
          head: activeMember.parts.head.cur,
          torso: activeMember.parts.torso.cur,
          arms: activeMember.parts.arms.cur,
          legs: activeMember.parts.legs.cur,
        },
        {
          head: activeMember.parts.head.max,
          torso: activeMember.parts.torso.max,
          arms: activeMember.parts.arms.max,
          legs: activeMember.parts.legs.max,
        }
      );
      rightCard.addChild(sil);

      const durBar = new KitBar({
        width: rightW - 130,
        height: 18,
        value: activeMember.durability,
        max: activeMember.maxDurability,
        kind: 'hp',
        showText: true,
      });
      durBar.position.set(112, 48);
      rightCard.addChild(durBar);

      const partKeys: BodyPart[] = ['head', 'torso', 'arms', 'legs'];
      partKeys.forEach((pk, pIdx) => {
        const pInfo = activeMember.parts[pk];
        const pBar = new KitBar({
          width: rightW - 130,
          height: 16,
          value: pInfo.cur,
          max: pInfo.max,
          kind: 'hp',
          showText: true,
        });
        pBar.position.set(112, 76 + pIdx * 24);
        rightCard.addChild(pBar);
      });

      const repBtn = new KitButton({
        width: rightW - 28,
        height: 44,
        label: activeMember.needsRepair
          ? `${t.btn_repair} (${activeMember.repairCostGold} Oro)`
          : t.no_repair_needed,
        variant: 'primary',
        iconId: 'workshop',
        disabled: !activeMember.needsRepair,
        onClick: () => {
          if (state.player.money < activeMember.repairCostGold) {
            GlobalAudioService.playSfx('cancel');
            this.statusMessage = 'No tienes suficientes Monedas de Ki.';
            this.renderWorkshop();
            return;
          }
          state.player.money -= activeMember.repairCostGold;
          activeDoll.partHP = { ...activeDoll.maxPartHP };
          activeDoll.currentHp = activeDoll.maxHp;
          const b = resolveDollBody(state, activeDoll.bodyInstanceId);
          if (b) {
            b.partDurability = { head: 100, torso: 100, arms: 100, legs: 100 };
          }
          GlobalSaveService.save();
          GlobalAudioService.playSfx('heal');
          this.statusMessage = 'Cuerpo y partes reparados al 100%.';
          this.renderWorkshop();
        },
      });
      repBtn.position.set(14, 190);
      rightCard.addChild(repBtn);
      this.focusManager.register(repBtn.toFocusable());
    } else if (this.currentTab === 'purge' && activeMember && activeDoll) {
      const desc = new Text({
        text: activeMember.status
          ? `${t.purge_desc} Estado actual: ${activeMember.status.toUpperCase()}`
          : t.no_status,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 13,
          fontWeight: 'bold',
          fill: COLOR_HEX.inkCrypt,
          wordWrap: true,
          wordWrapWidth: rightW - 28,
        }),
      });
      desc.position.set(14, 46);
      rightCard.addChild(desc);

      const purgeBtn = new KitButton({
        width: rightW - 28,
        height: 44,
        label: t.btn_purge,
        variant: 'primary',
        iconId: 'spark',
        disabled: !activeMember.status,
        onClick: () => {
          activeDoll.status = null;
          GlobalSaveService.save();
          GlobalAudioService.playSfx('heal');
          this.statusMessage = 'Ki corrupto purgado con éxito.';
          this.renderWorkshop();
        },
      });
      purgeBtn.position.set(14, 110);
      rightCard.addChild(purgeBtn);
      this.focusManager.register(purgeBtn.toFocusable());
    } else if (this.currentTab === 'upgrade' && activeMember && activeDoll) {
      const partKeys: BodyPart[] = ['head', 'torso', 'arms', 'legs'];
      const partLabels = (esText as any).terms.parts;

      partKeys.forEach((pk, idx) => {
        const pInfo = activeMember.parts[pk];
        const btn = new KitButton({
          width: rightW - 28,
          height: 36,
          label: `${partLabels[pk]} (EV ${pInfo.ev}) · +16 EV (120 Oro)`,
          variant: 'secondary',
          iconId: 'star',
          disabled: !activeMember.hasBody || pInfo.ev >= 128,
          onClick: () => {
            if (state.player.money < 120) {
              GlobalAudioService.playSfx('cancel');
              this.statusMessage = 'No tienes suficiente Oro.';
              this.renderWorkshop();
              return;
            }
            state.player.money -= 120;
            let b = resolveDollBody(state, activeDoll.bodyInstanceId);
            if (!b && activeDoll.bodyInstanceId) {
              b = StatCalculator.createBodyInstance('chassis_madera_t1');
              b.instanceId = activeDoll.bodyInstanceId;
              state.bodies[b.instanceId] = b;
            }
            if (b) {
              b.evs[pk] = Math.min(252, (b.evs[pk] || 0) + 16);
              activeDoll.maxPartHP = StatCalculator.calculatePartMaxHp(
                activeDoll.stats.hp,
                b.chassisId,
                b.ivs,
                b.evs
              );
              StatCalculator.ensurePartHp(activeDoll);
            }
            GlobalSaveService.save();
            GlobalAudioService.playSfx('levelUp');
            this.statusMessage = `${partLabels[pk]} reforzada (+16 EV).`;
            this.renderWorkshop();
          },
        });
        btn.position.set(14, 42 + idx * 42);
        rightCard.addChild(btn);
        this.focusManager.register(btn.toFocusable());
      });

      const tierBtn = new KitButton({
        width: rightW - 28,
        height: 42,
        label: activeMember.canUpgradeTier
          ? t.upgrade_tier
              .replace('{tier}', String(activeMember.tier + 1))
              .replace('{gold}', String(activeMember.nextTierCostGold))
              .replace('{frag}', String(activeMember.nextTierCostFragments))
          : t.max_tier,
        variant: 'primary',
        iconId: 'star',
        disabled: !activeMember.canUpgradeTier,
        onClick: () => {
          if (state.player.money < activeMember.nextTierCostGold) {
            GlobalAudioService.playSfx('cancel');
            this.statusMessage = 'No tienes suficiente Oro para subir el Tier.';
            this.renderWorkshop();
            return;
          }
          state.player.money -= activeMember.nextTierCostGold;
          let b = resolveDollBody(state, activeDoll.bodyInstanceId);
          if (!b && activeDoll.bodyInstanceId) {
            b = StatCalculator.createBodyInstance('chassis_madera_t1');
            b.instanceId = activeDoll.bodyInstanceId;
            state.bodies[b.instanceId] = b;
          }
          if (b) {
            const nextTierChassis = Object.values(BODY_CHASSIS_DATA).find(
              (c) => c.tier === activeMember.tier + 1
            );
            if (nextTierChassis) {
              b.chassisId = nextTierChassis.id;
              b.nickname = nextTierChassis.name;
            }
          }
          GlobalSaveService.save();
          GlobalAudioService.playSfx('levelUp');
          this.statusMessage = 'Cuerpo mejorado al siguiente Tier.';
          this.renderWorkshop();
        },
      });
      tierBtn.position.set(14, 218);
      rightCard.addChild(tierBtn);
      this.focusManager.register(tierBtn.toFocusable());
    } else if (this.currentTab === 'bind') {
      const infoTxt = new Text({
        text: `Almas Selladas disponibles: ${vm.sealedSoulsCount}\nCuerpos Contenedores libres: ${vm.freeBodiesCount}`,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 13,
          fontWeight: 'bold',
          fill: COLOR_HEX.inkCrypt,
        }),
      });
      infoTxt.position.set(14, 48);
      rightCard.addChild(infoTxt);

      const openBindBtn = new KitButton({
        width: rightW - 28,
        height: 44,
        label: t.btn_open_binder,
        variant: 'primary',
        iconId: 'soul_bottle',
        onClick: () => {
          GlobalAudioService.playSfx('confirm');
          GlobalSceneManager.pushScene('SoulBinding');
        },
      });
      openBindBtn.position.set(14, 114);
      rightCard.addChild(openBindBtn);
      this.focusManager.register(openBindBtn.toFocusable());

      // Bloque 28B R4.2: Acceso físico a la Cámara de Resonancia QR desde el Taller de Artífices
      const openQrBtn = new KitButton({
        width: rightW - 28,
        height: 44,
        label: (esText as any).terms.gacha?.title || 'CÁMARA DE RESONANCIA QR',
        variant: 'secondary',
        iconId: 'soul_fragment',
        onClick: () => {
          GlobalAudioService.playSfx('confirm');
          GlobalSceneManager.pushScene('GachaResonance', { tab: 'scan' });
        },
      });
      openQrBtn.position.set(14, 170);
      rightCard.addChild(openQrBtn);
      this.focusManager.register(openQrBtn.toFocusable());
    } else if (this.currentTab === 'unbind' && activeMember && activeDoll) {
      const unbindBtn = new KitButton({
        width: rightW - 28,
        height: 44,
        label: t.btn_unbind_action,
        variant: 'danger',
        iconId: 'storage',
        disabled: vm.party.length <= 1 || !activeMember.hasBody,
        onClick: () => {
          activeDoll.bodyInstanceId = null;
          state.party.splice(this.selectedPartyIndex, 1);
          state.storage.push(activeDoll);
          GlobalSaveService.save();
          GlobalAudioService.playSfx('confirm');
          this.statusMessage = 'Alma extraída y enviada al Almacén.';
          this.renderWorkshop();
        },
      });
      unbindBtn.position.set(14, 60);
      rightCard.addChild(unbindBtn);
      this.focusManager.register(unbindBtn.toFocusable());
    }

    if (this.statusMessage) {
      const statusBadge = new KitBadge(this.statusMessage, 'tier', 'tier');
      statusBadge.position.set(14, rightH - 36);
      rightCard.addChild(statusBadge);
    }

    const totalH = isDesktop ? Math.max(leftH, rightH) + 64 : rightY + rightH + 24;
    this.screenFrame.setContentTotalHeight(totalH);

    UIKitLinter.inspectTree(this.screenFrame, 'WorkshopScene');
  }

  public update(_dt: number): void {
    this.screenFrame.updateInertia();
    this.focusManager.update();
    if (GlobalInput.justPressed('CANCEL')) {
      GlobalAudioService.playSfx('cancel');
      GlobalSceneManager.popScene();
    }
  }

  public render(): void {}

  public async exit(): Promise<void> {
    this.focusManager.clear();
    this.container.destroy({ children: true });
  }
}
