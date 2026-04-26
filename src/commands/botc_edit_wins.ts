import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import prisma from '../database/prisma';

export const data = new SlashCommandBuilder()
  .setName('botc_edit_wins')
  .setDescription('Outil MJ : Modifie manuellement le compteur de victoire dun joueur.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(option => 
    option.setName('joueur')
      .setDescription('Le joueur à modifier')
      .setRequired(true))
  .addStringOption(option => 
    option.setName('camp')
      .setDescription('Quel camp modifier (Bien ou Mal)')
      .setRequired(true)
      .addChoices(
        { name: 'Victoire Gentil (Bien)', value: 'GOOD' },
        { name: 'Victoire Maléfique (Mal)', value: 'EVIL' }
      ))
  .addIntegerOption(option => 
    option.setName('montant')
      .setDescription('Montant à ajouter (ex: 1) ou retirer (ex: -1)')
      .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const targetUser = interaction.options.getUser('joueur');
  const camp = interaction.options.getString('camp');
  const montant = interaction.options.getInteger('montant');

  if (!targetUser || !camp || montant === null) {
      await interaction.reply({ content: 'Paramètres invalides.', ephemeral: true });
      return;
  }

  await interaction.deferReply({ ephemeral: true });

  const discordId = targetUser.id;
  const username = targetUser.displayName || targetUser.username;

  try {
    // Si la stat n'existe pas, Prisma upsert va la créer
    const stat = await prisma.playerStats.upsert({
      where: { discordId },
      update: {
        totalWins: { increment: montant },
        winsGood: camp === 'GOOD' ? { increment: montant } : undefined,
        winsEvil: camp === 'EVIL' ? { increment: montant } : undefined,
      },
      create: {
        discordId,
        username,
        gamesPlayed: 0,
        totalWins: montant,
        winsGood: camp === 'GOOD' ? montant : 0,
        winsEvil: camp === 'EVIL' ? montant : 0,
      }
    });

    await interaction.editReply(`✅ Statistiques mises à jour pour **${username}** !\nNouvel Historique : total ${stat.totalWins} (👼 ${stat.winsGood} / 😈 ${stat.winsEvil})`);
  } catch (error) {
    console.error(error);
    await interaction.editReply('❌ Erreur lors de la modification des statistiques de la base de données.');
  }
}
