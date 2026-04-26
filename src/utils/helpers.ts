// ============================================================
// Utilitaires de délai pour respecter les Rate Limits Discord
// ============================================================

/**
 * Attend un nombre de millisecondes (pour espacer les appels API).
 * Utilisé principalement pour l'envoi de MP en masse (rate limit).
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envoie un MP à un utilisateur Discord avec gestion d'erreur.
 * Si le joueur a désactivé les MP, on log l'erreur sans crash.
 */
export async function safeSendDM(
  user: { send: (content: string | object) => Promise<unknown>; tag?: string; id: string },
  content: string | object
): Promise<boolean> {
  try {
    await user.send(content);
    return true;
  } catch (error) {
    console.warn(`⚠️  Impossible d'envoyer un MP à ${user.tag ?? user.id}. MP désactivés ?`);
    return false;
  }
}

/**
 * Envoie des MP à plusieurs utilisateurs avec un délai entre chaque message
 * pour éviter le Rate Limit Discord (429).
 * @param users Liste d'utilisateurs
 * @param content Message à envoyer
 * @param delayMs Délai entre chaque envoi (défaut: 750ms)
 */
export async function batchSendDM(
  users: Array<{ send: (content: string | object) => Promise<unknown>; tag?: string; id: string }>,
  content: string | object,
  delayMs: number = 750
): Promise<{ success: string[]; failed: string[] }> {
  const success: string[] = [];
  const failed: string[] = [];

  for (const user of users) {
    const sent = await safeSendDM(user, content);
    if (sent) {
      success.push(user.id);
    } else {
      failed.push(user.id);
    }

    // Délai entre les envois pour respecter le rate limit
    if (users.indexOf(user) < users.length - 1) {
      await delay(delayMs);
    }
  }

  return { success, failed };
}

/**
 * Formate un tableau de joueurs en liste numérotée pour l'affichage Discord.
 */
export function formatPlayerList(
  players: Array<{ displayName: string; role?: string; isAlive?: boolean }>,
  showRoles: boolean = false
): string {
  return players
    .map((p, i) => {
      const status = p.isAlive === false ? '💀' : '💚';
      const role = showRoles && p.role ? ` — *${p.role}*` : '';
      return `${status} **${i + 1}.** ${p.displayName}${role}`;
    })
    .join('\n');
}

/**
 * Obtient les voisins vivants d'un joueur dans le cercle (logique circulaire).
 * Retourne [voisin gauche, voisin droite].
 */
export function getAliveNeighbors(
  seatOrder: number,
  allPlayers: Array<{ seatOrder: number; isAlive: boolean; discordId: string }>
): [string | null, string | null] {
  const alive = allPlayers.filter((p) => p.isAlive).sort((a, b) => a.seatOrder - b.seatOrder);

  if (alive.length <= 1) return [null, null];

  const currentIndex = alive.findIndex((p) => p.seatOrder === seatOrder);
  if (currentIndex === -1) return [null, null];

  const leftIndex = (currentIndex - 1 + alive.length) % alive.length;
  const rightIndex = (currentIndex + 1) % alive.length;

  return [alive[leftIndex].discordId, alive[rightIndex].discordId];
}
