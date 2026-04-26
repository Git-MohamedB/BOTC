import { RoleDefinition, RoleType, Alignment, NightActionTiming } from '../types/game';

// ============================================================
// REGISTRE COMPLET DES RÔLES - Script Personnalisé BotC
// ============================================================
// nightOrder : ordre de réveil (1 = premier, plus grand = plus tard)
// firstNightOrder / otherNightOrder : 0 = n'agit pas cette nuit-là

export const ROLES: Record<string, RoleDefinition> = {

  // ===================== CITADINS (TOWNSFOLK) =====================

  grandmother: {
    id: 'grandmother',
    name: 'Grand-mère',
    nameEn: 'Grandmother',
    type: RoleType.TOWNSFOLK,
    defaultAlignment: Alignment.GOOD,
    description: 'Apprend un joueur gentil et son personnage. Meurt si le démon tue ce joueur.',
    nightAction: NightActionTiming.FIRST_NIGHT_ONLY,
    nightOrder: 40,
    firstNightOrder: 40,
    otherNightOrder: 0,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: true,
  },

  sailor: {
    id: 'sailor',
    name: 'Marin',
    nameEn: 'Sailor',
    type: RoleType.TOWNSFOLK,
    defaultAlignment: Alignment.GOOD,
    description: 'Choisit un joueur la nuit : lui ou le Marin devient ivre. Ne peut pas mourir la nuit.',
    nightAction: NightActionTiming.EVERY_NIGHT,
    nightOrder: 5,
    firstNightOrder: 5,
    otherNightOrder: 5,
    isSetupRole: false,
    canDieAtNight: false,
    needsMJInput: true,
  },

  chambermaid: {
    id: 'chambermaid',
    name: 'Femme de Chambre',
    nameEn: 'Chambermaid',
    type: RoleType.TOWNSFOLK,
    defaultAlignment: Alignment.GOOD,
    description: 'Choisit 2 joueurs vivants : apprend combien se sont réveillés cette nuit.',
    nightAction: NightActionTiming.EVERY_NIGHT,
    nightOrder: 70,
    firstNightOrder: 70,
    otherNightOrder: 70,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: true,
  },

  exorcist: {
    id: 'exorcist',
    name: 'Exorciste',
    nameEn: 'Exorcist',
    type: RoleType.TOWNSFOLK,
    defaultAlignment: Alignment.GOOD,
    description: 'Choisit un joueur (pas nuit 1, pas le même) : si c\'est le démon, il ne se réveille pas.',
    nightAction: NightActionTiming.OTHER_NIGHTS,
    nightOrder: 20,
    firstNightOrder: 0,
    otherNightOrder: 20,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: true,
  },

  innkeeper: {
    id: 'innkeeper',
    name: 'Aubergiste',
    nameEn: 'Innkeeper',
    type: RoleType.TOWNSFOLK,
    defaultAlignment: Alignment.GOOD,
    description: 'Choisit 2 joueurs : protégés de la mort ce soir, mais l\'un est ivre.',
    nightAction: NightActionTiming.OTHER_NIGHTS,
    nightOrder: 10,
    firstNightOrder: 0,
    otherNightOrder: 10,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: true,
  },

  gambler: {
    id: 'gambler',
    name: 'Parieur',
    nameEn: 'Gambler',
    type: RoleType.TOWNSFOLK,
    defaultAlignment: Alignment.GOOD,
    description: 'Choisit un joueur et devine son rôle. Meurt s\'il se trompe.',
    nightAction: NightActionTiming.OTHER_NIGHTS,
    nightOrder: 15,
    firstNightOrder: 0,
    otherNightOrder: 15,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: true,
  },

  courtier: {
    id: 'courtier',
    name: 'Courtisan',
    nameEn: 'Courtier',
    type: RoleType.TOWNSFOLK,
    defaultAlignment: Alignment.GOOD,
    description: 'Une fois par partie, choisit un personnage : il est ivre pendant 3 jours/nuits.',
    nightAction: NightActionTiming.ONCE_PER_GAME,
    nightOrder: 8,
    firstNightOrder: 8,
    otherNightOrder: 8,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: true,
  },

  professor: {
    id: 'professor',
    name: 'Professeur',
    nameEn: 'Professor',
    type: RoleType.TOWNSFOLK,
    defaultAlignment: Alignment.GOOD,
    description: 'Une fois par partie, ressuscite un joueur mort si c\'est un Citadin.',
    nightAction: NightActionTiming.ONCE_PER_GAME,
    nightOrder: 45,
    firstNightOrder: 0,
    otherNightOrder: 45,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: true,
  },

  harpist: {
    id: 'harpist',
    name: 'Joueur de Harpe',
    nameEn: 'Harpist',
    type: RoleType.TOWNSFOLK,
    defaultAlignment: Alignment.GOOD,
    description: 'Si un sbire meurt par exécution, tous sont ivres le lendemain.',
    nightAction: NightActionTiming.PASSIVE,
    nightOrder: 0,
    firstNightOrder: 0,
    otherNightOrder: 0,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: false,
  },

  pacifist: {
    id: 'pacifist',
    name: 'Pacifiste',
    nameEn: 'Pacifist',
    type: RoleType.TOWNSFOLK,
    defaultAlignment: Alignment.GOOD,
    description: 'Le MJ peut empêcher un gentil de mourir lors d\'une exécution.',
    nightAction: NightActionTiming.PASSIVE,
    nightOrder: 0,
    firstNightOrder: 0,
    otherNightOrder: 0,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: false,
  },

  tea_lady: {
    id: 'tea_lady',
    name: 'Dame de Thé',
    nameEn: 'Tea Lady',
    type: RoleType.TOWNSFOLK,
    defaultAlignment: Alignment.GOOD,
    description: 'Si ses deux voisins vivants sont gentils, ils ne peuvent pas mourir.',
    nightAction: NightActionTiming.PASSIVE,
    nightOrder: 0,
    firstNightOrder: 0,
    otherNightOrder: 0,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: false,
  },

  fool: {
    id: 'fool',
    name: 'Idiot',
    nameEn: 'Fool',
    type: RoleType.TOWNSFOLK,
    defaultAlignment: Alignment.GOOD,
    description: 'La première fois qu\'il meurt, il ne meurt pas.',
    nightAction: NightActionTiming.PASSIVE,
    nightOrder: 0,
    firstNightOrder: 0,
    otherNightOrder: 0,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: false,
  },

  // ===================== ÉTRANGERS (OUTSIDERS) =====================

  moonchild: {
    id: 'moonchild',
    name: 'Enfant de la Lune',
    nameEn: 'Moonchild',
    type: RoleType.OUTSIDER,
    defaultAlignment: Alignment.GOOD,
    description: 'Quand il meurt, choisit un joueur le jour. S\'il était gentil, il meurt.',
    nightAction: NightActionTiming.PASSIVE,
    nightOrder: 0,
    firstNightOrder: 0,
    otherNightOrder: 0,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: false,
  },

  tinker: {
    id: 'tinker',
    name: 'Bricoleur',
    nameEn: 'Tinker',
    type: RoleType.OUTSIDER,
    defaultAlignment: Alignment.GOOD,
    description: 'Peut mourir à tout moment (le MJ a un bouton pour le tuer).',
    nightAction: NightActionTiming.PASSIVE,
    nightOrder: 0,
    firstNightOrder: 0,
    otherNightOrder: 0,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: false,
  },

  goon: {
    id: 'goon',
    name: 'Voyou',
    nameEn: 'Goon',
    type: RoleType.OUTSIDER,
    defaultAlignment: Alignment.GOOD,
    description: 'Le 1er joueur à le cibler la nuit devient ivre. Change d\'alignement.',
    nightAction: NightActionTiming.PASSIVE, // Géré automatiquement par le bot
    nightOrder: 0,
    firstNightOrder: 0,
    otherNightOrder: 0,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: false,
  },

  // ===================== SBIRES (MINIONS) =====================

  godfather: {
    id: 'godfather',
    name: 'Parrain',
    nameEn: 'Godfather',
    type: RoleType.MINION,
    defaultAlignment: Alignment.EVIL,
    description: 'Connaît les étrangers. Si un étranger meurt de jour, peut tuer un joueur la nuit.',
    nightAction: NightActionTiming.EVERY_NIGHT,
    nightOrder: 35,
    firstNightOrder: 35,
    otherNightOrder: 35,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: true,
  },

  devils_advocate: {
    id: 'devils_advocate',
    name: 'Avocat du Diable',
    nameEn: "Devil's Advocate",
    type: RoleType.MINION,
    defaultAlignment: Alignment.EVIL,
    description: 'Choisit un joueur la nuit : il survit à l\'exécution le lendemain.',
    nightAction: NightActionTiming.EVERY_NIGHT,
    nightOrder: 12,
    firstNightOrder: 12,
    otherNightOrder: 12,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: true,
  },

  mastermind: {
    id: 'mastermind',
    name: 'Cerveau',
    nameEn: 'Mastermind',
    type: RoleType.MINION,
    defaultAlignment: Alignment.EVIL,
    description: 'Si le démon est exécuté, le jeu dure un jour de plus.',
    nightAction: NightActionTiming.PASSIVE,
    nightOrder: 0,
    firstNightOrder: 0,
    otherNightOrder: 0,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: false,
  },

  assassin: {
    id: 'assassin',
    name: 'Assassin',
    nameEn: 'Assassin',
    type: RoleType.MINION,
    defaultAlignment: Alignment.EVIL,
    description: 'Une fois par partie, tue un joueur (contourne les protections).',
    nightAction: NightActionTiming.ONCE_PER_GAME,
    nightOrder: 30,
    firstNightOrder: 0,
    otherNightOrder: 30,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: true,
  },

  // ===================== DÉMONS (DEMONS) =====================

  zombuul: {
    id: 'zombuul',
    name: 'Mort-Vivant',
    nameEn: 'Zombuul',
    type: RoleType.DEMON,
    defaultAlignment: Alignment.EVIL,
    description: 'Survit à sa 1ère mort. Tue chaque nuit s\'il n\'y a pas eu de mort le jour.',
    nightAction: NightActionTiming.OTHER_NIGHTS,
    nightOrder: 50,
    firstNightOrder: 0,
    otherNightOrder: 50,
    isSetupRole: false,
    canDieAtNight: false,
    needsMJInput: true,
  },

  plague_doctor: {
    id: 'plague_doctor',
    name: 'Docteur de la Peste',
    nameEn: 'Plague Doctor',
    type: RoleType.DEMON,
    defaultAlignment: Alignment.EVIL,
    description: 'Empoisonne un joueur qui meurt la nuit suivante.',
    nightAction: NightActionTiming.EVERY_NIGHT,
    nightOrder: 55,
    firstNightOrder: 55,
    otherNightOrder: 55,
    isSetupRole: false,
    canDieAtNight: false,
    needsMJInput: true,
  },

  glutton: {
    id: 'glutton',
    name: 'Le Gourmand',
    nameEn: 'Glutton',
    type: RoleType.DEMON,
    defaultAlignment: Alignment.EVIL,
    description: 'Tue 2 joueurs par nuit. Peut ressusciter une cible de la veille.',
    nightAction: NightActionTiming.OTHER_NIGHTS,
    nightOrder: 53,
    firstNightOrder: 0,
    otherNightOrder: 53,
    isSetupRole: false,
    canDieAtNight: false,
    needsMJInput: true,
  },

  designator: {
    id: 'designator',
    name: 'Le Désignateur',
    nameEn: 'Designator',
    type: RoleType.DEMON,
    defaultAlignment: Alignment.EVIL,
    description: 'Nomme un RÔLE. Si présent → joueur meurt. Si absent → MJ choisit.',
    nightAction: NightActionTiming.OTHER_NIGHTS,
    nightOrder: 52,
    firstNightOrder: 0,
    otherNightOrder: 52,
    isSetupRole: false,
    canDieAtNight: false,
    needsMJInput: true,
  },

  // ===================== NOUVEAUX RÔLES (Mise à jour) =====================

  cultleader: {
    id: 'cultleader',
    name: 'Chef de Culte',
    nameEn: 'Cult Leader',
    type: RoleType.TOWNSFOLK,
    defaultAlignment: Alignment.GOOD,
    description: 'Chaque nuit, tu deviens l\'alignement d\'un de tes voisins vivants. Si tous les gentils te rejoignent, tu gagnes.',
    nightAction: NightActionTiming.EVERY_NIGHT,
    nightOrder: 1, // Action passive (automatisé par le bot en arrière plan idéalement)
    firstNightOrder: 1,
    otherNightOrder: 1,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: false, // On peut gèrer l'alignement en background
  },

  ogre: {
    id: 'ogre',
    name: 'Ogre',
    nameEn: 'Ogre',
    type: RoleType.OUTSIDER,
    defaultAlignment: Alignment.GOOD,
    description: 'La nuit 1, choisis un joueur (pas toi) : ton alignement devient le sien même ivre/empoisonné.',
    nightAction: NightActionTiming.FIRST_NIGHT_ONLY,
    nightOrder: 2,
    firstNightOrder: 2,
    otherNightOrder: 0,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: true,
  },

  heretic: {
    id: 'heretic',
    name: 'Hérétique',
    nameEn: 'Heretic',
    type: RoleType.OUTSIDER,
    defaultAlignment: Alignment.GOOD,
    description: 'Quiconque gagne perd, quiconque perd gagne, même si tu es mort.',
    nightAction: NightActionTiming.NONE,
    nightOrder: 0,
    firstNightOrder: 0,
    otherNightOrder: 0,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: false,
  },

  wizard: {
    id: 'wizard',
    name: 'Sorcier',
    nameEn: 'Wizard',
    type: RoleType.MINION,
    defaultAlignment: Alignment.EVIL,
    description: 'Une fois par jeu, fais un souhait au MJ. S\'il est exaucé, il a un prix et laisse un indice.',
    nightAction: NightActionTiming.ONCE_PER_GAME,
    nightOrder: 25,
    firstNightOrder: 25,
    otherNightOrder: 25,
    isSetupRole: false,
    canDieAtNight: true,
    needsMJInput: true,
  },

  claw: {
    id: 'claw',
    name: 'La Griffe',
    nameEn: 'The Claw',
    type: RoleType.DEMON,
    defaultAlignment: Alignment.EVIL,
    description: 'Chaque nuit*, choisis un joueur : il meurt. Si ton dernier choix n\'était personne, choisis 3 joueurs.',
    nightAction: NightActionTiming.OTHER_NIGHTS,
    nightOrder: 45,
    firstNightOrder: 0,
    otherNightOrder: 45,
    isSetupRole: false,
    canDieAtNight: false,
    needsMJInput: true,
  },

  magician: {
    id: 'magician',
    name: 'Le Magicien',
    nameEn: 'Magician',
    type: RoleType.FABLED,
    defaultAlignment: Alignment.GOOD,
    description: 'Le conteur (MJ) peut briser les règles. S\'il est exécuté, les gentils gagnent.',
    nightAction: NightActionTiming.NONE,
    nightOrder: 0,
    firstNightOrder: 0,
    otherNightOrder: 0,
    isSetupRole: false,
    canDieAtNight: false,
    needsMJInput: false,
  },
};

