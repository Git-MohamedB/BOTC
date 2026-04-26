// ============================================================
// État en mémoire pour la phase de Jour
// ============================================================

/** Enregistrement d'une nomination */
export interface NominationRecord {
  nomineeId: string;      // Player DB ID
  nomineeName: string;
  voters: string[];        // Player DB IDs qui ont voté OUI
  voterNames: string[];    // Display names
  ghostVoters: string[];   // IDs des morts qui ont utilisé leur ghost vote
  totalVotes: number;
  threshold: number;
  passed: boolean;         // Au-dessus du seuil ?
}

/** État complet d'un jour en cours */
export interface DayState {
  gameId: string;
  dayNumber: number;
  nominations: NominationRecord[];
  /** Joueur avec le plus de votes au-dessus du seuil (sera exécuté en fin de jour) */
  markedForExecution?: {
    playerId: string;
    playerName: string;
    voteCount: number;
  };
  /** L'exécution a-t-elle déjà eu lieu ? */
  executionDone: boolean;
  /** Timestamp Discord pour le timer */
  timerEnd?: number;
  /** Message ID du timer dans le channel public */
  timerMsgId?: string;
}

/**
 * Store en mémoire des états de jour, clé = discordId du MJ.
 */
const dayStates = new Map<string, DayState>();

export function getDayState(mjId: string): DayState | undefined {
  return dayStates.get(mjId);
}

export function createDayState(
  mjId: string,
  gameId: string,
  dayNumber: number
): DayState {
  const state: DayState = {
    gameId,
    dayNumber,
    nominations: [],
    executionDone: false,
  };
  dayStates.set(mjId, state);
  return state;
}

/**
 * Met à jour le marqué pour exécution si cette nomination a plus de votes
 * que la précédente.
 */
export function updateExecutionMark(
  mjId: string,
  nomination: NominationRecord
): void {
  const state = dayStates.get(mjId);
  if (!state) return;

  if (nomination.passed) {
    if (
      !state.markedForExecution ||
      nomination.totalVotes > state.markedForExecution.voteCount
    ) {
      state.markedForExecution = {
        playerId: nomination.nomineeId,
        playerName: nomination.nomineeName,
        voteCount: nomination.totalVotes,
      };
    }
  }
}

export function clearDayState(mjId: string): void {
  dayStates.delete(mjId);
}
