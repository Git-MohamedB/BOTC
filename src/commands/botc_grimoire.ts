import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { EMOJIS } from '../utils/constants';
import { getActiveGame } from '../services/gameService';
import { generateGrimoire, type GrimoirePlayer } from '../services/grimoire';
import { ROLES } from '../data/roles';

export const data = new SlashCommandBuilder()
  .setName('botc_grimoire')
  .setDescription('📜 Affiche le Grimoire visuel de la partie en cours.')
  .addBooleanOption((option) =>
    option
      .setName('secret')
      .setDescription('Afficher les rôles ? (MJ uniquement, envoyé en MP)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const showRoles = interaction.options.getBoolean('secret') ?? false;

  // Chercher une partie active où ce joueur est MJ
  const game = await getActiveGame(userId);

  if (!game) {
    // Essayer de trouver une partie active quelconque (le joueur est peut-être joueur)
    await interaction.reply({
      content: `${EMOJIS.CROSS} Aucune partie active trouvée. Lance \`/botc_create\` pour en créer une.`,
      ephemeral: true,
    });
    return;
  }

  // Sécurité : seul le MJ peut voir les rôles
  const isMJ = game.mjId === userId;
  const actualShowRoles = showRoles && isMJ;
  const actualShowAlignments = isMJ;

  // Si le joueur demande les rôles mais n'est pas MJ
  if (showRoles && !isMJ) {
    await interaction.reply({
      content: `${EMOJIS.WARNING} Seul le Maître du Jeu peut voir les rôles. Grimoire public affiché.`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({
    ephemeral: actualShowRoles, // En MP si on montre les rôles
  });

  try {
    // Construire les données des joueurs
    const grimoirePlayers: GrimoirePlayer[] = game.players.map((player) => ({
      displayName: player.displayName,
      avatarUrl: player.avatarUrl ?? `https://cdn.discordapp.com/embed/avatars/${parseInt(player.discordId) % 5}.png`,
      role: player.role,
      isAlive: player.isAlive,
      alignment: player.alignment,
      state: player.state,
      seatOrder: player.seatOrder,
    }));

    // Déterminer la phase courante
    const statusLabel = game.status === 'NIGHT'
      ? `🌙 Nuit ${game.phase || 1}`
      : game.status === 'DAY'
        ? `☀️ Jour ${game.phase || 1}`
        : `⚙️ ${game.status}`;

    // Générer l'image
    const { attachment, embed } = await generateGrimoire(grimoirePlayers, {
      showRoles: actualShowRoles,
      showAlignments: actualShowAlignments,
      phaseLabel: statusLabel,
      title: actualShowRoles ? '📜 Grimoire — Vue MJ' : '📜 Grimoire',
    });

    await interaction.editReply({
      embeds: [embed],
      files: [attachment],
    });
  } catch (error) {
    console.error('❌ Erreur lors de la génération du Grimoire:', error);
    await interaction.editReply({
      content: `${EMOJIS.CROSS} Erreur lors de la génération du Grimoire. Vérifie les logs.`,
    });
  }
}
