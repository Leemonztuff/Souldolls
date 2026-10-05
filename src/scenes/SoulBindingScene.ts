import { Container, Sprite, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalSaveService } from '../services/SaveService';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalInput } from '../core/Input';
import { StatCalculator } from '../systems/battle/StatCalculator';
import { CREATURES_DATA } from '../data/creatures/creatures';
import { BODY_CHASSIS_DATA } from '../data/bodies/chassis';
import { HumanoidPartSilhouette } from '../render/ui/HumanoidPartSilhouette';
import { GlobalAssetRegistry } from '../render/procedural/AssetRegistry';
import { SoulDollSpriteFactory } from '../render/procedural/SoulDollSpriteFactory';
import {
  ScreenFrame,
  KitCard,
  KitListRow,
  KitStatBox,
  KitBadge,
  FocusManager,
  UIKitLinter,
} from '../ui/kit';
import { COLOR_HEX, FONTS } from '../ui/styles';
import {
  buildBindingPreviewVM,
  getFreeBodiesList,
  getSealedSoulsList,
} from '../ui/viewmodels/GroupBViewModels';
import esText from '../data/text/es.json';

export class SoulBindingScene implements IScene {
  public name = 'SoulBinding';
  private container: Container = new Container();
  private screenFrame!: ScreenFrame;
  private focusManager: FocusManager = new FocusManager();
  private selectedSoulIdx = 0;
  private selectedBodyIdx = 0;

