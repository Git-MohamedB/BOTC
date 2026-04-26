// ============================================================
// Service : Moteur de Nuit (Night Engine)
// ============================================================
// Gère la configuration des actions de nuit par rôle,
// la construction de la file d'actions, et la résolution.

import { ROLES, getNightOrderRoles } from '../data/roles';
import { RoleType } from '../types/game';
import type { QueuedAction } from '../interactions/night/state';
import { ROLE_TYPE_EMOJIS } from '../utils/constants';

// ============================================================
// Configuration des actions de nuit par rôle
// ============================================================

/** Type d'input attendu du MJ */
export type NightInputType =
  | 'select_player'         // Choisir 1 joueur vivant
  | 'select_two_players'    // Choisir 2 joueurs vivants
  | 'select_role'           // Choisir un rôle/personnage
  | 'confirm'               // Oui / Non (une fois par partie)
  | 'info'                  // Affichage info, bouton continuer
  | 'none';                 // Pas d'action MJ

/** Type d'étape 2 (pour actions multi-étapes) */
export type Step2Type =
  | 'drunk_choice'          // Qui devient ivre parmi 2
  | 'kill_count'            // 0, 1 ou 2 kills
  | 'select_role'           // Choisir un rôle (Parieur devine)
  | 'select_player'         // Cible après avoir activé pouvoir
  | 'select_dead_player'    // Choisir un joueur mort
  | 'resurrect_choice'      // Ressusciter ? Oui/Non + cible
  | null;

/** Configuration complète d'une action de nuit */
export interface RoleNightConfig {
  roleId: string;
  prompt: string;              // Texte pour le MJ (utilise {name} comme placeholder)
  inputType: NightInputType;
  step2Type: Step2Type;
  step2Prompt?: string;        // Texte pour l'étape 2 (utilise {name}, {target})
  canKill: boolean;
  firstNightPrompt?: string;   // Prompt différent pour la 1ère nuit
  firstNightInput?: NightInputType; // Input différent pour la 1ère nuit
  drunkWarning: string;        // Message si le joueur est ivre/empoisonné
  notes?: string;              // Notes pour le MJ
}

/**
 * Registre des actions de nuit pour chaque rôle.
 * Seuls les rôles avec des actions de nuit y figurent.
 */
