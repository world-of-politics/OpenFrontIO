import {
  GameMode,
  GameType,
  type Team,
} from "@openfront/engine-api/game/GameTypes";
import { renderTroops } from "@openfront/engine-lib/Format";
import { assetUrl } from "@openfront/shared/AssetUrls";
import type { EventBus } from "@openfront/shared/EventBus";
import { Colord } from "colord";
import { html, LitElement } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { isCompactViewport } from "../../CompactViewport";
import type { Controller } from "../../Controller";
import { AlternateViewEvent } from "../../InputHandler";
import { Platform } from "../../Platform";
import { themeProvider } from "../../theme/ThemeProvider";
import { getTranslatedPlayerTeamLabel, translateText } from "../../Utils";
import type { GameView } from "../../view";
import { ImmunityBarVisibleEvent } from "./ImmunityTimer";
import "./PlayerStats";
import type { PlayerStats } from "./PlayerStats";
import { ShowSettingsModalEvent } from "./SettingsModal";
import { SpawnBarVisibleEvent } from "./SpawnTimer";
import "./TeamStats";
import type { TeamStats } from "./TeamStats";
const playerStatsRegularIcon = assetUrl(
  "images/LeaderboardIconRegularWhite.svg",
);
const playerStatsSolidIcon = assetUrl("images/LeaderboardIconSolidWhite.svg");
const teamStatsRegularIcon = assetUrl("images/TeamIconRegularWhite.svg");
const teamStatsSolidIcon = assetUrl("images/TeamIconSolidWhite.svg");
const alternateViewIcon = assetUrl("images/TreeIconWhite.svg");

@customElement("game-left-sidebar")
export class GameLeftSidebar extends LitElement implements Controller {
  @state()
  private isPlayerStatsShown = false;
  @state()
  private isTeamStatsShown = false;
  @state()
  private isVisible = false;
  @state()
  private isPlayerTeamLabelVisible = false;
  @state()
  private playerTeam: Team | null = null;
  @state()
  private spawnBarVisible = false;
  @state()
  private immunityBarVisible = false;
  @state()
  private alternateView = false;
  /** Current allies, for the Diplomasi section (read-only readout). */
  @state()
  private allies: string[] = [];
  /** Outgoing attacks, for the Perang section (read-only readout). */
  @state()
  private attacks: { name: string; troops: number }[] = [];

  private playerColor: Colord = new Colord("#FFFFFF");
  @property({ attribute: false }) public game: GameView | null = null;
  @property({ attribute: false }) public eventBus: EventBus | null = null;
  @query("player-stats") private playerStats?: PlayerStats;
  @query("team-stats") private teamStats?: TeamStats;
  private showPlayerStatsAfterSpawn = false;

  createRenderRoot() {
    return this;
  }

  init() {
    this.isVisible = true;
    this.eventBus?.on(SpawnBarVisibleEvent, (e) => {
      this.spawnBarVisible = e.visible;
    });
    this.eventBus?.on(ImmunityBarVisibleEvent, (e) => {
      this.immunityBarVisible = e.visible;
    });
    // Holding the toggle-view key (space) or the settings toggle also switch
    // the view; keep the button in step with whichever did it last.
    this.eventBus?.on(AlternateViewEvent, (e) => {
      this.alternateView = e.alternateView;
    });
    if (this.isTeamGame) {
      this.isPlayerTeamLabelVisible = true;
    }
    // Make it visible by default on large screens; compact ones (short laptops,
    // Poki's frame) need the room for the map.
    if (Platform.isDesktopWidth && !isCompactViewport()) {
      this.showPlayerStatsAfterSpawn = true;
    }
  }

  getTickIntervalMs() {
    return 1000;
  }

  tick() {
    if (this.game === null) return;

    const team = this.game.myPlayer()?.team();
    if (this.playerTeam === null && team !== null && team !== undefined) {
      this.playerTeam = team;
      this.playerColor = themeProvider.current().teamColor(team);
    }

    if (this.showPlayerStatsAfterSpawn && !this.game.inSpawnPhase()) {
      this.showPlayerStatsAfterSpawn = false;
      this.isPlayerStatsShown = true;
    }

    if (!this.game.inSpawnPhase() && this.isPlayerTeamLabelVisible) {
      this.isPlayerTeamLabelVisible = false;
    }

    // Read-only section data: allies (Diplomasi) and outgoing attacks
    // (Perang). Both come straight from the live game state.
    const myPlayer = this.game.myPlayer();
    if (myPlayer !== null) {
      this.allies = myPlayer.allies().map((a) => a.name());
      this.attacks = myPlayer.outgoingAttacks().map((attack) => {
        let name = `#${attack.targetID}`;
        try {
          const target = this.game?.playerBySmallID(attack.targetID);
          if (target !== undefined && "name" in target) {
            name = (target as { name(): string }).name();
          }
        } catch {
          // Target left or is otherwise unresolvable; keep the id fallback.
        }
        return { name, troops: attack.troops };
      });
    }

    this.playerStats?.refresh();
    this.teamStats?.refresh();
  }

