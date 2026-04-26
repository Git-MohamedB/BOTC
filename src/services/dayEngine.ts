// ============================================================
// Service : Moteur de Jour (Day Engine)
// ============================================================

import { ROLES } from '../data/roles';
import { RoleType, GameStatus } from '../types/game';
import { getActiveGame, updatePlayerState, updateGameStatus, addGameLog } from './gameService';
import prisma from '../database/prisma';

/**
 * Calcule le seuil de votes requis pour une exécution.
 * Règle BotC : majorité absolue = ceil(alive / 2)
 */
export function getVoteThreshold(aliveCount: number): number {
  return Math.ceil(aliveCount / 2);
}

/**
 * Exécute un joueur (le tue par exécution).
 */
export async function executePlayer(
  gameId: string,
  playerId: string,
  mjId: string
): Promise<{ name: string; role: string; wasProtected: boolean }> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) throw new Error('Joueur introuvable');

  const role = ROLES[player.role];

  // TODO: Vérifier les protections (Avocat du Diable, Pacifiste, Idiot 1ère mort)
  // Pour l'instant, l'exécution passe toujours
  const wasProtected = false;

  if (!wasProtected) {
    await updatePlayerState(playerId, { isAlive: false });
    await addGameLog(gameId, 'EXECUTION', `${player.displayName} a été exécuté`, mjId, player.discordId);
  }

  return {
    name: player.displayName,
    role: role?.name ?? '?',
    wasProtected,
  };
}

/**
 * Marque les ghost votes comme utilisés pour les joueurs morts qui ont voté.
 */
export async function consumeGhostVotes(
  ghostVoterIds: string[]
): Promise<void> {
  for (const id of ghostVoterIds) {
    await updatePlayerState(id, { hasGhostVote: false });
  }
}

/**
 * Vérifie les conditions de fin de partie.
 * Retourne null si la partie continue, sinon le camp gagnant.
 */
export async function checkGameEnd(
  gameId: string
): Promise<'GOOD' | 'EVIL' | null> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: {
        orderBy: { seatOrder: 'asc' },
      },
    },
  });

  if (!game) return null;

  const alivePlayers = game.players.filter((p) => p.isAlive);
  const aliveDemons = alivePlayers.filter((p) => {
    const role = ROLES[p.role];
    return role?.type === RoleType.DEMON;
  });

  let winner: 'GOOD' | 'EVIL' | null = null;

  // ── Victoire du Village : tous les démons sont morts ──
  if (aliveDemons.length === 0) {
    winner = 'GOOD';
  }
  // ── Victoire des Maléfiques : 2 joueurs (ou moins) en vie ──
  else if (alivePlayers.length <= 2) {
    winner = 'EVIL';
  }

  // ── Hérétique (Inversion des conditions de victoire) ──
  if (winner) {
    const hasHeretic = game.players.some((p) => p.role === 'heretic'); // "même si tu es mort"
    if (hasHeretic) {
      winner = winner === 'GOOD' ? 'EVIL' : 'GOOD';
      console.log('🔄 Hérétique en jeu : victoire inversée !');
    }
  }

  return winner;
}

/**
 * Termine la partie avec un gagnant.
 */
export async function endGame(
  gameId: string,
  winner: 'GOOD' | 'EVIL',
  mjId: string
): Promise<void> {
  const game = await prisma.game.update({
    where: { id: gameId },
    data: {
      status: GameStatus.ENDED,
      winner,
    },
    include: { players: true }
  });

  // Mettre à jour les statistiques globales (Win Tracker)
  const upsertPromises = game.players.map((p) => {
    const isWin = p.alignment === winner;
    return prisma.playerStats.upsert({
      where: { discordId: p.discordId },
      update: {
        gamesPlayed: { increment: 1 },
        totalWins: isWin ? { increment: 1 } : undefined,
        winsGood: (isWin && p.alignment === 'GOOD') ? { increment: 1 } : undefined,
        winsEvil: (isWin && p.alignment === 'EVIL') ? { increment: 1 } : undefined,
        username: p.displayName
      },
      create: {
        discordId: p.discordId,
        username: p.displayName,
        gamesPlayed: 1,
        totalWins: isWin ? 1 : 0,
        winsGood: (isWin && p.alignment === 'GOOD') ? 1 : 0,
        winsEvil: (isWin && p.alignment === 'EVIL') ? 1 : 0,
      }
    });
  });

  await Promise.all(upsertPromises);

  await addGameLog(gameId, 'GAME_END', `Partie terminée — Victoire : ${winner}`, mjId);
}