export const NIGHT_CONFIGS: Record<string, RoleNightConfig> = {

  // ── CITADINS ──

  sailor: {
    roleId: 'sailor',
    prompt: '🏠 **Le Marin** ({name}) se réveille.\nChoisis un joueur : l\'un des deux deviendra ivre.',
    inputType: 'select_player',
    step2Type: 'drunk_choice',
    step2Prompt: 'Qui devient ivre jusqu\'au crépuscule ?',
    canKill: false,
    drunkWarning: '⚠️ Le Marin est ivre/empoisonné. Son pouvoir n\'a aucun effet.',
    notes: 'Le Marin ne peut pas mourir la nuit.',
  },

  courtier: {
    roleId: 'courtier',
    prompt: '🏠 **Le Courtisan** ({name}) souhaite-t-il utiliser son pouvoir ?',
    inputType: 'confirm',
    step2Type: 'select_role',
    step2Prompt: 'Choisis un personnage à rendre ivre pour 3 jours et nuits :',
    canKill: false,
    drunkWarning: '⚠️ Le Courtisan est ivre/empoisonné. Son pouvoir n\'a aucun effet.',
    notes: 'Pouvoir unique (une fois par partie).',
  },

  innkeeper: {
    roleId: 'innkeeper',
    prompt: '🏠 **L\'Aubergiste** ({name}) se réveille.\nChoisis 2 joueurs à protéger ce soir :',
    inputType: 'select_two_players',
    step2Type: 'drunk_choice',
    step2Prompt: 'Lequel des 2 est ivre jusqu\'au crépuscule ?',
    canKill: false,
    drunkWarning: '⚠️ L\'Aubergiste est ivre/empoisonné. Personne n\'est protégé.',
  },

  devils_advocate: {
    roleId: 'devils_advocate',
    prompt: '🗡️ **L\'Avocat du Diable** ({name}) se réveille.\nChoisis un joueur à protéger de l\'exécution demain :',
    inputType: 'select_player',
    step2Type: null,
    canKill: false,
    drunkWarning: '⚠️ L\'Avocat est ivre/empoisonné. La protection n\'a aucun effet.',
    notes: 'Ne peut pas choisir le même joueur DEUX NUITS DE SUITE. Le bot vous alertera si vous essayez.',
  },

  gambler: {
    roleId: 'gambler',
    prompt: '🏠 **Le Parieur** ({name}) se réveille.\nChoisis un joueur à cibler :',
    inputType: 'select_player',
    step2Type: 'select_role',
    step2Prompt: 'Quel rôle le Parieur devine-t-il pour {target} ?',
    canKill: true,
    drunkWarning: '⚠️ Le Parieur est ivre/empoisonné. Il ne meurt pas même si son pari est faux.',
    notes: 'Si le pari est faux → le Parieur meurt.',
  },

  exorcist: {
    roleId: 'exorcist',
    prompt: '🏠 **L\'Exorciste** ({name}) se réveille.\nChoisis un joueur :',
    inputType: 'select_player',
    step2Type: null,
    canKill: false,
    drunkWarning: '⚠️ L\'Exorciste est ivre/empoisonné. Son pouvoir n\'a aucun effet.',
    notes: 'Si le Démon est ciblé : il ne se réveille pas et apprend l\'identité de l\'Exorciste.',
  },

  chambermaid: {
    roleId: 'chambermaid',
    prompt: '🏠 **La Femme de Chambre** ({name}) se réveille.\nChoisis 2 joueurs :',
    inputType: 'select_two_players',
    step2Type: null,
    canKill: false,
    drunkWarning: '⚠️ La Femme de Chambre est ivre/empoisonnée. Donne une fausse info.',
    notes: 'Le MJ indique combien se sont réveillés cette nuit.',
  },

  professor: {
    roleId: 'professor',
    prompt: '🏠 **Le Professeur** ({name}) souhaite-t-il ressusciter un joueur ? (unique)',
    inputType: 'confirm',
    step2Type: 'select_dead_player',
    step2Prompt: 'Choisis un joueur mort à ressusciter (doit être Citadin) :',
    canKill: false,
    drunkWarning: '⚠️ Le Professeur est ivre/empoisonné. La résurrection échoue.',
    notes: 'Pouvoir unique. Ne fonctionne que sur les Citadins.',
  },

  grandmother: {
    roleId: 'grandmother',
    prompt: '🏠 **La Grand-mère** ({name}) apprend un joueur Gentil.\nChoisis quel joueur Gentil lui révéler :',
    inputType: 'select_player',
    step2Type: null,
    canKill: false,
    firstNightPrompt: '🏠 **La Grand-mère** ({name}) doit apprendre un joueur Gentil et son rôle.\nChoisis le joueur Gentil à révéler :',
    drunkWarning: '⚠️ La Grand-mère est ivre/empoisonnée. Donne une fausse info.',
  },

  cultleader: {
    roleId: 'cultleader',
    prompt: '🏠 **Le Chef de Culte** ({name}) souhaite-t-il rejoindre un voisin ? (Info MJ)',
    inputType: 'select_player',
    step2Type: null,
    canKill: false,
    drunkWarning: '⚠️ Le Chef de Culte est ivre. Son changement de camp échoue.',
    notes: 'Prend l\'alignement du voisin choisi. S\'il gagne, les gentils gagnent s\'ils ont rejoint le culte.',
  },

  // ── ÉTRANGERS ──

  ogre: {
    roleId: 'ogre',
    prompt: '🧩 **L\'Ogre** ({name}) choisit un joueur pour adopter son alignement :',
    inputType: 'select_player',
    step2Type: null,
    canKill: false,
    drunkWarning: 'ℹ️ Même ivre ou empoisonné, l\'Ogre copie quand même l\'alignement !',
    notes: 'Le MJ mettra à jour l\'alignement en DB si besoin.',
  },

  // ── SBIRES ──

  godfather: {
    roleId: 'godfather',
    prompt: '🗡️ **Le Parrain** ({name}) se réveille.\nUn Étranger est mort par exécution aujourd\'hui ?\nSi oui, choisis un joueur à tuer :',
    inputType: 'select_player',
    step2Type: null,
    canKill: true,
    firstNightPrompt: '🗡️ **Le Parrain** ({name}) apprend les Étrangers en jeu.',
    firstNightInput: 'info',
    drunkWarning: '⚠️ Le Parrain est ivre/empoisonné. Son pouvoir n\'a aucun effet.',
    notes: 'Ne tue que si un Étranger est mort par exécution dans la journée.',
  },

  assassin: {
    roleId: 'assassin',
    prompt: '🗡️ **L\'Assassin** ({name}) souhaite-t-il utiliser son pouvoir ? (unique)\nContourne toutes les protections.',
    inputType: 'confirm',
    step2Type: 'select_player',
    canKill: true,
    drunkWarning: '⚠️ L\'Assassin est ivre/empoisonné. Le kill ne fonctionne pas.',
    notes: 'Pouvoir unique. Ignore les protections (Marin, Aubergiste, etc.).',
  },

  wizard: {
    roleId: 'wizard',
    prompt: '🗡️ **Le Sorcier** ({name}) fait un souhait (Message libre MJ).',
    inputType: 'confirm',
    step2Type: null,
    canKill: false,
    drunkWarning: '⚠️ Le Sorcier est ivre/empoisonné. Son souhait échoue discrètement.',
    notes: 'Pouvoir unique. S\'il est exaucé, définir un prix ou un indice logiquement.',
  },

  // ── DÉMONS ──

  zombuul: {
    roleId: 'zombuul',
    prompt: '👹 **Le Mort-Vivant** ({name}) se réveille.\nS\'il n\'y a eu aucun mort aujourd\'hui, choisis un joueur à tuer :',
    inputType: 'select_player',
    step2Type: null,
    canKill: true,
    drunkWarning: '⚠️ Le Mort-Vivant est ivre/empoisonné. Le MJ choisit une cible au hasard.',
    notes: 'Ne tue QUE s\'il n\'y a pas eu de mort dans la journée. Survit à sa 1ère mort.',
  },

  plague_doctor: {
    roleId: 'plague_doctor',
    prompt: '👹 **Le Docteur de la Peste** ({name}) se réveille.\nChoisis un joueur à empoisonner ce soir (celui empoisonné hier doit mourir via `+ Mort`) :',
    inputType: 'select_player',
    step2Type: null,
    canKill: false,
    drunkWarning: '⚠️ Le Docteur de la Peste est ivre/empoisonné. L\'empoisonnement échoue.',
    notes: 'Empoisonne un joueur. Le joueur empoisonné la nuit précédente meurt (ajoutez-le manuellement).',
  },

  glutton: {
    roleId: 'glutton',
    prompt: '👹 **Le Gourmand** ({name}) se réveille.\nChoisis 2 joueurs à tuer :',
    inputType: 'select_two_players',
    step2Type: 'resurrect_choice',
    step2Prompt: 'Veux-tu ressusciter l\'une des victimes de la nuit dernière ?',
    canKill: true,
    drunkWarning: '⚠️ Le Gourmand est ivre/empoisonné. Le MJ choisit les cibles au hasard.',
    notes: 'Tue 2 joueurs. Peut ressusciter 1 victime de la nuit précédente.',
  },

  designator: {
    roleId: 'designator',
    prompt: '👹 **Le Désignateur** ({name}) se réveille.\nChoisis un RÔLE à cibler :',
    inputType: 'select_role',
    step2Type: 'kill_count',
    step2Prompt: 'Rôle absent ! Combien de joueurs le MJ tue-t-il ?',
    canKill: true,
    drunkWarning: '⚠️ Le Désignateur est ivre/empoisonné. Le MJ choisit les conséquences.',
    notes: 'Si le rôle est présent → ce joueur meurt. Si absent → 0/1/2 kills au choix du MJ.',
  },

  claw: {
    roleId: 'claw',
    prompt: '👹 **La Griffe** ({name}) se réveille.\nChoisis sa cible (Si skip la veille, utilise le bouton `+ Mort` pour en ajouter 2 autres) :',
    inputType: 'select_player',
    step2Type: null,
    canKill: true,
    drunkWarning: '⚠️ La Griffe est ivre/empoisonnée. Le mort est choisi aléatoirement par le MJ.',
    notes: 'Chaque nuit, 1 kill. Si a passé la nuit précédente, 3 kills ce soir.',
  },
};

