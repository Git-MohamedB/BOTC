import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { getActiveGame } from '../services/gameService';
import { GameStatus } from '../types/game';
import { sendDayDashboard } from '../interactions/day/dashboard';
import { getNightState } from '../interactions/night/state';
import { showActionPrompt, showNightSummary } from '../interactions/night/dashboard';

export const data = new SlashCommandBuilder()
  .setName('botc_panel')
  .setDescription('Outil MJ : Renvoyer le panel du jeu actuel pour contourner les bugs d\'interaction.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const mjId = interaction.user.id;
  const game = await getActiveGame(mjId);

  if (!game) {
    await interaction.reply({ content: 'Aucune partie active trouvée dont vous êtes le Conteur.', ephemeral: true });
    return;
  }

  if (game.status === GameStatus.DAY) {
    // Phase de jour -> On renvoie le dashboard en message privé
    await interaction.reply({ content: 'Je relance le dashboard de Jour en message privé !', ephemeral: true });
    await sendDayDashboard(interaction.user, game.id, game.dayNumber);
  } else if (game.status === GameStatus.NIGHT) {
    // Phase de nuit -> On regarde l'état actuel et on affiche le bon panel pour continuer le flow
    const state = getNightState(mjId);
    if (!state) {
      await interaction.reply({ content: 'L\'état de nuit est introuvable. Avez-vous fermé le programme ?', ephemeral: true });
      return;
    }

    if (state.queue.length === 0 || state.currentIndex >= state.queue.length) {
      // Fin de la nuit (ou aucune action)
      await showNightSummary(interaction, state);
    } else {
      // Action en cours
      const currentAction = state.queue[state.currentIndex];
      await showActionPrompt(interaction, state, currentAction);
    }
  } else {
    await interaction.reply({ content: `La partie est en statut ${game.status}. Aucun panel de jeu à renvoyer.`, ephemeral: true });
  }
}
