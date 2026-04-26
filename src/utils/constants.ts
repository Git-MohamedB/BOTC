// ============================================================
// Constantes globales du bot BotC
// ============================================================

/** Couleurs des embeds par contexte */
export const COLORS = {
  SETUP: 0x2ecc71,    // Vert — Configuration
  NIGHT: 0x9b59b6,    // Violet — Nuit
  DAY: 0xf39c12,      // Or — Jour
  ERROR: 0xe74c3c,    // Rouge — Erreur
  INFO: 0x3498db,     // Bleu — Information
  SUCCESS: 0x27ae60,  // Vert foncé — Succès
  EVIL: 0x8b0000,     // Rouge sombre — Camp maléfique
  GOOD: 0x2e8b57,     // Vert forêt — Camp gentil
} as const;

/** Emojis utilisés dans les messages */
export const EMOJIS = {
  ALIVE: '💚',
  DEAD: '💀',
  DRUNK: '🍺',
  POISONED: '☠️',
  GOOD: '👼',
  EVIL: '😈',
  DEMON: '👹',
  TOWNSFOLK: '🏠',
  OUTSIDER: '🌙',
  MINION: '🗡️',
  FORCED: '📌',
  CHECK: '✅',
  CROSS: '❌',
  WARNING: '⚠️',
  SCROLL: '📜',
  DICE: '🎲',
  MOON: '🌙',
  SUN: '☀️',
  CROWN: '👑',
  GEAR: '⚙️',
} as const;

/** Labels des types de rôles */
export const ROLE_TYPE_LABELS = {
  TOWNSFOLK: '🏠 Citadins',
  OUTSIDER: '🌙 Étrangers',
  MINION: '🗡️ Sbires',
  DEMON: '👹 Démon',
  FABLED: '🎭 MJ / Fables',
} as const;

/** Emojis par type de rôle */
export const ROLE_TYPE_EMOJIS = {
  TOWNSFOLK: '🏠',
  OUTSIDER: '🌙',
  MINION: '🗡️',
  DEMON: '👹',
  FABLED: '🎭',
} as const;

/**
 * Custom IDs pour les interactions Discord.
 * Convention : <flow>_<action> ou <flow>_<action>_<param>
 */
export const CUSTOM_IDS = {
  // ── Flow de Setup ──
  SETUP_SELECT_PLAYERS: 'setup_select_players',
  SETUP_VALIDATE_ORDER: 'setup_validate_order',
  SETUP_EDIT_ORDER: 'setup_edit_order',
  SETUP_MODAL_ORDER: 'setup_modal_order',
  SETUP_REROLL_ALL: 'setup_reroll_all',
  SETUP_REROLL_ROLES: 'setup_reroll_roles',
  SETUP_FORCE_ROLE: 'setup_force_role',
  SETUP_FORCE_SEAT_PREFIX: 'setup_force_seat_',     // + seatIndex
  SETUP_FORCE_PICK_PREFIX: 'setup_force_pick_',     // + seatIndex
  SETUP_START_GAME: 'setup_start_game',
  SETUP_CANCEL: 'setup_cancel',

  // ── Flow de Nuit ──
  NIGHT_BEGIN: 'night_begin',
  NIGHT_PREV: 'night_prev',
  NIGHT_ACTION_PREFIX: 'night_act_',
  NIGHT_STEP2_PREFIX: 'night_s2_',
  NIGHT_SKIP_PREFIX: 'night_skip_',
  NIGHT_SELECT_DEATHS: 'night_select_deaths',
  NIGHT_WAKE: 'night_wake',

  // ── Flow de Jour ──
  DAY_TIMER: 'day_timer',
  DAY_TIMER_ADD: 'day_timer_add',
  DAY_NOMINATE: 'day_nominate',
  DAY_NOM_SELECT: 'day_nom_select',
  DAY_VOTE: 'day_vote',
  DAY_CANCEL_NOM: 'day_cancel_nom',
  DAY_END: 'day_end',
  DAY_EXEC_CONFIRM: 'day_exec_confirm',
  DAY_CANCEL_EXEC: 'day_cancel_exec',
  DAY_SKIP_EXEC: 'day_skip_exec',

  // ── Outils MJ (toujours disponibles) ──
  MJ_EDIT: 'mj_edit',
  MJ_LOGS: 'mj_logs',
  MJ_END_GAME: 'mj_end',
  MJ_END_CONFIRM_GOOD: 'mj_end_good',
  MJ_END_CONFIRM_EVIL: 'mj_end_evil',
  MJ_END_CANCEL: 'mj_end_cancel',
} as const;

/** Délai entre chaque MP envoyé en masse (ms) - Rate limit Discord */
export const DM_BATCH_DELAY_MS = 750;

/** Nombre de joueurs min/max supporté */
export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 15;
