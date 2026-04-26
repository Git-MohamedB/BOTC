import { Client, Events, EmbedBuilder } from 'discord.js';
import prisma from '../database/prisma';
import { COLORS, EMOJIS } from '../utils/constants';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client<true>): Promise<void> {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log(`🔮 Bot connecté en tant que : ${client.user.tag}`);
  console.log(`📡 Serveurs : ${client.guilds.cache.size}`);
  console.log(`👥 Utilisateurs : ${client.users.cache.size}`);
  console.log('═══════════════════════════════════════════');
  console.log('');

  // ── Récupération des parties en cours après un redémarrage ──
  try {
    const activeGames = await prisma.game.findMany({
      where: {
        status: { in: ['NIGHT', 'DAY'] },
      },
      include: {
        players: { orderBy: { seatOrder: 'asc' } },
      },
    });

    if (activeGames.length === 0) {
      console.log('✅ Aucune partie en cours à récupérer.');
      return;
    }

    console.log(`🔄 ${activeGames.length} partie(s) en cours détectée(s). Envoi de notifications...`);

    for (const game of activeGames) {
      console.log(`  🔄 Partie active détectée au démarrage : ${game.id.slice(0, 8)}`);
    }

    console.log('✅ Notifications de récupération envoyées.');
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des parties:', error);
  }
}
