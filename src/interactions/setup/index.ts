// ============================================================
// Setup Flow — Routeur central
// ============================================================
// Reçoit toutes les interactions dont le customId commence par "setup_"
// et les route vers le handler approprié.

import { Interaction } from 'discord.js';
import { CUSTOM_IDS, EMOJIS } from '../../utils/constants';
import { cancelGame, getActiveGame } from '../../services/gameService';
import { clearSetupState } from './state';

// Imports des handlers
import { handlePlayerSelect } from './playerSelect';
import { handleValidateOrder, handleEditOrder, handleModalOrder } from './seatOrder';
import {
  handleRerollAll,
  handleRerollRoles,
  handleForceRole,
  handleForceSeatSelect,
  handleForceRolePick,
} from './roleAssignment';
import { handleStartGame } from './gameStart';

/**
 * Routeur principal pour toutes les interactions du flow de Setup.
 * Appelé depuis interactionCreate.ts quand le customId commence par "setup_".
 */
export async function handleSetupInteraction(interaction: Interaction): Promise<void> {
  try {
    // ── UserSelectMenu ──
    if (interaction.isUserSelectMenu()) {
      if (interaction.customId === CUSTOM_IDS.SETUP_SELECT_PLAYERS) {
        return await handlePlayerSelect(interaction);
      }
    }

    // ── Boutons ──
    if (interaction.isButton()) {
      switch (interaction.customId) {
        case CUSTOM_IDS.SETUP_VALIDATE_ORDER:
          return await handleValidateOrder(interaction);

        case CUSTOM_IDS.SETUP_EDIT_ORDER:
          return await handleEditOrder(interaction);

        case CUSTOM_IDS.SETUP_REROLL_ALL:
          return await handleRerollAll(interaction);

        case CUSTOM_IDS.SETUP_REROLL_ROLES:
          return await handleRerollRoles(interaction);

        case CUSTOM_IDS.SETUP_FORCE_ROLE:
          return await handleForceRole(interaction);

        case CUSTOM_IDS.SETUP_START_GAME:
          return await handleStartGame(interaction);

        case CUSTOM_IDS.SETUP_CANCEL:
          return await handleCancelGame(interaction);
      }
    }

    // ── StringSelectMenu (IDs dynamiques) ──
    if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;

      // Force Role — étape 1 : choix du joueur (siège)
      if (customId.startsWith(CUSTOM_IDS.SETUP_FORCE_SEAT_PREFIX)) {
        return await handleForceSeatSelect(interaction);
      }

      // Force Role — étape 2 : choix du rôle
      if (customId.startsWith(CUSTOM_IDS.SETUP_FORCE_PICK_PREFIX)) {
        const seatIndex = parseInt(
          customId.slice(CUSTOM_IDS.SETUP_FORCE_PICK_PREFIX.length),
          10
        );
        return await handleForceRolePick(interaction, seatIndex);
      }
    }

    // ── Modals ──
    if (interaction.isModalSubmit()) {
      if (interaction.customId === CUSTOM_IDS.SETUP_MODAL_ORDER) {
        return await handleModalOrder(interaction);
      }
    }

  } catch (error) {
    console.error('❌ Erreur dans le setup flow:', error);

    // Essayer de répondre à l'interaction si elle n'a pas encore été traitée
    if ('reply' in interaction && typeof interaction.reply === 'function') {
      try {
        const interactionWithReply = interaction as any;
        if (!interactionWithReply.replied && !interactionWithReply.deferred) {
          await interactionWithReply.reply({
            content: `${EMOJIS.CROSS} Une erreur est survenue. Réessaie ou relance \`/botc_create\`.`,
            ephemeral: true,
          });
        }
      } catch {
        // Impossible de répondre, on log seulement
      }
    }
  }
}

/**
 * Bouton "Annuler la partie en cours" (depuis le message d'erreur de /botc_create)
 */
async function handleCancelGame(interaction: Interaction): Promise<void> {
  if (!interaction.isButton()) return;

  const mjId = interaction.user.id;
  const game = await getActiveGame(mjId);

  if (!game) {
    await interaction.update({
      content: `${EMOJIS.CHECK} Aucune partie active. Tu peux lancer \`/botc_create\`.`,
      components: [],
    });
    return;
  }

  await cancelGame(game.id);
  clearSetupState(mjId);

  await interaction.update({
    content: `${EMOJIS.CHECK} Partie annulée. Tu peux maintenant relancer \`/botc_create\`.`,
    components: [],
  });

  console.log(`🗑️ Partie ${game.id} annulée par ${interaction.user.tag}`);
}
