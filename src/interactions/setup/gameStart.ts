// ============================================================
// Setup Flow — Étape 4 : Lancement de la partie
// ============================================================
import {
  ButtonInteraction,
  EmbedBuilder,
  Client,
} from 'discord.js';
import { COLORS, EMOJIS, DM_BATCH_DELAY_MS, ROLE_TYPE_EMOJIS } from '../../utils/constants';
import { ROLES } from '../../data/roles';
import { RoleType, GameStatus, Alignment } from '../../types/game';
import {
  getActiveGame,
  assignRolesToPlayers,
  updateGameStatus,
  addGameLog,
  getAbsentGoodRoles,
} from '../../services/gameService';
import { getSetupState, clearSetupState } from './state';
import { delay } from '../../utils/helpers';
import { sendNightDashboard } from '../night/dashboard';

/**
 * Bouton "Lancer la partie" : assigne les rôles, envoie les MP, annonce.
 */
export async function handleStartGame(interaction: ButtonInteraction): Promise<void> {
  const mjId = interaction.user.id;
  const game = await getActiveGame(mjId);

  if (!game) {
    await interaction.update({
      content: `${EMOJIS.CROSS} Partie introuvable. Relance \`/botc_create\`.`,
      embeds: [],
      components: [],
    });
    return;
  }

  const state = getSetupState(mjId);
  const roles = state.generatedRoles;

  if (!roles || roles.length === 0 || roles.length !== game.players.length) {
    await interaction.update({
      content: `${EMOJIS.CROSS} Les rôles n'ont pas été générés correctement. Clique sur "Reroll Tout".`,
      embeds: [],
      components: [],
    });
    return;
  }

  // ── Mise à jour immédiate : "en cours de lancement..." ──
  await interaction.update({
    content: `⏳ **Lancement en cours...** Distribution des rôles aux ${game.players.length} joueurs...`,
    embeds: [],
    components: [],
  });

  // ── 1. Sauvegarder les rôles en BDD ──
  await assignRolesToPlayers(game.id, roles);

  // Recharger les joueurs avec les rôles à jour
  const updatedGame = await getActiveGame(mjId);
  if (!updatedGame) return;

  // ── 2. Préparer les infos des équipes ──
  const demonPlayers = updatedGame.players.filter(
    (p) => ROLES[p.role]?.type === RoleType.DEMON
  );
  const minionPlayers = updatedGame.players.filter(
    (p) => ROLES[p.role]?.type === RoleType.MINION
  );
  const absentRoles = getAbsentGoodRoles(roles, 3);

  // ── 3. Mettre la partie en mode NUIT 1 ──
  await updateGameStatus(game.id, GameStatus.NIGHT, 1);
  await addGameLog(game.id, 'SETUP', 'Partie lancée — Nuit 1', mjId);

  // ── 4. Annonce publique dans le salon "Place du Village" ──
  try {
    const channel = await interaction.client.channels.fetch(game.channelId);
    if (channel && channel.isTextBased() && 'send' in channel) {
      // Liste des joueurs (sans rôles = secret)
      const playerNames = updatedGame.players
        .map((p) => p.displayName)
        .join(', ');

      const publicEmbed = new EmbedBuilder()
        .setTitle('🌙 La nuit tombe sur le village...')
        .setDescription(
          `Une nouvelle partie de **Blood on the Clocktower** commence !\n\n` +
          `**${updatedGame.players.length}** joueurs s'affrontent dans l'ombre.`
        )
        .addFields(
          {
            name: `${EMOJIS.CROWN} Maître du Jeu`,
            value: `<@${mjId}>`,
            inline: true,
          },
          {
            name: '👥 Joueurs',
            value: playerNames,
            inline: false,
          }
        )
        .setColor(COLORS.NIGHT)
        .setFooter({ text: 'Blood on the Clocktower · Que la partie commence !' })
        .setTimestamp();

      await (channel as any).send({ embeds: [publicEmbed] });
    }
  } catch (error) {
    console.error('❌ Impossible d\'envoyer l\'annonce publique:', error);
  }

  // ── 7. Nettoyer le state de setup ──
  clearSetupState(mjId);

  // ── 8. Lancer le dashboard de la Nuit 1 ──
  await sendNightDashboard(interaction.user, game.id, 1);

  console.log(`🎭 Partie ${game.id} lancée avec succès ! (0 MP distribués)`);
}
