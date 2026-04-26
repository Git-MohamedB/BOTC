import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Vérifie que le bot est en ligne et réactif.');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const latency = Date.now() - interaction.createdTimestamp;
  const apiLatency = Math.round(interaction.client.ws.ping);

  await interaction.reply({
    content: `🏓 Pong !\n⏱️ Latence : **${latency}ms**\n📡 API Discord : **${apiLatency}ms**`,
    ephemeral: true,
  });
}
