// ============================================================
// Service : Gestion des Parties (Game Service)
// ============================================================
// Ce service encapsule toute la logique métier liée aux parties.
// Les commandes/interactions appellent ces fonctions.

import prisma from '../database/prisma';
import { GameStatus, Alignment, PlayerState, RoleType } from '../types/game';
import { ROLES, PLAYER_COUNT_DISTRIBUTION, getRolesByType } from '../data/roles';

/**
 * Vérifie si un utilisateur a déjà une partie active (comme MJ).
 * Cf. context.md §9.C - Bloquer le multi-instances.
 */
export async function hasActiveGame(mjId: string): Promise<boolean> {
  const game = await prisma.game.findFirst({
    where: {
      mjId,
      status: { in: ['SETUP', 'NIGHT', 'DAY'] },
    },
  });
  return game !== null;
}

/**
 * Crée une nouvelle partie.
 */
export async function createGame(mjId: string, guildId: string, channelId: string) {
  return prisma.game.create({
    data: {
      mjId,
      guildId,
      channelId,
      status: GameStatus.SETUP,
    },
  });
}

/**
 * Récupère la partie active d'un MJ.
 */
export async function getActiveGame(mjId: string) {
  return prisma.game.findFirst({
    where: {
      mjId,
      status: { in: ['SETUP', 'NIGHT', 'DAY'] },
    },
    include: { players: { orderBy: { seatOrder: 'asc' } } },
  });
}

/**
 * Ajoute des joueurs à une partie.
 */
export async function addPlayers(
  gameId: string,
  players: Array<{ discordId: string; displayName: string; avatarUrl?: string; seatOrder: number }>
) {
  return prisma.player.createMany({
    data: players.map((p) => ({
      discordId: p.discordId,
      gameId,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl ?? null,
      role: 'unassigned',
      seatOrder: p.seatOrder,
    })),
  });
}

/**
 * Génère une distribution aléatoire de rôles équilibrée.
 * @returns Un tableau de roleId dans l'ordre des seatOrder
 */
export function generateRoleDistribution(
  playerCount: number,
  forcedRoles: Record<number, string> = {} // seatOrder → roleId
): string[] {
  const distribution = PLAYER_COUNT_DISTRIBUTION[playerCount];
  if (!distribution) {
    throw new Error(`Nombre de joueurs non supporté : ${playerCount} (5-15 requis)`);
  }

  const result: string[] = new Array(playerCount).fill('');

  // 1. Placer les rôles forcés
  const usedRoles = new Set<string>();
  for (const [seat, roleId] of Object.entries(forcedRoles)) {
    const seatNum = parseInt(seat, 10);
    if (ROLES[roleId]) {
      result[seatNum] = roleId;
      usedRoles.add(roleId);
    }
  }

  // 2. Compter les rôles forcés par type
  const forcedCount = {
    [RoleType.TOWNSFOLK]: 0,
    [RoleType.OUTSIDER]: 0,
    [RoleType.MINION]: 0,
    [RoleType.DEMON]: 0,
    [RoleType.FABLED]: 0,
  };
  for (const roleId of usedRoles) {
    const role = ROLES[roleId];
    if (role) forcedCount[role.type]++;
  }

  // 3. Calculer les rôles restants à assigner par type
  const remaining = {
    [RoleType.TOWNSFOLK]: distribution.townsfolk - forcedCount[RoleType.TOWNSFOLK],
    [RoleType.OUTSIDER]: distribution.outsiders - forcedCount[RoleType.OUTSIDER],
    [RoleType.MINION]: distribution.minions - forcedCount[RoleType.MINION],
    [RoleType.DEMON]: distribution.demons - forcedCount[RoleType.DEMON],
    [RoleType.FABLED]: 0 - forcedCount[RoleType.FABLED], // Fabled don't count towards standard distribution
  };

  // 3b. Valider que les rôles forcés ne dépassent pas la distribution
  for (const [type, count] of Object.entries(remaining)) {
    if (count < 0) {
      const typeName = type as RoleType;
      throw new Error(`Distribution impossible : trop de ${typeName} forcés (${-count} en trop)`);
    }
  }

  // 4. Piocher aléatoirement dans les rôles disponibles
  const pickRandom = (type: RoleType, count: number): string[] => {
    const available = getRolesByType(type)
      .filter((r) => !usedRoles.has(r.id))
      .map((r) => r.id);
    
    // Mélange Fisher-Yates
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }

    return available.slice(0, count);
  };

  const rolesToAssign = [
    ...pickRandom(RoleType.DEMON, remaining[RoleType.DEMON]),
    ...pickRandom(RoleType.MINION, remaining[RoleType.MINION]),
    ...pickRandom(RoleType.OUTSIDER, remaining[RoleType.OUTSIDER]),
    ...pickRandom(RoleType.TOWNSFOLK, remaining[RoleType.TOWNSFOLK]),
  ];

  // 5. Mélanger les rôles restants
  for (let i = rolesToAssign.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rolesToAssign[i], rolesToAssign[j]] = [rolesToAssign[j], rolesToAssign[i]];
  }

  // 6. Assigner aux sièges vides
  let roleIndex = 0;
  for (let seat = 0; seat < playerCount; seat++) {
    if (result[seat] === '') {
      result[seat] = rolesToAssign[roleIndex++];
    }
  }

  return result;
}