// ============================================================
// Helpers
// ============================================================

/** Récupère un rôle par son ID */
export function getRole(roleId: string): RoleDefinition | undefined {
  return ROLES[roleId];
}

/** Liste les rôles par type */
export function getRolesByType(type: RoleType): RoleDefinition[] {
  return Object.values(ROLES).filter((r) => r.type === type);
}

/** Nombre de rôles par type */
export function getRoleCount(): Record<RoleType, number> {
  const count = {
    [RoleType.TOWNSFOLK]: 0,
    [RoleType.OUTSIDER]: 0,
    [RoleType.MINION]: 0,
    [RoleType.DEMON]: 0,
    [RoleType.FABLED]: 0,
  };
  for (const role of Object.values(ROLES)) {
    count[role.type]++;
  }
  return count;
}

/** Tous les rôles qui ont une action de nuit, triés par ordre */
export function getNightOrderRoles(isFirstNight: boolean): RoleDefinition[] {
  return Object.values(ROLES)
    .filter((r) => (isFirstNight ? r.firstNightOrder > 0 : r.otherNightOrder > 0))
    .sort((a, b) =>
      isFirstNight
        ? a.firstNightOrder - b.firstNightOrder
        : a.otherNightOrder - b.otherNightOrder
    );
}

/** Table de conversion nombre de joueurs → composition d'équipe */
export const PLAYER_COUNT_DISTRIBUTION: Record<number, { townsfolk: number; outsiders: number; minions: number; demons: number }> = {
  5:  { townsfolk: 3, outsiders: 0, minions: 1, demons: 1 },
  6:  { townsfolk: 3, outsiders: 1, minions: 1, demons: 1 },
  7:  { townsfolk: 5, outsiders: 0, minions: 1, demons: 1 },
  8:  { townsfolk: 5, outsiders: 1, minions: 1, demons: 1 },
  9:  { townsfolk: 5, outsiders: 2, minions: 1, demons: 1 },
  10: { townsfolk: 7, outsiders: 0, minions: 2, demons: 1 },
  11: { townsfolk: 7, outsiders: 1, minions: 2, demons: 1 },
  12: { townsfolk: 7, outsiders: 2, minions: 2, demons: 1 },
  13: { townsfolk: 9, outsiders: 0, minions: 3, demons: 1 },
  14: { townsfolk: 9, outsiders: 1, minions: 3, demons: 1 },
  15: { townsfolk: 9, outsiders: 2, minions: 3, demons: 1 },
};
