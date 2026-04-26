import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  UserSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { CUSTOM_IDS, COLORS, EMOJIS, MIN_PLAYERS, MAX_PLAYERS } from '../utils/constants';
import { hasActiveGame, getActiveGame, createGame } from '../services/gameService';

export const data = new SlashCommandBuilder()
  .setName('botc_create')
  .setDescription('🎭 Crée une nouvelle partie de Blood on the Clocktower.')
  .setDMPermission(false); // Uniquement en serveur

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: `${EMOJIS.CROSS} Cette commande doit être utilisée dans un serveur.`,
      ephemeral: true,
    });
    return;
  }

  const mjId = interaction.user.id;

  // ── Vérification : le MJ a-t-il déjà une partie active ? (§9.C) ──
  if (await hasActiveGame(mjId)) {
    const game = await getActiveGame(mjId);

    const cancelButton = new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.SETUP_CANCEL)
      .setLabel('Annuler la partie en cours')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🗑️');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(cancelButton);

    await interaction.reply({
      content: `${EMOJIS.WARNING} Tu as déjà une partie active (statut : **${game?.status}**).\nAnnule-la d'abord pour en créer une nouvelle.`,
      components: [row],
      ephemeral: true,
    });
    return;
  }

  // ── Créer la partie en BDD ──
  const game = await createGame(mjId, interaction.guild.id, interaction.channelId);
  console.log(`🎭 Partie créée : ${game.id} | MJ : ${interaction.user.tag}`);

  // ── Envoyer l'embed de sélection des joueurs (message éphémère en salon) ──
  const embed = new EmbedBuilder()
    .setTitle('🎭 Blood on the Clocktower — Nouvelle Partie')
    .setDescription(
      `${EMOJIS.CROWN} **Maître du Jeu :** ${interaction.user}\n\n` +
      `Sélectionne les joueurs qui participeront à cette partie.\n` +
      `*(Entre **${MIN_PLAYERS}** et **${MAX_PLAYERS}** joueurs)*`
    )
    .setColor(COLORS.SETUP)
    .setFooter({ text: 'Les joueurs seront notifiés de leur rôle en MP.' });

  const selectMenu = new UserSelectMenuBuilder()
    .setCustomId(CUSTOM_IDS.SETUP_SELECT_PLAYERS)
    .setPlaceholder('Choisis les joueurs de la partie...')
    .setMinValues(MIN_PLAYERS)
    .setMaxValues(MAX_PLAYERS);

  const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}
