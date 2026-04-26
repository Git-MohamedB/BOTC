// ============================================================
// Types et Enums pour le jeu Blood on the Clocktower
// ============================================================

/** Statut d'une partie */
export enum GameStatus {
  SETUP = 'SETUP',
  NIGHT = 'NIGHT',
  DAY = 'DAY',
  ENDED = 'ENDED',
}

/** État d'un joueur */
export enum PlayerState {
  NORMAL = 'NORMAL',
  DRUNK = 'DRUNK',
  POISONED = 'POISONED',
}

/** Alignement d'un joueur */
export enum Alignment {
  GOOD = 'GOOD',
  EVIL = 'EVIL',
}

/** Camp / Type de rôle */
export enum RoleType {
  TOWNSFOLK = 'TOWNSFOLK', // Citadin
  OUTSIDER = 'OUTSIDER',  // Étranger
  MINION = 'MINION',      // Sbire
  DEMON = 'DEMON',        // Démon
  FABLED = 'FABLED',      // Camp MJ (Fables / Personnages spéciaux)
}

/** Équipe gagnante */
export enum Winner {
  GOOD = 'GOOD',
  EVIL = 'EVIL',
}

/** Moment d'action d'un rôle la nuit */
export enum NightActionTiming {
  FIRST_NIGHT_ONLY = 'FIRST_NIGHT_ONLY',   // Seule la 1ère nuit
  OTHER_NIGHTS = 'OTHER_NIGHTS',            // Pas la 1ère nuit  
  EVERY_NIGHT = 'EVERY_NIGHT',              // Chaque nuit
  ONCE_PER_GAME = 'ONCE_PER_GAME',          // Une seule fois
  PASSIVE = 'PASSIVE',                       // Passif (pas d'action)
  NONE = 'NONE',                             // Pas d'action de nuit
}

/** Définition d'un rôle */
export interface RoleDefinition {
  id: string;                              // Identifiant unique en snake_case
  name: string;                            // Nom affiché en français
  nameEn: string;                          // Nom en anglais (pour le wiki)
  type: RoleType;                          // Camp/type
  defaultAlignment: Alignment;             // Alignement par défaut
  description: string;                     // Description courte
  nightAction: NightActionTiming;          // Quand le rôle agit la nuit
  nightOrder: number;                      // Ordre de réveil la nuit (plus petit = plus tôt)
  firstNightOrder: number;                 // Ordre de réveil la 1ère nuit (0 = n'agit pas)
  otherNightOrder: number;                 // Ordre de réveil les autres nuits (0 = n'agit pas)
  isSetupRole: boolean;                    // Modifie-t-il la composition ? (ex: +1 Étranger)
  canDieAtNight: boolean;                  // Peut-il mourir pendant la nuit (par défaut true)
  needsMJInput: boolean;                   // Le MJ doit-il faire une action pour ce rôle la nuit ?
}

/** Informations d'un vote enregistré */
export interface VoteRecord {
  nominatorId: string;      // Qui a nominé
  nomineeId: string;        // Qui est nominé
  voteCount: number;        // Nombre de votes
  deadVoterIds: string[];   // IDs des morts qui ont utilisé leur ghost vote
  passed: boolean;          // Le vote a-t-il atteint le seuil ?
}
