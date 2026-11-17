import { GameType, type Gold } from "@openfront/engine-api/game/GameTypes";
import { renderNumber, renderTroops } from "@openfront/engine-lib/Format";
import type { PublicProgress } from "@openfront/shared/ApiSchemas";
import type { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { getUserMe } from "../../Api";
import "../../components/LevelBadge";
import type { Controller } from "../../Controller";
import { levelFraction } from "../../Progression";
import type { GameView } from "../../view";
import { goldCoinIcon, soldierIcon } from "../HotbarIcons";

const MAX_TIMER_SECONDS = 60;

/**
 * Parlamentum-style dashboard top bar (try-it reskin, visuals only).
 *
 * A dense top-centre strip: player name + account level badge + XP bar,
 * gold and troop readouts, and the game clock. Everything here is a readout
 * of state the HUD already shows elsewhere (ControlPanel, GameRightSidebar);
 * it changes no game behaviour and adds no new systems.
 */
@customElement("game-top-bar")
export class GameTopBar extends LitElement implements Controller {
  @property({ attribute: false }) public game: GameView | null = null;
  @property({ attribute: false }) public eventBus: EventBus | null = null;

  @state()
  private _isVisible = false;
  @state()
  private _gold: Gold = 0n;
  @state()
  private _troops = 0;
  @state()
  private _maxTroops = 0;
  @state()
  private _timer = 0;
  @state()
  private _progress: PublicProgress | null = null;

  createRenderRoot() {
    return this;
  }

  init() {
    this._isVisible = true;
    // Memoised: normally answered from the profile loaded at sign-in, so
    // this is not a new request. Guests / progression-off stay null and the
    // badge + XP bar are simply left out.
    void getUserMe().then((me) => {
      if (me !== false && me.player.progress !== undefined) {
        this._progress = me.player.progress;
      }
    });
  }

  getTickIntervalMs() {
    return 1000;
  }

  tick() {
    if (this.game === null) return;
    const player = this.game.myPlayer();
    if (player === null || !player.isAlive()) {
      this.setVisible(false);
      return;
    }
    this.setVisible(true);
    this._gold = player.gold();
    this._troops = player.troops();
    this._maxTroops = this.game.config().maxTroops(player);
    this._timer = this.computeTimer();
    this.requestUpdate();
  }

  private setVisible(visible: boolean) {
    if (this._isVisible !== visible) {
      this._isVisible = visible;
      this.requestUpdate();
    }
  }

  /** Same clock the right sidebar shows: spawn countdown, then elapsed time
   * (or the countdown to the game-end timer when one is set). */
  private computeTimer(): number {
    const game = this.game;
    if (game === null) return 0;
    if (game.inSpawnPhase()) {
      if (
        game.config().gameConfig().gameType === GameType.Singleplayer ||
        game.config().isReplay()
      ) {
        const maxTimerValue = game.config().gameConfig().maxTimerValue;
        return maxTimerValue !== null && maxTimerValue !== undefined
          ? maxTimerValue * 60
          : 0;
      }
      const remainingTicks = game.config().numSpawnPhaseTurns() - game.ticks();
      return Math.max(0, Math.ceil(remainingTicks / 10));
    }
    const elapsedSeconds = Math.floor(game.elapsedGameSeconds());
    const maxTimerValue = game.config().gameConfig().maxTimerValue;
    if (maxTimerValue !== null && maxTimerValue !== undefined) {
      return Math.max(0, maxTimerValue * 60 - elapsedSeconds);
    }
    return elapsedSeconds;
  }

  private secondsToHms(d: number): string {
    const pad = (n: number) => (n < 10 ? `0${n}` : n);
    const h = Math.floor(d / 3600);
    const m = Math.floor((d % 3600) / 60);
    const s = Math.floor((d % 3600) % 60);
    return h !== 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  private renderXpBar() {
    const progress = this._progress;
    if (progress === null) return nothing;
    const fraction =
      progress.xpInLevel !== undefined && progress.xpForNext !== undefined
        ? levelFraction(progress.xpInLevel, progress.xpForNext)
        : 0;
    return html`
      <div class="flex items-center gap-1.5 min-w-0">
        <level-badge
          class="shrink-0"
          .level=${progress.level}
          .prestige=${progress.prestige}
          ?legend=${progress.legend}
          size="22"
        ></level-badge>
        <div
          class="w-24 h-2 rounded-full bg-black/50 border border-gold/30 overflow-hidden"
          title=${`Level ${progress.level}`}
        >
          <div
            class="h-full bg-gold transition-[width] duration-500"
            style="width: ${Math.round(fraction * 100)}%;"
          ></div>
        </div>
        <span class="text-[11px] font-bold text-gold tabular-nums"
          >Lv ${progress.level}</span
        >
      </div>
    `;
  }

  render() {
    if (!this._isVisible || this.game === null) return html``;
    const player = this.game.myPlayer();
    const name = player?.name() ?? "";
    const isEndTimer =
      this.game.config().gameConfig().maxTimerValue !== null &&
      this.game.config().gameConfig().maxTimerValue !== undefined &&
      !this.game.inSpawnPhase();
    return html`
      <div
        class="hud-panel pointer-events-none hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-b-lg text-ink"
        @contextmenu=${(e: Event) => e.preventDefault()}
      >
        <!-- Profil: name + level/XP -->
        <span
          class="max-w-44 truncate text-sm font-bold tracking-wide"
          translate="no"
          >${name}</span
        >
        ${this.renderXpBar()}
        <span class="text-gold/40 select-none" aria-hidden="true">|</span>
        <!-- Resources: gold + troops (same readouts as the control panel) -->
        <span class="hud-chip text-xs" translate="no">
          <img src=${goldCoinIcon} width="13" height="13" alt="" />
          ${renderNumber(this._gold)}
        </span>
        <span class="hud-chip text-xs" translate="no">
          <img
            src=${soldierIcon}
            width="13"
            height="13"
            alt=""
            class="brightness-0 invert"
          />
          ${renderTroops(this._troops)}<span class="text-muted font-medium"
            >/${renderTroops(this._maxTroops)}</span
          >
        </span>
        <span class="text-gold/40 select-none" aria-hidden="true">|</span>
        <!-- Game clock -->
        <span
          data-game-timer
          class="text-sm font-bold tabular-nums ${
            isEndTimer && this._timer <= MAX_TIMER_SECONDS
              ? "text-rose-accent"
              : "text-gold"
          }"
          translate="no"
          >${this.secondsToHms(this._timer)}</span
        >
      </div>
    `;
  }
}