  private get barOffset(): number {
    return (this.spawnBarVisible ? 7 : 0) + (this.immunityBarVisible ? 7 : 0);
  }

  private togglePlayerStats(): void {
    this.isPlayerStatsShown = !this.isPlayerStatsShown;
  }

  private toggleTeamStats(): void {
    this.isTeamStatsShown = !this.isTeamStatsShown;
  }

  private toggleAlternateView(): void {
    this.eventBus?.emit(new AlternateViewEvent(!this.alternateView));
  }

  private openSettings(): void {
    const isSinglePlayer =
      this.game?.config()?.gameConfig()?.gameType === GameType.Singleplayer ||
      this.game?.config()?.isReplay() === true;
    this.eventBus?.emit(
      new ShowSettingsModalEvent(true, isSinglePlayer, false),
    );
  }

  private get isTeamGame(): boolean {
    return this.game?.config().gameConfig().gameMode === GameMode.Team;
  }

  render() {
    const toggleBtn = (active: boolean) =>
      `cursor-pointer p-0.5 border rounded-md transition-colors ${
        active
          ? "bg-gold/20 border-gold"
          : "bg-panel-2/80 hover:bg-panel-2 border-gold/25"
      }`;
    return html`
      <aside
        class=${`hud-panel max-lg:fixed max-lg:top-0 max-lg:left-0 max-lg:z-900 lg:pointer-events-auto flex flex-col gap-3 mt-(--bar-offset) max-h-[calc(100vh-80px)] overflow-y-auto p-3 w-64 bg-panel/94 backdrop-blur-sm shadow-xs rounded-br-lg ${this.isPlayerStatsShown || this.isTeamStatsShown ? "max-[400px]:w-full max-[400px]:rounded-none max-lg:mt-[calc(var(--bar-offset)+var(--game-health-offset,0px))] max-lg:max-h-[calc(100vh-80px-var(--game-health-offset,0px))]" : ""} transition-all duration-300 ease-out transform ${
          this.isVisible ? "translate-x-0" : "hidden"
        }`}
        style="--bar-offset: ${this.barOffset}px;"
      >
        <!-- PROFIL: player leaderboard -->
        <section class="flex flex-col gap-1.5 min-w-0">
          <h2 class="hud-section-title">Profil</h2>
          <button
            type="button"
            class="flex items-center gap-2 w-full text-left text-ink text-xs font-semibold px-1 py-1 rounded-md hover:bg-white/5 transition-colors"
            @click=${this.togglePlayerStats}
            aria-pressed=${this.isPlayerStatsShown ? "true" : "false"}
          >
            <span class=${toggleBtn(this.isPlayerStatsShown)}>
              <img
                src=${
                  this.isPlayerStatsShown
                    ? playerStatsSolidIcon
                    : playerStatsRegularIcon
                }
                alt=${
                  translateText("help_modal.icon_alt_player_leaderboard") ||
                  "Player Leaderboard Icon"
                }
                width="20"
                height="20"
              />
            </span>
            Leaderboard
            ${
              this.isPlayerStatsShown || this.isTeamStatsShown
                ? html`<span
                    class="ml-auto text-[10px] text-muted select-all leading-none"
                    title=${translateText("help_modal.game_id_tooltip")}
                    >${this.game?.gameID() ?? ""}</span
                  >`
                : null
            }
          </button>
          <player-stats
            class=${this.isPlayerStatsShown ? "block min-w-0" : "hidden"}
            .game=${this.game}
            .eventBus=${this.eventBus}
            .visible=${this.isPlayerStatsShown}
          ></player-stats>
        </section>

        <!-- NEGARA: team leaderboard (team games only) -->
        ${
          this.isTeamGame
            ? html`
                <section class="flex flex-col gap-1.5 min-w-0">
                  <h2 class="hud-section-title">Negara</h2>
                  <button
                    type="button"
                    class="flex items-center gap-2 w-full text-left text-ink text-xs font-semibold px-1 py-1 rounded-md hover:bg-white/5 transition-colors"
                    @click=${this.toggleTeamStats}
                    aria-pressed=${this.isTeamStatsShown ? "true" : "false"}
                  >
                    <span class=${toggleBtn(this.isTeamStatsShown)}>
                      <img
                        src=${
                          this.isTeamStatsShown
                            ? teamStatsSolidIcon
                            : teamStatsRegularIcon
                        }
                        alt=${
                          translateText(
                            "help_modal.icon_alt_team_leaderboard",
                          ) || "Team Leaderboard Icon"
                        }
                        width="20"
                        height="20"
                      />
                    </span>
                    Tim
                  </button>
                  <team-stats
                    class=${this.isTeamStatsShown ? "block min-w-0" : "hidden"}
                    .game=${this.game}
                    .visible=${this.isTeamStatsShown}
                  ></team-stats>
                </section>
              `
            : null
        }
        ${
          this.isPlayerTeamLabelVisible
            ? html`
                <div
                  class="flex items-center w-full text-ink text-xs"
                  @contextmenu=${(e: Event) => e.preventDefault()}
                >
                  ${translateText("help_modal.ui_your_team")}
                  <span
                    style="--color: ${this.playerColor.toRgbString()}"
                    class="text-(--color)"
                  >
                    &nbsp;${getTranslatedPlayerTeamLabel(
                      this.playerTeam,
                      this.game?.teamClanTag(this.playerTeam),
                    )}
                    &#10687;
                  </span>
                </div>
              `
            : null
        }

        <!-- DIPLOMASI: current allies, read-only -->
        <section class="flex flex-col gap-1.5 min-w-0">
          <h2 class="hud-section-title">Diplomasi</h2>
          ${
            this.allies.length === 0
              ? html`<p class="text-xs text-muted px-1">No allies yet</p>`
              : html`<ul class="flex flex-col gap-1 px-1">
                  ${this.allies.map(
                    (name) => html`
                      <li
                        class="flex items-center gap-1.5 text-xs text-ink truncate"
                        translate="no"
                      >
                        <span class="text-teal-accent" aria-hidden="true"
                          >🤝</span
                        >
                        ${name}
                      </li>
                    `,
                  )}
                </ul>`
          }
        </section>

        <!-- PERANG: outgoing attacks, read-only -->
        <section class="flex flex-col gap-1.5 min-w-0">
          <h2 class="hud-section-title">Perang</h2>
          ${
            this.attacks.length === 0
              ? html`<p class="text-xs text-muted px-1">No active attacks</p>`
              : html`<ul class="flex flex-col gap-1 px-1">
                  ${this.attacks.map(
                    (attack) => html`
                      <li
                        class="flex items-center justify-between gap-2 text-xs text-ink"
                      >
                        <span class="truncate" translate="no"
                          >⚔️ ${attack.name}</span
                        >
                        <span class="text-rose-accent font-bold tabular-nums"
                          >${renderTroops(attack.troops)}</span
                        >
                      </li>
                    `,
                  )}
                </ul>`
          }
        </section>

        <!-- PENGATURAN: map view toggle + settings modal -->
        <section class="flex flex-col gap-1.5 min-w-0">
          <h2 class="hud-section-title">Pengaturan</h2>
          <button
            type="button"
            class="flex items-center gap-2 w-full text-left text-ink text-xs font-semibold px-1 py-1 rounded-md hover:bg-white/5 transition-colors"
            @click=${this.toggleAlternateView}
            aria-pressed=${this.alternateView ? "true" : "false"}
            title=${translateText("user_setting.toggle_view_desc")}
          >
            <span class=${toggleBtn(this.alternateView)}>
              <img
                src=${alternateViewIcon}
                alt=${translateText("user_setting.toggle_view_desc")}
                width="20"
                height="20"
              />
            </span>
            Tampilan Peta
          </button>
          <button
            type="button"
            class="flex items-center gap-2 w-full text-left text-ink text-xs font-semibold px-1 py-1 rounded-md hover:bg-white/5 transition-colors"
            @click=${this.openSettings}
          >
            <span class=${toggleBtn(false)}>⚙️</span>
            Pengaturan
          </button>
        </section>
        <slot></slot>
      </aside>
    `;
  }
}
