// ============================================================
// État en mémoire pour le flow de Setup
// ============================================================
// Cet état est temporaire et sert de cache pendant la configuration.
// Si le bot redémarre, l'état est perdu, mais le MJ peut re-configurer
// puisque la partie est encore en statut SETUP en base.

/** État de configuration d'une partie en cours de setup */
export interface SetupState {
  /** Rôles forcés par le MJ : seatOrder → roleId */
  forcedRoles: Map<number, string>;
  /** Derniers rôles générés (indexés par seatOrder) */
  generatedRoles: string[];
}

/**
 * Store en mémoire des états de setup, clé = discordId du MJ.
 * On utilise le discordId car un MJ ne peut avoir qu'une partie active.
 */
const setupStates = new Map<string, SetupState>();

/** Récupère ou crée l'état de setup pour un MJ */
export function getSetupState(mjId: string): SetupState {
  let state = setupStates.get(mjId);
  if (!state) {
    state = {
      forcedRoles: new Map(),
      generatedRoles: [],
    };
    setupStates.set(mjId, state);
  }
  return state;
}

/** Met à jour les rôles générés dans le state */
export function setGeneratedRoles(mjId: string, roles: string[]): void {
  const state = getSetupState(mjId);
  state.generatedRoles = roles;
}

/** Ajoute un rôle forcé */
export function setForcedRole(mjId: string, seatOrder: number, roleId: string): void {
  const state = getSetupState(mjId);
  state.forcedRoles.set(seatOrder, roleId);
}

/** Supprime tous les rôles forcés (pour Reroll Tout) */
export function clearForcedRoles(mjId: string): void {
  const state = getSetupState(mjId);
  state.forcedRoles.clear();
}

/** Supprime l'état de setup (nettoyage après lancement) */
export function clearSetupState(mjId: string): void {
  setupStates.delete(mjId);
}
