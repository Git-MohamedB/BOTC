import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ROLES } from '../data/roles';
import { RoleType } from '../types/game';
import { ROLE_TYPE_EMOJIS, ROLE_TYPE_LABELS, COLORS } from '../utils/constants';

export const data = new SlashCommandBuilder()
  .setName('botc_roles')
  .setDescription('Affiche la liste de tous les rôles disponibles dans cette version.');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle('📖 Grimoire des Rôles')
    .setDescription('Voici tous les rôles que le bot connaît actuellement :')
    .setColor(COLORS.GOOD);

  const categories = [
    RoleType.TOWNSFOLK,
    RoleType.OUTSIDER,
    RoleType.MINION,
    RoleType.DEMON,
    RoleType.FABLED
  ];

  for (const type of categories) {
    const rolesOfType = Object.values(ROLES).filter((r) => r.type === type);
    if (rolesOfType.length > 0) {
      const list = rolesOfType.map((r) => `**${r.name}** : ${r.description}`).join('\n');
      embed.addFields({
        name: ROLE_TYPE_LABELS[type as keyof typeof ROLE_TYPE_EMOJIS] || String(type),
        value: list,
        inline: false,
      });
    }
  }

  await interaction.reply({
    embeds: [embed],
    ephemeral: true, // Toujours privé pour ne pas spam le salon public
  });
}