// ============================================================
// Construction de la file d'actions de nuit
// ============================================================

interface PlayerData {
  id: string;
  discordId: string;
  displayName: string;
  role: string;
  isAlive: boolean;
  state: string;       // NORMAL | DRUNK | POISONED
  abilityUsed: boolean;
  seatOrder: number;
}

/**
 * Construit la file d'actions ordonnée pour une nuit donnée.
 * Ne garde que les rôles qui ont une action cette nuit-là.
 */
export function buildNightQueue(
  players: PlayerData[],
  isFirstNight: boolean
): QueuedAction[] {
  const queue: QueuedAction[] = [];

  // Récupérer les rôles qui agissent cette nuit, triés par ordre
  const activeRoles = getNightOrderRoles(isFirstNight);

  let actionIndex = 0;
  for (const roleDef of activeRoles) {
    // Trouver le joueur qui a ce rôle
    const player = players.find((p) => p.role === roleDef.id);
    if (!player) continue;

    // Vérifier si le joueur est vivant (les morts n'agissent plus)
    if (!player.isAlive) continue;

    // Vérifier si c'est un rôle "une fois par partie" déjà utilisé
    if (
      (roleDef.nightAction === 'ONCE_PER_GAME') &&
      player.abilityUsed
    ) continue;

    // Vérifier qu'on a une config pour ce rôle
    const config = NIGHT_CONFIGS[roleDef.id];
    if (!config) continue;

    queue.push({
      index: actionIndex++,
      roleId: roleDef.id,
      playerId: player.id,
      playerDiscordId: player.discordId,
      playerName: player.displayName,
      isDrunkOrPoisoned: player.state !== 'NORMAL',
      completed: false,
    });
  }

  return queue;
}

/**
 * Récupère la config d'action de nuit d'un rôle.
 */
export function getNightConfig(roleId: string): RoleNightConfig | undefined {
  return NIGHT_CONFIGS[roleId];
}

/**
 * Formate le prompt d'un rôle en remplaçant {name} par le nom du joueur.
 */
export function formatPrompt(
  config: RoleNightConfig,
  playerName: string,
  isFirstNight: boolean,
  targetName?: string
): string {
  let prompt = isFirstNight && config.firstNightPrompt
    ? config.firstNightPrompt
    : config.prompt;

  prompt = prompt.replace(/\{name\}/g, playerName);
  if (targetName) {
    prompt = prompt.replace(/\{target\}/g, targetName);
  }
  return prompt;
}

/**
 * Détermine le type d'input pour cette nuit spécifique.
 */
export function getInputType(
  config: RoleNightConfig,
  isFirstNight: boolean
): NightInputType {
  if (isFirstNight && config.firstNightInput) {
    return config.firstNightInput;
  }
  return config.inputType;
}
