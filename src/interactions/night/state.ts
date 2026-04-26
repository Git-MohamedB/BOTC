// ============================================================
// État en mémoire pour la phase de Nuit
// ============================================================

import { ROLES } from '../../data/roles';
import { ROLE_TYPE_EMOJIS } from '../../utils/constants';

/** Action en attente dans la file de nuit */
export interface QueuedAction {
  index: number;
  roleId: string;
  playerId: string;        // ID BDD
  playerDiscordId: string; // ID Discord
  playerName: string;
  isDrunkOrPoisoned: boolean;
  completed: boolean;
}

/** Résultat d'une action traitée */
export interface ActionLog {
  roleId: string;
  roleName: string;
  playerName: string;
  description: string;      // Ex: "a choisi Bob"
  targets: string[];         // Noms des cibles
  causedDeaths: string[];    // IDs joueurs tués
}

/** Données en attente pour une action multi-étape */
export interface Step2Data {
  actionIndex: number;
  step1Values: string[];    // Valeurs sélectionnées à l'étape 1
  type: string;             // Type de step 2 attendu
}

/** État complet d'une nuit en cours */
export interface NightState {
  gameId: string;
  nightNumber: number;
  isFirstNight: boolean;
  queue: QueuedAction[];
  currentIndex: number;
  pendingDeaths: string[];     // Player IDs (BDD) qui meurent
  resolvedActions: ActionLog[];
  step2Pending?: Step2Data;
  dayDeathOccurred: boolean;   // Pour le Zombuul : y a-t-il eu un mort le jour ?
  pendingSelection?: string[]; // Pour stocker temporairement la valeur du SelectMenu
}

/**
 * Store en mémoire des états de nuit, clé = discordId du MJ.
 */
const nightStates = new Map<string, NightState>();

/** Récupère l'état de nuit pour un MJ */
export function getNightState(mjId: string): NightState | undefined {
  return nightStates.get(mjId);
}

/** Crée un nouvel état de nuit */
export function createNightState(
  mjId: string,
  gameId: string,
  nightNumber: number,
  isFirstNight: boolean,
  queue: QueuedAction[]
): NightState {
  const state: NightState = {
    gameId,
    nightNumber,
    isFirstNight,
    queue,
    currentIndex: 0,
    pendingDeaths: [],
    resolvedActions: [],
    dayDeathOccurred: false,
  };
  nightStates.set(mjId, state);
  return state;
}

/** Ajoute une mort en attente */
export function addPendingDeath(mjId: string, playerId: string): void {
  const state = nightStates.get(mjId);
  if (state && !state.pendingDeaths.includes(playerId)) {
    state.pendingDeaths.push(playerId);
  }
}

/** Retire une mort en attente */
export function removePendingDeath(mjId: string, playerId: string): void {
  const state = nightStates.get(mjId);
  if (state) {
    state.pendingDeaths = state.pendingDeaths.filter((id) => id !== playerId);
  }
}

/** Enregistre le résultat d'une action */
export function logAction(mjId: string, log: ActionLog): void {
  const state = nightStates.get(mjId);
  if (state) {
    state.resolvedActions.push(log);
  }
}

/** Marque l'action courante comme terminée et avance */
export function advanceToNextAction(mjId: string): QueuedAction | null {
  const state = nightStates.get(mjId);
  if (!state) return null;

  if (state.currentIndex < state.queue.length) {
    state.queue[state.currentIndex].completed = true;
  }
  state.currentIndex++;
  state.step2Pending = undefined;

  return state.currentIndex < state.queue.length
    ? state.queue[state.currentIndex]
    : null;
}

/** Supprime l'état de nuit (nettoyage) */
export function clearNightState(mjId: string): void {
  nightStates.delete(mjId);
}