  public async enter(): Promise<void> {
    this.container = new Container();
    this.container.roundPixels = true;
    this.container.zIndex = 1050;
    GlobalPixiRenderer.menuLayer.addChild(this.container);
    this.renderBinding();
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
      this.container.zIndex = 1050;
    }
    this.container.visible = true;
    if (this.container.parent !== GlobalPixiRenderer.menuLayer) {
      GlobalPixiRenderer.menuLayer.addChild(this.container);
    }
    this.renderBinding();
  }

  public onResize(_width: number, _height: number): void {
    this.renderBinding();
  }

  private renderBinding(): void {
    this.container.removeChildren();
    this.focusManager.clear();

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;
    const isDesktop = width >= 840;
    const state = GlobalSaveService.getCurrentState();
    const t = (esText as any).terms.group_b.binding;

    const souls = getSealedSoulsList(state);
    const bodies = getFreeBodiesList(state);
    if (this.selectedSoulIdx >= souls.length) this.selectedSoulIdx = Math.max(0, souls.length - 1);
    if (this.selectedBodyIdx >= bodies.length) this.selectedBodyIdx = Math.max(0, bodies.length - 1);

    const preview = buildBindingPreviewVM(state, this.selectedSoulIdx, this.selectedBodyIdx);

    this.screenFrame = new ScreenFrame({
      width,
      height,
      title: t.title,
      currencies: [
        { iconId: 'soul_bottle', value: souls.length },
        { iconId: 'body_chassis', value: bodies.length },
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
        label: t.btn_bind,
        iconId: 'soul_bottle',
        disabled: !preview.hasSelection,
        onClick: () => this.executeBind(),
      },
    });
    this.container.addChild(this.screenFrame);

    const cw = this.screenFrame.contentWidth;
    const colW = isDesktop ? Math.floor((cw - 12) / 2) : cw;

    const soulRowH = 48;
    const soulsCardH = Math.max(150, souls.length * (soulRowH + 6) + 52);
    const soulsCard = new KitCard({
      width: colW,
      height: soulsCardH,
      variant: 'smokedWood',
      title: t.sec_souls,
    });
    soulsCard.position.set(0, 0);
    this.screenFrame.contentRoot.addChild(soulsCard);

    if (souls.length === 0) {
      const emptyTxt = new Text({
        text: t.empty_souls,
        style: new TextStyle({ fontFamily: FONTS.body, fontSize: 13, fill: COLOR_HEX.smoke }),
      });
      emptyTxt.position.set(14, 48);
      soulsCard.addChild(emptyTxt);
    } else {
      souls.forEach((soul, idx) => {
        const sp = CREATURES_DATA[soul.speciesId];
        const row = new KitListRow({
          width: colW - 20,
          height: soulRowH,
          iconId: 'soul_bottle',
          title: soul.nickname || sp?.name || soul.speciesId,
          subtitle: `${sp?.classId?.toUpperCase() || ''} · ${(sp?.types || []).join('/')}`,
          valueText: `Nv.${soul.level}`,
          selected: idx === this.selectedSoulIdx,
          onClick: () => {
            this.selectedSoulIdx = idx;
            this.renderBinding();
          },
        });
        row.position.set(10, 38 + idx * (soulRowH + 6));
        soulsCard.addChild(row);
        this.focusManager.register({
          container: row,
          width: colW - 20,
          height: soulRowH,
          onActivate: () => {
            this.selectedSoulIdx = idx;
            this.renderBinding();
          },
        });
      });
    }

    const bodyRowH = 48;
    const bodiesCardH = Math.max(150, bodies.length * (bodyRowH + 6) + 52);
    const bodiesCard = new KitCard({
      width: colW,
      height: bodiesCardH,
      variant: 'smokedWood',
      title: t.sec_bodies,
    });
    bodiesCard.position.set(isDesktop ? colW + 12 : 0, isDesktop ? 0 : soulsCardH + 12);
    this.screenFrame.contentRoot.addChild(bodiesCard);

    if (bodies.length === 0) {
      const emptyTxt = new Text({
        text: t.empty_bodies,
        style: new TextStyle({ fontFamily: FONTS.body, fontSize: 13, fill: COLOR_HEX.smoke }),
      });
      emptyTxt.position.set(14, 48);
      bodiesCard.addChild(emptyTxt);
    } else {
      bodies.forEach((body, idx) => {
        const ch = BODY_CHASSIS_DATA[body.chassisId] || BODY_CHASSIS_DATA['chassis_madera_t1'];
        const avgDur = body.partDurability
          ? Math.round(
              ((body.partDurability.head ?? 100) +
                (body.partDurability.torso ?? 100) +
                (body.partDurability.arms ?? 100) +
                (body.partDurability.legs ?? 100)) /
                4
            )
          : 100;
        const row = new KitListRow({
          width: colW - 20,
          height: bodyRowH,
          iconId: 'body_chassis',
          title: body.nickname || ch?.name || 'Cuerpo',
          subtitle: `${(ch?.material || 'madera').toUpperCase()} · Tier ${ch?.tier || 1}`,
          valueText: `Dur ${avgDur}%`,
          selected: idx === this.selectedBodyIdx,
          onClick: () => {
            this.selectedBodyIdx = idx;
            this.renderBinding();
          },
        });
        row.position.set(10, 38 + idx * (bodyRowH + 6));
        bodiesCard.addChild(row);
        this.focusManager.register({
          container: row,
          width: colW - 20,
          height: bodyRowH,
          onActivate: () => {
            this.selectedBodyIdx = idx;
            this.renderBinding();
          },
        });
      });
    }

    const prevY = isDesktop ? Math.max(soulsCardH, bodiesCardH) + 12 : soulsCardH + bodiesCardH + 24;
    const prevH = 220;
    const prevCard = new KitCard({
      width: cw,
      height: prevH,
      variant: 'parchment',
      title: t.sec_preview,
    });
    prevCard.position.set(0, prevY);
    this.screenFrame.contentRoot.addChild(prevCard);

    if (preview.hasSelection) {
      const compatBadge = new KitBadge(
        preview.isCompatible ? t.compat_bonus : t.compat_normal,
        'tier',
        'tier'
      );
      compatBadge.position.set(14, 40);
      prevCard.addChild(compatBadge);

      const sil = new HumanoidPartSilhouette();
      sil.position.set(14, 72);
      sil.updateParts(preview.partMaxHP, preview.partMaxHP);
      prevCard.addChild(sil);

      const selectedSoul = souls[this.selectedSoulIdx];
      if (selectedSoul) {
        const previewCanvas = SoulDollSpriteFactory.generateLayeredCanvas({
          speciesId: selectedSoul.speciesId,
          view: 'view_side',
        });
        const previewTex = GlobalAssetRegistry.createCrispPixiTexture(previewCanvas);
        const spr = new Sprite(previewTex);
        spr.roundPixels = true;
        spr.anchor.set(0.5, 1.0);
        spr.scale.set(1);
        spr.position.set(92, 206);
        prevCard.addChild(spr);
      }

      const statsList: Array<{ key: 'hp' | 'atk' | 'def' | 'spAtk' | 'spDef' | 'speed'; label: string; val: number }> = [
        { key: 'hp', label: 'PS', val: preview.hpMax },
        { key: 'atk', label: 'ATK', val: preview.atk },
        { key: 'def', label: 'DEF', val: preview.def },
        { key: 'spAtk', label: 'AT.ESP', val: preview.spAtk },
        { key: 'spDef', label: 'DF.ESP', val: preview.spDef },
        { key: 'speed', label: 'VEL', val: preview.speed },
      ];
      const gridW = cw - 144;
      const boxW = Math.floor((gridW - 16) / 3);
      statsList.forEach((st, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const sb = new KitStatBox({
          statKey: st.key,
          label: st.label,
          value: st.val,
          width: boxW,
          height: 54,
        });
        sb.position.set(126 + col * (boxW + 8), 72 + row * 62);
        prevCard.addChild(sb);
      });
    }

    this.screenFrame.setContentTotalHeight(prevY + prevH + 24);
    UIKitLinter.inspectTree(this.screenFrame, 'SoulBindingScene');
  }

  private executeBind(): void {
    const state = GlobalSaveService.getCurrentState();
    const souls = getSealedSoulsList(state);
    const bodies = getFreeBodiesList(state);
    const soul = souls[this.selectedSoulIdx];
    const body = bodies[this.selectedBodyIdx];
    if (!soul || !body) return;

    soul.bodyInstanceId = body.instanceId;
    soul.maxPartHP = StatCalculator.calculatePartMaxHp(soul.stats.hp, body.chassisId, body.ivs, body.evs);
    soul.partHP = { ...soul.maxPartHP };
    StatCalculator.ensurePartHp(soul);

    const stIdx = state.storage.findIndex((s) => s.uid === soul.uid);
    if (stIdx >= 0) {
      state.storage.splice(stIdx, 1);
    }

    if (state.party.length < 6) {
      state.party.push(soul);
    } else {
      state.storage.push(soul);
    }

    GlobalSaveService.save();
    GlobalAudioService.playSfx('levelUp');
    GlobalSceneManager.popScene();
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
