// ============================================================
// Setup Flow — Étape 1 : Sélection des joueurs
// ============================================================
import {
  UserSelectMenuInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { COLORS, EMOJIS, CUSTOM_IDS, MIN_PLAYERS, MAX_PLAYERS } from '../../utils/constants';
import { getActiveGame, addPlayers, deleteGamePlayers } from '../../services/gameService';

/**
 * Gère la soumission du UserSelectMenu de sélection des joueurs.
 * Contexte : message éphémère dans le salon du serveur.
 */
export async function handlePlayerSelect(interaction: UserSelectMenuInteraction): Promise<void> {
  const mjId = interaction.user.id;
  const game = await getActiveGame(mjId);

  if (!game) {
    await interaction.update({
      content: `${EMOJIS.CROSS} Aucune partie active trouvée. Relance \`/botc_create\`.`,
      components: [],
      embeds: [],
    });
    return;
  }

  // ── Filtrer les bots et le MJ lui-même ──
  const validUsers = interaction.users.filter(
    (user) => user.id !== mjId // TEMPORAIRE: bots autorisés pour test
  );

  if (validUsers.size < MIN_PLAYERS) {
    await interaction.update({
      content: `${EMOJIS.CROSS} Il faut au moins **${MIN_PLAYERS}** joueurs (hors bots et toi-même). Tu en as sélectionné **${validUsers.size}** valides.\n\nRe-sélectionne les joueurs :`,
      embeds: [],
    });
    return;
  }

  if (validUsers.size > MAX_PLAYERS) {
    await interaction.update({
      content: `${EMOJIS.CROSS} Maximum **${MAX_PLAYERS}** joueurs. Tu en as sélectionné **${validUsers.size}**.\n\nRe-sélectionne les joueurs :`,
      embeds: [],
    });
    return;
  }

  // ── Supprimer les joueurs existants (si re-sélection) ──
  if (game.players.length > 0) {
    await deleteGamePlayers(game.id);
  }

  // ── Récupérer les displayNames et avatars via le serveur ──
  const guild = interaction.guild;
  const playerData: Array<{
    discordId: string;
    displayName: string;
    avatarUrl?: string;
    seatOrder: number;
  }> = [];

  let seatOrder = 0;
  for (const [userId, user] of validUsers) {
    let displayName = user.displayName ?? user.username;
    let avatarUrl = user.displayAvatarURL({ size: 128 });

    // Essayer d'obtenir le pseudo serveur
    if (guild) {
      try {
        const member = await guild.members.fetch(userId);
        displayName = member.displayName;
        avatarUrl = member.displayAvatarURL({ size: 128 });
      } catch {
        // Membre introuvable sur le serveur, utiliser le nom Discord
      }
    }

    playerData.push({
      discordId: userId,
      displayName,
      avatarUrl,
      seatOrder: seatOrder++,
    });
  }

  // ── Sauvegarder en BDD ──
  await addPlayers(game.id, playerData);

  // ── Construire l'affichage de l'ordre du cercle ──
  const playerList = playerData
    .map((p, i) => `**${i + 1}.** ${p.displayName}`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle('🪑 Ordre du Cercle')
    .setDescription(
      `Voici l'ordre actuel des joueurs autour du cercle.\n` +
      `Le **premier** et le **dernier** sont voisins (cercle fermé).\n\n` +
      playerList
    )
    .setColor(COLORS.SETUP)
    .setFooter({ text: `${playerData.length} joueurs · Modifie l'ordre si nécessaire` });

  const validateBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.SETUP_VALIDATE_ORDER)
    .setLabel('Valider l\'ordre')
    .setStyle(ButtonStyle.Success)
    .setEmoji('✅');

  const editBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.SETUP_EDIT_ORDER)
    .setLabel('Modifier l\'ordre')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('✏️');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(validateBtn, editBtn);

  // ── Envoyer en MP au MJ ──
  try {
    await interaction.user.send({ embeds: [embed], components: [row] });
    await interaction.update({
      content: `${EMOJIS.CHECK} **${playerData.length} joueurs** sélectionnés ! Consulte tes **MP** pour configurer la partie.`,
      components: [],
      embeds: [],
    });
  } catch {
    await interaction.update({
      content: `${EMOJIS.CROSS} Impossible de t'envoyer un MP. Active tes messages privés (Paramètres → Confidentialité) puis relance.`,
      components: [],
      embeds: [],
    });
  }
}
