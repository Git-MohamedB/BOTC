// ============================================================
// Setup Flow — Étape 3 : Distribution et gestion des rôles
// ============================================================
import {
  ButtonInteraction,
  StringSelectMenuInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  InteractionUpdateOptions,
} from 'discord.js';
import { COLORS, EMOJIS, CUSTOM_IDS, ROLE_TYPE_LABELS, ROLE_TYPE_EMOJIS } from '../../utils/constants';
import { ROLES } from '../../data/roles';
import { RoleType } from '../../types/game';
import { getActiveGame, generateRoleDistribution } from '../../services/gameService';
import {
  getSetupState,
  setGeneratedRoles,
  clearForcedRoles,
  setForcedRole,
} from './state';

// Type simplifié d'un joueur pour les fonctions d'affichage
interface PlayerInfo {
  displayName: string;
  seatOrder: number;
  role: string;
}

// ============================================================
// Construction de l'affichage
// ============================================================

/** Construit l'embed de l'ordre du cercle (pour réutilisation) */
export function buildSeatOrderEmbed(
  players: PlayerInfo[]
): EmbedBuilder {
  const playerList = players
    .map((p, i) => `**${i + 1}.** ${p.displayName}`)
    .join('\n');

  return new EmbedBuilder()
    .setTitle('🪑 Ordre du Cercle')
    .setDescription(
      `Voici l'ordre actuel des joueurs autour du cercle.\n` +
      `Le **premier** et le **dernier** sont voisins (cercle fermé).\n\n` +
      playerList
    )
    .setColor(COLORS.SETUP)
    .setFooter({ text: `${players.length} joueurs` });
}

/**
 * Génère les rôles et construit le message complet (embed + boutons)
 * pour l'étape d'assignation des rôles.
 */
export function buildRoleAssignmentMessage(
  mjId: string,
  players: PlayerInfo[]
): InteractionUpdateOptions {
  const state = getSetupState(mjId);

  // Convertir la Map en Record pour generateRoleDistribution
  const forcedRecord: Record<number, string> = {};
  for (const [seat, roleId] of state.forcedRoles) {
    forcedRecord[seat] = roleId;
  }

  // Générer les rôles
  let roles: string[];
  try {
    roles = generateRoleDistribution(players.length, forcedRecord);
  } catch (error) {
    return {
      content: `${EMOJIS.CROSS} **Erreur de distribution :** ${(error as Error).message}\n\nUtilise les boutons ci-dessous pour corriger.`,
      embeds: [],
      components: [buildRoleButtons()],
    };
  }

  // Sauvegarder dans le state
  setGeneratedRoles(mjId, roles);

  return buildRoleDisplay(players, roles, state.forcedRoles);
}

/**
 * Construit l'affichage des rôles (embed + boutons).
 */
function buildRoleDisplay(
  players: PlayerInfo[],
  roles: string[],
  forcedRoles: Map<number, string>
): InteractionUpdateOptions {
  const embed = new EmbedBuilder()
    .setTitle('🎭 Script Généré')
    .setColor(COLORS.SETUP);

  // Grouper par type de rôle
  const typeOrder: RoleType[] = [RoleType.TOWNSFOLK, RoleType.OUTSIDER, RoleType.MINION, RoleType.DEMON];
  const groups = new Map<RoleType, string[]>();

  for (const type of typeOrder) {
    groups.set(type, []);
  }

  for (let i = 0; i < players.length; i++) {
    const role = ROLES[roles[i]];
    if (!role) continue;

    const forced = forcedRoles.has(i) ? ` ${EMOJIS.FORCED}` : '';
    const line = `**${i + 1}.** ${players[i].displayName} → *${role.name}*${forced}`;
    groups.get(role.type)?.push(line);
  }

  // Ajouter les champs par type
  for (const type of typeOrder) {
    const entries = groups.get(type) ?? [];
    if (entries.length > 0) {
      embed.addFields({
        name: `${ROLE_TYPE_LABELS[type]} (${entries.length})`,
        value: entries.join('\n'),
        inline: false,
      });
    }
  }

  embed.setFooter({
    text: `${players.length} joueurs · ${EMOJIS.FORCED} = rôle forcé`,
  });

  // Description avec conseil
  embed.setDescription(
    `Distribution pour **${players.length} joueurs** :\n` +
    `Tu peux **reroll**, **forcer un rôle**, ou **lancer** la partie.`
  );

  return {
    content: null,
    embeds: [embed],
    components: [buildRoleButtons()],
  };
}

/** Construit la ligne de boutons pour la gestion des rôles */
function buildRoleButtons(): ActionRowBuilder<ButtonBuilder> {
  const rerollAllBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.SETUP_REROLL_ALL)
    .setLabel('Reroll Tout')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('🔄');

  const rerollRolesBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.SETUP_REROLL_ROLES)
    .setLabel('Reroll Rôles')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('🎲');

  const forceBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.SETUP_FORCE_ROLE)
    .setLabel('Forcer un rôle')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🎯');

  const startBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.SETUP_START_GAME)
    .setLabel('Lancer la partie')
    .setStyle(ButtonStyle.Success)
    .setEmoji('🚀');

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    rerollAllBtn,
    rerollRolesBtn,
    forceBtn,
    startBtn
  );
}

