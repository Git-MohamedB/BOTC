// ============================================================
// Setup Flow — Étape 2 : Gestion de l'ordre du cercle
// ============================================================
import {
  ButtonInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { COLORS, EMOJIS, CUSTOM_IDS } from '../../utils/constants';
import { getActiveGame, reorderPlayers } from '../../services/gameService';
import { buildRoleAssignmentMessage } from './roleAssignment';

/**
 * Bouton : "Valider l'ordre" → Passer à l'étape de distribution des rôles.
 */
export async function handleValidateOrder(interaction: ButtonInteraction): Promise<void> {
  const mjId = interaction.user.id;
  const game = await getActiveGame(mjId);

  if (!game || game.players.length === 0) {
    await interaction.update({
      content: `${EMOJIS.CROSS} Partie introuvable ou aucun joueur. Relance \`/botc_create\`.`,
      embeds: [],
      components: [],
    });
    return;
  }

  // Générer les rôles et afficher
  const message = buildRoleAssignmentMessage(mjId, game.players);

  await interaction.update(message);
}

/**
 * Bouton : "Modifier l'ordre" → Ouvrir un Modal pour réordonner.
 */
export async function handleEditOrder(interaction: ButtonInteraction): Promise<void> {
  const mjId = interaction.user.id;
  const game = await getActiveGame(mjId);

  if (!game || game.players.length === 0) {
    await interaction.update({
      content: `${EMOJIS.CROSS} Partie introuvable ou aucun joueur.`,
      embeds: [],
      components: [],
    });
    return;
  }

  // Construire le texte de l'ordre actuel pour le placeholder
  const currentOrder = game.players.map((p, i) => `${i + 1}. ${p.displayName}`).join('\n');

  const modal = new ModalBuilder()
    .setCustomId(CUSTOM_IDS.SETUP_MODAL_ORDER)
    .setTitle('Modifier l\'ordre du cercle');

  const orderInput = new TextInputBuilder()
    .setCustomId('new_order')
    .setLabel('Nouvel ordre (numéros séparés par virgules)')
    .setPlaceholder(`Ex: 3,1,2,${game.players.length > 3 ? '5,4' : '...'}`)
    .setValue(game.players.map((_, i) => i + 1).join(','))
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(100);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(orderInput);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

/**
 * Modal soumis : Réordonner les joueurs selon l'input du MJ.
 */
export async function handleModalOrder(interaction: ModalSubmitInteraction): Promise<void> {
  const mjId = interaction.user.id;
  const game = await getActiveGame(mjId);

  if (!game || game.players.length === 0) {
    await interaction.reply({
      content: `${EMOJIS.CROSS} Partie introuvable.`,
      ephemeral: true,
    });
    return;
  }

  const input = interaction.fields.getTextInputValue('new_order').trim();
  const playerCount = game.players.length;

  // ── Parser l'input : "3,1,2,5,4" ──
  const newOrder = input
    .split(/[\s,;]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

  // ── Validation ──
  if (newOrder.length !== playerCount) {
    await interaction.reply({
      content: `${EMOJIS.CROSS} Tu as entré **${newOrder.length}** numéros, mais il y a **${playerCount}** joueurs.\n\nFormat attendu : \`1,2,3,...,${playerCount}\` (une permutation des numéros).`,
    });
    return;
  }

  // Vérifier que c'est une permutation valide de [1..N]
  const sorted = [...newOrder].sort((a, b) => a - b);
  const expected = Array.from({ length: playerCount }, (_, i) => i + 1);
  const isValid = sorted.every((val, idx) => val === expected[idx]);

  if (!isValid) {
    await interaction.reply({
      content: `${EMOJIS.CROSS} Les numéros doivent être une permutation de **1** à **${playerCount}**.\nChaque numéro doit apparaître exactement une fois.\n\nTu as entré : \`${input}\``,
    });
    return;
  }

  // ── Réordonner en BDD ──
  await reorderPlayers(game.id, newOrder);

  // ── Recharger et réafficher ──
  const updatedGame = await getActiveGame(mjId);
  if (!updatedGame) return;

  const playerList = updatedGame.players
    .map((p, i) => `**${i + 1}.** ${p.displayName}`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle('🪑 Ordre du Cercle — Mis à jour')
    .setDescription(
      `${EMOJIS.CHECK} Ordre modifié avec succès !\n\n` + playerList
    )
    .setColor(COLORS.SETUP)
    .setFooter({ text: `${updatedGame.players.length} joueurs` });

  const validateBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.SETUP_VALIDATE_ORDER)
    .setLabel('Valider l\'ordre')
    .setStyle(ButtonStyle.Success)
    .setEmoji('✅');

  const editBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.SETUP_EDIT_ORDER)
    .setLabel('Modifier encore')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('✏️');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(validateBtn, editBtn);

  // Le modal vient d'un bouton message → on peut update le message original
  await interaction.reply({ embeds: [embed], components: [row] });
}
