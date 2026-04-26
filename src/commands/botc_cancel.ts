import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { COLORS, EMOJIS } from '../utils/constants';
import { getActiveGame, cancelGame, addGameLog } from '../services/gameService';
import { ROLES } from '../data/roles';

export const data = new SlashCommandBuilder()
  .setName('botc_cancel')
  .setDescription('🛑 Annule la partie en cours (MJ uniquement).');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;

  const game = await getActiveGame(userId);

  if (!game) {
    await interaction.reply({
      content: `${EMOJIS.CROSS} Tu n'as aucune partie en cours à annuler.`,
      ephemeral: true,
    });
    return;
  }

  // Seul le MJ peut annuler
  if (game.mjId !== userId) {
    await interaction.reply({
      content: `${EMOJIS.CROSS} Seul le Maître du Jeu peut annuler la partie.`,
      ephemeral: true,
    });
    return;
  }

  // Annuler la partie
  await cancelGame(game.id);
  await addGameLog(game.id, 'CANCEL', 'Partie annulée par le MJ', userId);

  // Annonce publique
  try {
    const channel = await interaction.client.channels.fetch(game.channelId);
    if (channel && channel.isTextBased() && 'send' in channel) {
      const publicEmbed = new EmbedBuilder()
        .setTitle('🛑 Partie Annulée')
        .setDescription('Le Maître du Jeu a annulé la partie.')
        .setColor(COLORS.ERROR)
        .setTimestamp();

      await (channel as any).send({ embeds: [publicEmbed] });
    }
  } catch {
    // Salon introuvable
  }

  // Résumé des rôles
  const roleReveal = game.players
    .map((p) => {
      const role = ROLES[p.role];
      return `${p.isAlive ? EMOJIS.ALIVE : EMOJIS.DEAD} **${p.displayName}** — *${role?.name ?? '?'}*`;
    })
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle('🛑 Partie annulée')
    .setDescription(
      `La partie a été annulée.\n\n` +
      `**Rôles :**\n${roleReveal}`
    )
    .setColor(COLORS.ERROR)
    .setFooter({ text: `Partie ${game.id.slice(0, 8)}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });

  console.log(`🛑 Partie ${game.id} annulée par ${interaction.user.tag}`);
}