/**
 * Enregistre un log d'action dans la partie.
 */
export async function addGameLog(
  gameId: string,
  phase: string,
  action: string,
  actor?: string,
  target?: string,
  result?: string
) {
  return prisma.gameLog.create({
    data: { gameId, phase, action, actor, target, result },
  });
}

/**
 * Met à jour le statut d'une partie.
 * Incrémente le compteur de phase pour suivre Nuit 1, Jour 1, Nuit 2, etc.
 */
export async function updateGameStatus(gameId: string, status: GameStatus, phase?: number) {
  const data: Record<string, any> = { status };
  if (phase !== undefined) {
    data.phase = phase;
  }
  return prisma.game.update({
    where: { id: gameId },
    data,
  });
}

/**
 * Met à jour l'état d'un joueur.
 */
export async function updatePlayerState(
  playerId: string,
  updates: {
    isAlive?: boolean;
    state?: PlayerState;
    alignment?: Alignment;
    role?: string;
    hasGhostVote?: boolean;
    abilityUsed?: boolean;
    firstDeathBlocked?: boolean;
  }
) {
  return prisma.player.update({
    where: { id: playerId },
    data: updates,
  });
}

// ============================================================
// Fonctions ajoutées pour le flow de Setup
// ============================================================

/**
 * Annule une partie (met le statut à ENDED).
 */
export async function cancelGame(gameId: string) {
  return prisma.game.update({
    where: { id: gameId },
    data: { status: GameStatus.ENDED, winner: null },
  });
}

/**
 * Assigne les rôles générés à tous les joueurs d'une partie.
 * @param roles Tableau de roleId indexé par seatOrder
 */
export async function assignRolesToPlayers(gameId: string, roles: string[]) {
  const players = await prisma.player.findMany({
    where: { gameId },
    orderBy: { seatOrder: 'asc' },
  });

  // Transaction pour assurer l'atomicité
  await prisma.$transaction(
    players.map((player, index) =>
      prisma.player.update({
        where: { id: player.id },
        data: {
          role: roles[index],
          alignment: ROLES[roles[index]]?.defaultAlignment ?? Alignment.GOOD,
        },
      })
    )
  );
}

/**
 * Réordonne les joueurs selon un nouvel ordre.
 * @param newOrder Tableau des anciens index (1-indexed) dans le nouvel ordre.
 *                 Ex: [3,1,2] → ancien joueur 3 en position 0, ancien 1 en position 1, etc.
 */
export async function reorderPlayers(gameId: string, newOrder: number[]) {
  const players = await prisma.player.findMany({
    where: { gameId },
    orderBy: { seatOrder: 'asc' },
  });

  // Utiliser des seatOrder temporaires négatifs pour éviter les conflits d'unicité
  await prisma.$transaction([
    // Phase 1: mettre tous les seatOrder en négatif
    ...players.map((player, i) =>
      prisma.player.update({
        where: { id: player.id },
        data: { seatOrder: -(i + 100) },
      })
    ),
    // Phase 2: assigner les nouveaux seatOrder
    ...newOrder.map((oldNum, newSeat) =>
      prisma.player.update({
        where: { id: players[oldNum - 1].id },
        data: { seatOrder: newSeat },
      })
    ),
  ]);
}

/**
 * Retourne N rôles de type Gentil (Citadin ou Étranger) absents du jeu.
 * Utilisé pour les bluffs du Démon.
 */
export function getAbsentGoodRoles(assignedRoles: string[], count: number = 3): string[] {
  const allGoodRoles = Object.values(ROLES)
    .filter((r) => r.type === RoleType.TOWNSFOLK || r.type === RoleType.OUTSIDER)
    .map((r) => r.id);

  const absent = allGoodRoles.filter((id) => !assignedRoles.includes(id));

  // Mélange Fisher-Yates
  for (let i = absent.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [absent[i], absent[j]] = [absent[j], absent[i]];
  }

  return absent.slice(0, count);
}

/**
 * Supprime tous les joueurs d'une partie (pour recommencer la sélection).
 */
export async function deleteGamePlayers(gameId: string) {
  return prisma.player.deleteMany({ where: { gameId } });
}
