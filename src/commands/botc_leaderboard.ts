import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../database/prisma';
import { COLORS } from '../utils/constants';

export const data = new SlashCommandBuilder()
  .setName('botc_leaderboard')
  .setDescription('Affiche le classement des victoires sur le serveur.');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const stats = await prisma.playerStats.findMany({
    orderBy: { totalWins: 'desc' },
    take: 10,
  });

  if (stats.length === 0) {
    await interaction.editReply('Aucune donnée de victoire enregistrée pour le moment.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🏆 Classement Général - BOTC')
    .setColor(COLORS.DAY)
    .setDescription('Voici le Top 10 des meilleurs joueurs ayant sauvé ou détruit le village.');

  let rankList = '';
  stats.forEach((player: any, index: number) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
    const winrate = player.gamesPlayed > 0 
      ? Math.round((player.totalWins / player.gamesPlayed) * 100) 
      : 0;

    rankList += `${medal} **${player.username}** — ${player.totalWins} Victoires (${winrate}%) — [👼 ${player.winsGood} | 😈 ${player.winsEvil}]\n`;
  });

  embed.addFields({
    name: 'Top 10 Joueurs',
    value: rankList,
    inline: false,
  });

  await interaction.editReply({ embeds: [embed] });
}