// ============================================================
// Handlers
// ============================================================

/**
 * Bouton "Reroll Tout" : efface les rôles forcés et régénère tout.
 */
export async function handleRerollAll(interaction: ButtonInteraction): Promise<void> {
  const mjId = interaction.user.id;
  const game = await getActiveGame(mjId);
  if (!game) return;

  // Effacer les rôles forcés
  clearForcedRoles(mjId);

  // Régénérer et afficher
  const message = buildRoleAssignmentMessage(mjId, game.players);
  await interaction.update(message);
}

/**
 * Bouton "Reroll Rôles" : garde les rôles forcés, régénère le reste.
 */
export async function handleRerollRoles(interaction: ButtonInteraction): Promise<void> {
  const mjId = interaction.user.id;
  const game = await getActiveGame(mjId);
  if (!game) return;

  // Régénérer (les forcedRoles sont conservés dans le state)
  const message = buildRoleAssignmentMessage(mjId, game.players);
  await interaction.update(message);
}

/**
 * Bouton "Forcer un rôle" : affiche un menu déroulant pour choisir le joueur.
 */
export async function handleForceRole(interaction: ButtonInteraction): Promise<void> {
  const mjId = interaction.user.id;
  const game = await getActiveGame(mjId);
  if (!game) return;

  const state = getSetupState(mjId);

  // Construire le SelectMenu avec les joueurs
  const options = game.players.map((player, index) => {
    const currentRole = state.generatedRoles[index]
      ? ROLES[state.generatedRoles[index]]?.name ?? '?'
      : '?';
    const forced = state.forcedRoles.has(index) ? ` ${EMOJIS.FORCED}` : '';

    return new StringSelectMenuOptionBuilder()
      .setLabel(`${index + 1}. ${player.displayName}`)
      .setDescription(`Actuellement : ${currentRole}${forced}`)
      .setValue(String(index))
      .setEmoji(ROLE_TYPE_EMOJIS[ROLES[state.generatedRoles[index]]?.type ?? 'TOWNSFOLK'] ?? '🏠');
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${CUSTOM_IDS.SETUP_FORCE_SEAT_PREFIX}0`)
    .setPlaceholder('Quel joueur reçoit le rôle forcé ?')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const backBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.SETUP_REROLL_ROLES) // Retour = reaffiche l'écran des rôles
    .setLabel('Retour')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('◀️');

  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backBtn);

  await interaction.update({
    content: `${EMOJIS.GEAR} **Forcer un rôle** — Choisis d'abord le joueur :`,
    embeds: [],
    components: [row, btnRow],
  });
}

/**
 * Select Menu : le MJ a choisi quel joueur va recevoir un rôle forcé.
 * Maintenant on affiche le menu de sélection du rôle.
 */
export async function handleForceSeatSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const seatIndex = parseInt(interaction.values[0], 10);
  const mjId = interaction.user.id;
  const game = await getActiveGame(mjId);
  if (!game) return;

  const player = game.players[seatIndex];
  if (!player) return;

  // Construire le menu de rôles groupés par type
  const allRoles = Object.values(ROLES);
  const typeOrder: RoleType[] = [RoleType.TOWNSFOLK, RoleType.OUTSIDER, RoleType.MINION, RoleType.DEMON];

  const options: StringSelectMenuOptionBuilder[] = [];
  for (const type of typeOrder) {
    const rolesOfType = allRoles.filter((r) => r.type === type);
    for (const role of rolesOfType) {
      options.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(role.name)
          .setDescription(`${ROLE_TYPE_LABELS[type]}`)
          .setValue(role.id)
          .setEmoji(ROLE_TYPE_EMOJIS[type])
      );
    }
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${CUSTOM_IDS.SETUP_FORCE_PICK_PREFIX}${seatIndex}`)
    .setPlaceholder(`Quel rôle pour ${player.displayName} ?`)
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const backBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.SETUP_FORCE_ROLE)
    .setLabel('Retour au choix du joueur')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('◀️');

  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backBtn);

  await interaction.update({
    content: `🎯 **Forcer un rôle pour : ${player.displayName}** (siège ${seatIndex + 1})\n\nChoisis le rôle à lui attribuer :`,
    components: [row, btnRow],
  });
}

/**
 * Select Menu : le MJ a choisi le rôle à forcer.
 * On met à jour le state et on régénère.
 */
export async function handleForceRolePick(
  interaction: StringSelectMenuInteraction,
  seatIndex: number
): Promise<void> {
  const mjId = interaction.user.id;
  const roleId = interaction.values[0];
  const game = await getActiveGame(mjId);
  if (!game) return;

  const role = ROLES[roleId];
  if (!role) return;

  // Sauvegarder le rôle forcé dans le state
  setForcedRole(mjId, seatIndex, roleId);

  // Régénérer les rôles avec le nouveau forcé
  const message = buildRoleAssignmentMessage(mjId, game.players);

  // Ajouter un message de confirmation
  const confirmContent = `${EMOJIS.CHECK} **${game.players[seatIndex].displayName}** → *${role.name}* ${EMOJIS.FORCED}\n\n`;

  await interaction.update({
    ...message,
    content: confirmContent + (typeof message.content === 'string' ? message.content : ''),
  });
}
