// ============================================================
// Day Flow — Routeur central
// ============================================================
import { Interaction } from 'discord.js';
import { CUSTOM_IDS, EMOJIS } from '../../utils/constants';
import {
  handleDayTimer,
  handleNominate,
  handleNomSelect,
  handleVote,
  handleCancelNomination,
  handleEndDay,
  handleExecConfirm,
  handleCancelExec,
  handleSkipExec,
  handleEndGameButton,
  handleEndGameConfirm,
  handleEndGameCancel,
} from './dashboard';

/**
 * Routeur principal pour toutes les interactions du flow de Jour.
 * Gère les préfixes "day_" et "mj_end".
 */
export async function handleDayInteraction(interaction: Interaction): Promise<void> {
  try {
    // ── Boutons ──
    if (interaction.isButton()) {
      const id = interaction.customId;

      switch (id) {
        case CUSTOM_IDS.DAY_TIMER:
          return await handleDayTimer(interaction, false);
        case CUSTOM_IDS.DAY_TIMER_ADD:
          return await handleDayTimer(interaction, true);
        case CUSTOM_IDS.DAY_NOMINATE:
          return await handleNominate(interaction);
        case CUSTOM_IDS.DAY_CANCEL_NOM:
          return await handleCancelNomination(interaction);
        case CUSTOM_IDS.DAY_END:
          return await handleEndDay(interaction);
        case CUSTOM_IDS.DAY_EXEC_CONFIRM:
          return await handleExecConfirm(interaction);
        case CUSTOM_IDS.DAY_CANCEL_EXEC:
          return await handleCancelExec(interaction);
        case CUSTOM_IDS.DAY_SKIP_EXEC:
          return await handleSkipExec(interaction);

        // ── Outils MJ : Fin de partie ──
        case CUSTOM_IDS.MJ_END_GAME:
          return await handleEndGameButton(interaction);
        case CUSTOM_IDS.MJ_END_CONFIRM_GOOD:
          return await handleEndGameConfirm(interaction, 'GOOD');
        case CUSTOM_IDS.MJ_END_CONFIRM_EVIL:
          return await handleEndGameConfirm(interaction, 'EVIL');
        case CUSTOM_IDS.MJ_END_CANCEL:
          return await handleEndGameCancel(interaction);
      }
    }

    // ── StringSelectMenu ──
    if (interaction.isStringSelectMenu()) {
      const id = interaction.customId;

      if (id === CUSTOM_IDS.DAY_NOM_SELECT) {
        return await handleNomSelect(interaction);
      }
      if (id === CUSTOM_IDS.DAY_VOTE) {
        return await handleVote(interaction);
      }
    }

  } catch (error) {
    console.error('❌ Erreur dans le day flow:', error);

    if ('reply' in interaction && typeof interaction.reply === 'function') {
      try {
        const i = interaction as any;
        if (!i.replied && !i.deferred) {
          await i.reply({
            content: `${EMOJIS.CROSS} Erreur pendant le jour. Vérifie les logs.`,
            ephemeral: true,
          });
        }
      } catch { /* silent */ }
    }
  }
}
