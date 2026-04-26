import { Events, Interaction } from 'discord.js';
import { handleSetupInteraction } from '../interactions/setup';
import { handleNightInteraction } from '../interactions/night';
import { handleDayInteraction } from '../interactions/day';

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction: Interaction): Promise<void> {
  // ── Slash Commands ──
  if (interaction.isChatInputCommand()) {
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`❌ Commande inconnue : ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`❌ Erreur lors de l'exécution de /${interaction.commandName}:`, error);

      const errorMessage = {
        content: '❌ Une erreur est survenue lors de l\'exécution de cette commande.',
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
    return;
  }

  // ── Interactions à composants (Boutons, Menus, Modals) ──
  let customId: string | null = null;

  if (interaction.isButton()) customId = interaction.customId;
  if (interaction.isStringSelectMenu()) customId = interaction.customId;
  if (interaction.isUserSelectMenu()) customId = interaction.customId;
  if (interaction.isModalSubmit()) customId = interaction.customId;

  if (customId) {
    // ── Routage par préfixe ──
    if (customId.startsWith('setup_')) {
      await handleSetupInteraction(interaction);
      return;
    }

    if (customId.startsWith('night_')) {
      await handleNightInteraction(interaction);
      return;
    }

    if (customId.startsWith('day_') || customId.startsWith('mj_')) {
      await handleDayInteraction(interaction);
      return;
    }

    console.log(`⚠️  Interaction non gérée : ${customId} par ${interaction.user.tag}`);
  }
}
