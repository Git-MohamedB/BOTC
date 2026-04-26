// ============================================================
// Night Flow — Routeur central
// ============================================================
import { Interaction } from 'discord.js';
import { CUSTOM_IDS, EMOJIS } from '../../utils/constants';
import {
  handleNightBegin,
  handleNightAction,
  handleNightActionButton,
  handleNightSkip,
  handleNightStep2Select,
  handleNightStep2Button,
  handleSelectDeaths,
  handleWakeVillage,
  handleNightPrev,
} from './dashboard';

/**
 * Routeur principal pour toutes les interactions du flow de Nuit.
 * Appelé depuis interactionCreate.ts quand le customId commence par "night_".
 */
export async function handleNightInteraction(interaction: Interaction): Promise<void> {
  try {
    // ── Boutons ──
    if (interaction.isButton()) {
      const id = interaction.customId;

      // Bouton "Commencer la nuit"
      if (id === CUSTOM_IDS.NIGHT_BEGIN) {
        return await handleNightBegin(interaction);
      }

      // Bouton "Précédent"
      if (id === CUSTOM_IDS.NIGHT_PREV) {
        return await handleNightPrev(interaction);
      }

      // Bouton "Réveiller le village"
      if (id === CUSTOM_IDS.NIGHT_WAKE) {
        return await handleWakeVillage(interaction);
      }

      // Boutons "Passer" (night_skip_X)
      if (id.startsWith(CUSTOM_IDS.NIGHT_SKIP_PREFIX)) {
        const actionIndex = parseInt(id.slice(CUSTOM_IDS.NIGHT_SKIP_PREFIX.length), 10);
        return await handleNightSkip(interaction, actionIndex);
      }

      // Boutons d'action (night_act_X_yes, night_act_X_no, night_act_X_kill)
      if (id.startsWith(CUSTOM_IDS.NIGHT_ACTION_PREFIX)) {
        const rest = id.slice(CUSTOM_IDS.NIGHT_ACTION_PREFIX.length);
        const parts = rest.split('_');
        const actionIndex = parseInt(parts[0], 10);
        const buttonType = parts.slice(1).join('_'); // 'yes', 'no', 'kill', 'killmenu'

        if (buttonType) {
          return await handleNightActionButton(interaction, actionIndex, buttonType);
        }
      }

      // Boutons step2 (night_s2_X_drunk_self, night_s2_X_kills_0, etc.)
      if (id.startsWith(CUSTOM_IDS.NIGHT_STEP2_PREFIX)) {
        const rest = id.slice(CUSTOM_IDS.NIGHT_STEP2_PREFIX.length);
        const parts = rest.split('_');
        const actionIndex = parseInt(parts[0], 10);
        const buttonData = parts.slice(1).join('_');

        if (buttonData) {
          return await handleNightStep2Button(interaction, actionIndex, buttonData);
        }
      }
    }

    // ── StringSelectMenu ──
    if (interaction.isStringSelectMenu()) {
      const id = interaction.customId;

      // Actions principales (night_act_X)
      if (id.startsWith(CUSTOM_IDS.NIGHT_ACTION_PREFIX)) {
        const rest = id.slice(CUSTOM_IDS.NIGHT_ACTION_PREFIX.length);
        // Vérifier si c'est un menu kill (night_act_X_killmenu)
        if (rest.includes('_killmenu')) {
          const actionIndex = parseInt(rest.split('_')[0], 10);
          // Gérer comme un kill custom
          // Pour l'instant, on peut juste ajouter la mort et continuer
          return;
        }
        const actionIndex = parseInt(rest, 10);
        return await handleNightAction(interaction, actionIndex);
      }

      // Étape 2 (night_s2_X)
      if (id.startsWith(CUSTOM_IDS.NIGHT_STEP2_PREFIX)) {
        const actionIndex = parseInt(
          id.slice(CUSTOM_IDS.NIGHT_STEP2_PREFIX.length),
          10
        );
        return await handleNightStep2Select(interaction, actionIndex);
      }

      // Sélection des morts
      if (id === CUSTOM_IDS.NIGHT_SELECT_DEATHS) {
        return await handleSelectDeaths(interaction);
      }
    }

  } catch (error) {
    console.error('❌ Erreur dans le night flow:', error);

    if ('reply' in interaction && typeof interaction.reply === 'function') {
      try {
        const i = interaction as any;
        if (!i.replied && !i.deferred) {
          await i.reply({
            content: `${EMOJIS.CROSS} Erreur pendant la nuit. Vérifie les logs.`,
            ephemeral: true,
          });
        }
      } catch {
        // Impossible de répondre
      }
    }
  }
}
