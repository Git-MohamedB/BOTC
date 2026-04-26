// ============================================================
// Night Flow — Dashboard & Gestion des actions de nuit
// ============================================================
import {
  User,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonInteraction,
  StringSelectMenuInteraction,
  MessageCreateOptions,
} from 'discord.js';
import { COLORS, EMOJIS, CUSTOM_IDS, ROLE_TYPE_EMOJIS } from '../../utils/constants';
import { ROLES } from '../../data/roles';
import {
  buildNightQueue,
  getNightConfig,
  formatPrompt,
  getInputType,
  type NightInputType,
} from '../../services/nightEngine';
import { getActiveGame, addGameLog, updateGameStatus, updatePlayerState } from '../../services/gameService';
import { GameStatus, Alignment, PlayerState } from '../../types/game';
import { checkGameEnd, endGame } from '../../services/dayEngine';
import { sendDayDashboard, sendPublicGrimoireUpdate, getRoleSummaryField } from '../day/dashboard';
import { generateGrimoire, type GrimoirePlayer } from '../../services/grimoire';
import { ChatInputCommandInteraction } from 'discord.js';
import {
  createNightState,
  getNightState,
  clearNightState,
  advanceToNextAction,
  logAction,
  addPendingDeath,
  type QueuedAction,
  type NightState,
  type ActionLog,
} from './state';

// ============================================================
// 1. Dashboard initial
// ============================================================

/**
 * Envoie le dashboard de nuit au MJ en MP.
 * Appelé à la fin du gameStart ou quand une nouvelle nuit commence.
 */
export async function sendNightDashboard(
  mjUser: User,
  gameId: string,
  nightNumber: number = 1
): Promise<void> {
  const mjId = mjUser.id;
  const game = await getActiveGame(mjId);
  if (!game) return;

  const isFirstNight = nightNumber === 1;

  // Construire la file d'actions
  const queue = buildNightQueue(game.players, isFirstNight);

  // Helper local pour la liste des rôles
  const roleList = game.players
    .map(p => `${p.isAlive ? EMOJIS.ALIVE : EMOJIS.DEAD} **${p.displayName}** — *${ROLES[p.role]?.name ?? '?'}*`)
    .join('\n');

  // Créer le state
  createNightState(mjId, gameId, nightNumber, isFirstNight, queue);

  // Construire l'embed
  const embed = new EmbedBuilder()
    .setTitle(`🌙 NUIT ${nightNumber}`)
    .setColor(COLORS.NIGHT)
    .setTimestamp();

  if (queue.length === 0) {
    embed.setDescription('Aucun rôle n\'agit cette nuit.\nClique sur **Réveiller le Village** pour passer au jour.');
  } else {
    const lines = queue.map((action, i) => {
      const role = ROLES[action.roleId];
      const emoji = ROLE_TYPE_EMOJIS[role?.type ?? 'TOWNSFOLK'] ?? '🏠';
      const drunk = action.isDrunkOrPoisoned ? ` ${EMOJIS.DRUNK}` : '';
      return `**${i + 1}.** ${emoji} ${role?.name ?? '?'} (${action.playerName})${drunk}`;
    }).join('\n');

    embed.setDescription(
      `**${queue.length}** rôle(s) se réveillent cette nuit :\n\n` +
      lines + '\n\n' +
      `${EMOJIS.DRUNK} = ivre/empoisonné`
    );
  }

  embed.addFields({
    name: '👥 Joueurs et Rôles',
    value: roleList,
    inline: false
  });

  embed.setFooter({ text: `Partie ${gameId.slice(0, 8)} · Nuit ${nightNumber}` });

  // Boutons
  const beginBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.NIGHT_BEGIN)
    .setLabel(queue.length > 0 ? 'Commencer la nuit' : 'Réveiller le Village')
    .setStyle(queue.length > 0 ? ButtonStyle.Primary : ButtonStyle.Success)
    .setEmoji(queue.length > 0 ? '▶️' : '🌅');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(beginBtn);

  await mjUser.send({ embeds: [embed], components: [row] });
}

// ============================================================
// 2. Traitement des actions une par une
// ============================================================

/**
 * Bouton "Commencer la nuit" → affiche la 1ère action.
 */
export async function handleNightBegin(interaction: ButtonInteraction): Promise<void> {
  const mjId = interaction.user.id;
  const state = getNightState(mjId);

  if (!state) {
    await interaction.update({
      content: `${EMOJIS.CROSS} État de nuit introuvable.`,
      embeds: [],
      components: [],
    });
    return;
  }

  if (state.queue.length === 0) {
    // Pas d'actions → directement au résumé
    await showNightSummary(interaction, state);
    return;
  }

  // Afficher la première action
  const firstAction = state.queue[0];
  await showActionPrompt(interaction, state, firstAction);
}

export async function handleNightPrev(interaction: ButtonInteraction): Promise<void> {
  const mjId = interaction.user.id;
  const state = getNightState(mjId);
  if (!state) return;

  if (state.currentIndex > 0) {
    state.currentIndex--;

    // Annuler l'action précédente
    const cancelledLog = state.resolvedActions.pop();
    const prevAction = state.queue[state.currentIndex];

    if (cancelledLog && cancelledLog.causedDeaths) {
       state.pendingDeaths = state.pendingDeaths.filter(
         id => !cancelledLog.causedDeaths.includes(id)
       );
    }
    
    // Annuler l'utilisation d'aptitude si c'était le cas
    if (['courtier', 'professor', 'assassin', 'wizard'].includes(prevAction.roleId)) {
      import('../../services/gameService').then(({ updatePlayerState }) => {
         updatePlayerState(prevAction.playerId, { abilityUsed: false }).catch(console.error);
      });
    }

    await showActionPrompt(interaction, state, prevAction);
  } else {
    // Si on est déjà à 0, ne rien faire ou renvoyer un message d'erreur ignoré
    await interaction.update({ content: `${EMOJIS.WARNING} Déjà à la première action.` });
  }
}

/**
 * Construit et affiche le prompt pour une action donnée.
 */
export async function showActionPrompt(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ChatInputCommandInteraction,
  state: NightState,
  action: QueuedAction
): Promise<void> {
  const config = getNightConfig(action.roleId);
  if (!config) {
    // Rôle sans config → passer
    advanceToNextAction(interaction.user.id);
    const next = state.queue[state.currentIndex];
    if (next) {
      await showActionPrompt(interaction, state, next);
    } else {
      await showNightSummary(interaction, state);
    }
    return;
  }

  const role = ROLES[action.roleId];
  const inputType = getInputType(config, state.isFirstNight);
  const prompt = formatPrompt(config, action.playerName, state.isFirstNight);

  // Embed
  const embed = new EmbedBuilder()
    .setTitle(`🌙 Nuit ${state.nightNumber} — ${action.index + 1}/${state.queue.length}`)
    .setDescription(prompt)
    .setColor(COLORS.NIGHT);

  // Avertissement ivre/empoisonné
  if (action.isDrunkOrPoisoned) {
    embed.addFields({
      name: `${EMOJIS.DRUNK} Attention`,
      value: config.drunkWarning,
      inline: false,
    });
  }

  // Notes additionnelles
  if (config.notes) {
    embed.addFields({
      name: `${EMOJIS.SCROLL} Rappel`,
      value: config.notes,
      inline: false,
    });
  }

  // ── Info Directe au MJ (Explicite) ──
  const game = await getActiveGame(interaction.user.id);
  if (game) {
    const specificInfo = getRoleSpecificInfo(action.roleId, game, state);
    if (specificInfo) {
      embed.addFields({
        name: '🎯 Info à donner (Explicite)',
        value: specificInfo,
        inline: false,
      });
    }

    // Liste des rôles
    const roleList = game.players
      .map(p => `${p.isAlive ? EMOJIS.ALIVE : EMOJIS.DEAD} **${p.displayName}** — *${ROLES[p.role]?.name ?? '?'}*`)
      .join('\n');
    embed.addFields({
      name: '👥 Joueurs et Rôles',
      value: roleList,
      inline: false
    });
  }

  embed.setFooter({
    text: `${ROLE_TYPE_EMOJIS[role?.type ?? 'TOWNSFOLK']} ${role?.name ?? '?'} · ${action.playerName}`,
  });

  // Construire les composants selon le type d'input
  const components: ActionRowBuilder<any>[] = [];

  switch (inputType) {
    case 'select_player':
    case 'select_two_players': {
      const game = await getActiveGame(interaction.user.id);
      if (!game) return;

      const alivePlayers = game.players.filter((p) => p.isAlive);
      const options = alivePlayers.map((p) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(p.displayName)
          .setValue(p.id)
          .setDescription(`Siège ${p.seatOrder + 1}`)
      );

      if (options.length > 0) {
        const maxValues = inputType === 'select_two_players'
          ? Math.min(2, options.length)
          : 1;
        const menu = new StringSelectMenuBuilder()
          .setCustomId(`${CUSTOM_IDS.NIGHT_ACTION_PREFIX}${action.index}`)
          .setPlaceholder(inputType === 'select_two_players' ? 'Choisis 2 joueurs...' : 'Choisis un joueur...')
          .setMinValues(maxValues)
          .setMaxValues(maxValues)
          .addOptions(options);

        components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
      }
      break;
    }

    case 'select_role': {
      const allRoles = Object.values(ROLES);
      const options = allRoles.map((r) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(r.name)
          .setValue(r.id)
          .setEmoji(ROLE_TYPE_EMOJIS[r.type])
      );

      // Discord limite à 25 options → on prend les 25 premiers
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`${CUSTOM_IDS.NIGHT_ACTION_PREFIX}${action.index}`)
        .setPlaceholder('Choisis un rôle...')
        .addOptions(options.slice(0, 25));

      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
      break;
    }

    case 'confirm': {
      const yesBtn = new ButtonBuilder()
        .setCustomId(`${CUSTOM_IDS.NIGHT_ACTION_PREFIX}${action.index}_yes`)
        .setLabel('Oui')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');

      const noBtn = new ButtonBuilder()
        .setCustomId(`${CUSTOM_IDS.NIGHT_ACTION_PREFIX}${action.index}_no`)
        .setLabel('Non / Passer')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⏭️');

      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(yesBtn, noBtn));
      break;
    }

    case 'info': {
      // Les informations explicites sont désormais ajoutées universellement plus haut
      // via getRoleSpecificInfo() dans le bloc "Info Directe au MJ (Explicite)".
      break;
    }
  }

  // Bouton Skip (toujours présent)
  const skipBtn = new ButtonBuilder()
    .setCustomId(`${CUSTOM_IDS.NIGHT_SKIP_PREFIX}${action.index}`)
    .setLabel('Passer')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('⏭️');

  // Bouton Kill manuel (le MJ peut ajouter une mort à tout moment)
  const killBtn = new ButtonBuilder()
    .setCustomId(`${CUSTOM_IDS.NIGHT_ACTION_PREFIX}${action.index}_kill`)
    .setLabel('Marquer un mort')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('💀');

  const btnRow = new ActionRowBuilder<ButtonBuilder>();
  if (state.currentIndex > 0) {
    const prevBtn = new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.NIGHT_PREV)
      .setLabel('Précédent')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('◀️');
    btnRow.addComponents(prevBtn);
  }
  btnRow.addComponents(skipBtn, killBtn);

  components.push(btnRow);

  if (interaction.isChatInputCommand()) {
    await interaction.reply({ embeds: [embed], components, ephemeral: true });
  } else {
    await interaction.update({ embeds: [embed], components });
  }
}

// ============================================================
// 3. Handlers des réponses du MJ
// ============================================================

/**
 * Gère la soumission d'un select menu pour une action de nuit.
 */
export async function handleNightAction(
  interaction: StringSelectMenuInteraction,
  actionIndex: number
): Promise<void> {
  const mjId = interaction.user.id;
  const state = getNightState(mjId);
  if (!state) return;

  state.pendingSelection = interaction.values;
  
  await interaction.update({ 
    content: `✅ Sélection mémorisée (${interaction.values.length} joueur(s)). Cliquez sur **Valider choix** pour confirmer.`,
    components: interaction.message.components 
  });
}

/**
 * Logique métier pour résoudre une action une fois confirmée
 */
async function resolveNightAction(
  interaction: ButtonInteraction,
  actionIndex: number,
  selectedValues: string[]
): Promise<void> {
  const mjId = interaction.user.id;
  const state = getNightState(mjId);
  if (!state) return;

  const action = state.queue[actionIndex];
  if (!action) return;

  const config = getNightConfig(action.roleId);
  if (!config) return;

  const game = await getActiveGame(mjId);
  if (!game) return;

  // Résoudre les noms des cibles
  const targetNames = selectedValues.map((id) => {
    const player = game.players.find((p) => p.id === id);
    return player?.displayName ?? id;
  });

  // Vérifier si on a besoin d'une étape 2
  if (config.step2Type) {
    state.step2Pending = {
      actionIndex,
      step1Values: selectedValues,
      type: config.step2Type,
    };
    await showStep2Prompt(interaction, state, action, targetNames);
    return;
  }

  // ── VÉRIFICATION AVOCAT DU DIABLE ──
  if (action.roleId === 'devils_advocate') {
    const targetId = selectedValues[0];
    const actorPlayer = game.players.find(p => p.id === action.playerId);
    
    if ((actorPlayer as any)?.extraState === targetId) {
       await interaction.reply({ 
          content: `❌ **Interdit !** L'Avocat du Diable ne peut pas cibler la même personne 2 nuits de suite.\nRefais un choix via le menu déroulant.`, 
          ephemeral: true 
       });
       return; 
    }
    const { default: prisma } = await import('../../database/prisma'); 
    await prisma.player.update({ where: { id: action.playerId }, data: { extraState: targetId } as any});
  }

  const description = `a choisi ${targetNames.join(' et ')}`;

  // Si le rôle peut tuer, ajouter les victimes
  const deaths: string[] = [];
  if (config.canKill) {
    for (const victimId of selectedValues) {
      addPendingDeath(mjId, victimId);
      deaths.push(victimId);
    }
  }

  logAction(mjId, {
    roleId: action.roleId,
    roleName: ROLES[action.roleId]?.name ?? '?',
    playerName: action.playerName,
    description,
    targets: targetNames,
    causedDeaths: deaths, // On stocke les IDs pour pouvoir les rollbacks
  });

  // Log en BDD
  await addGameLog(
    state.gameId,
    `NIGHT_${state.nightNumber}`,
    `${ROLES[action.roleId]?.name} (${action.playerName}) ${description}`,
    mjId
  );

  // ── AUTOMATISATIONS SPÉCIFIQUES & STATUTS ──
  if (action.roleId === 'ogre' || action.roleId === 'cultleader') {
    const targetId = selectedValues[0];
    const targetPlayer = game.players.find(p => p.id === targetId);
    if (targetPlayer) {
      await updatePlayerState(action.playerId, { alignment: targetPlayer.alignment as Alignment });
      console.log(`[BOTC Nuit] ${action.roleId} (${action.playerName}) prend l'alignement ${targetPlayer.alignment}`);
    }
  }

  // Docteur de la Peste : Empoisonnement Automatique
  if (action.roleId === 'plague_doctor') {
    const targetId = selectedValues[0];
    await updatePlayerState(targetId, { state: PlayerState.POISONED });
    console.log(`[BOTC Nuit] ${action.playerName} a empoisonné ${targetId}`);
  }

  // Pouvoirs à utilisation unique
  if (['courtier', 'professor', 'assassin', 'wizard'].includes(action.roleId)) {
    await updatePlayerState(action.playerId, { abilityUsed: true });
  }

  // Passer à l'action suivante
  const next = advanceToNextAction(mjId);
  if (next) {
    await showActionPrompt(interaction, state, next);
  } else {
    await showNightSummary(interaction, state);
  }
}

/**
 * Gère les boutons Oui/Non pour les actions "confirm".
 */
export async function handleNightActionButton(
  interaction: ButtonInteraction,
  actionIndex: number,
  buttonType: string   // 'yes', 'no', 'kill'
): Promise<void> {
  const mjId = interaction.user.id;
  const state = getNightState(mjId);
  if (!state) return;

  const action = state.queue[actionIndex];
  if (!action) return;

  const config = getNightConfig(action.roleId);

  if (buttonType === 'kill') {
    // Bouton "Marquer un mort" → montrer les joueurs pour kill
    const game = await getActiveGame(mjId);
    if (!game) return;

    const alivePlayers = game.players.filter((p) => p.isAlive);
    const options = alivePlayers.map((p) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(`💀 ${p.displayName}`)
        .setValue(`kill_${p.id}`)
        .setDescription(`Marquer comme mort cette nuit`)
    );

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`${CUSTOM_IDS.NIGHT_ACTION_PREFIX}${actionIndex}_killmenu`)
      .setPlaceholder('Qui meurt ?')
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

    const backBtn = new ButtonBuilder()
      .setCustomId(`${CUSTOM_IDS.NIGHT_SKIP_PREFIX}${actionIndex}`)
      .setLabel('Retour / Passer')
      .setStyle(ButtonStyle.Secondary);

    const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backBtn);

    await interaction.update({ components: [row, btnRow] });
    return;
  }

  if (buttonType === 'confirm') {
    const selectedValues = state.pendingSelection || [];
    if (selectedValues.length === 0) {
      await interaction.reply({ content: '❌ Veuillez d\'abord sélectionner une option dans le menu.', ephemeral: true });
      return;
    }
    
    // Traiter la sélection
    await resolveNightAction(interaction, actionIndex, selectedValues);
    return;
  }

  if (buttonType === 'no') {
    // Passer cette action
    logAction(mjId, {
      roleId: action.roleId,
      roleName: ROLES[action.roleId]?.name ?? '?',
      playerName: action.playerName,
      description: 'a choisi de ne pas utiliser son pouvoir',
      targets: [],
      causedDeaths: [],
    });

    await addGameLog(
      state.gameId,
      `NIGHT_${state.nightNumber}`,
      `${ROLES[action.roleId]?.name} (${action.playerName}) passe son tour`,
      mjId
    );

    const next = advanceToNextAction(mjId);
    if (next) {
      await showActionPrompt(interaction, state, next);
    } else {
      await showNightSummary(interaction, state);
    }
    return;
  }

  if (buttonType === 'yes' && config?.step2Type) {
    // Étape 2 après confirmation (ex: Assassin → choisir cible)
    state.step2Pending = {
      actionIndex,
      step1Values: ['confirmed'],
      type: config.step2Type === 'select_role' ? 'select_role' : 'select_dead_player',
    };

    // Pour l'Assassin : montrer select player
    if (config.step2Type === 'select_player') {
      const game = await getActiveGame(mjId);
      if (!game) return;

      const alivePlayers = game.players.filter((p) => p.isAlive);
      const options = alivePlayers.map((p) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(p.displayName)
          .setValue(p.id)
          .setDescription(`Siège ${p.seatOrder + 1}`)
      );

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`${CUSTOM_IDS.NIGHT_STEP2_PREFIX}${actionIndex}`)
        .setPlaceholder('Choisis la cible...')
        .addOptions(options);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

      await interaction.update({
        content: `🎯 **${ROLES[action.roleId]?.name}** (${action.playerName}) utilise son pouvoir.\nChoisis la cible :`,
        components: [row],
      });
      return;
    }

    // Pour le Professeur : montrer joueurs morts
    if (config.step2Type === 'select_dead_player') {
      const game = await getActiveGame(mjId);
      if (!game) return;

      const deadPlayers = game.players.filter((p) => !p.isAlive);
      if (deadPlayers.length === 0) {
        logAction(mjId, {
          roleId: action.roleId,
          roleName: ROLES[action.roleId]?.name ?? '?',
          playerName: action.playerName,
          description: 'aucun joueur mort à ressusciter',
          targets: [],
          causedDeaths: [],
        });

        const next = advanceToNextAction(mjId);
        if (next) {
          await showActionPrompt(interaction, state, next);
        } else {
          await showNightSummary(interaction, state);
        }
        return;
      }

      const options = deadPlayers.map((p) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(p.displayName)
          .setValue(p.id)
          .setDescription(`${ROLES[p.role]?.name ?? '?'} — Mort`)
      );

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`${CUSTOM_IDS.NIGHT_STEP2_PREFIX}${actionIndex}`)
        .setPlaceholder('Qui ressusciter ?')
        .addOptions(options);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

      await interaction.update({
        content: `🏥 **${ROLES[action.roleId]?.name}** (${action.playerName}) ressuscite un joueur.\nChoisis le joueur mort :`,
        components: [row],
      });
      return;
    }

    // Pour le Courtisan : montrer les rôles
    if (config.step2Type === 'select_role') {
      const allRoles = Object.values(ROLES);
      const options = allRoles.slice(0, 25).map((r) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(r.name)
          .setValue(r.id)
          .setEmoji(ROLE_TYPE_EMOJIS[r.type])
      );

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`${CUSTOM_IDS.NIGHT_STEP2_PREFIX}${actionIndex}`)
        .setPlaceholder('Quel personnage rendre ivre ?')
        .addOptions(options);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

      await interaction.update({
        content: `🍺 **${ROLES[action.roleId]?.name}** (${action.playerName}) choisit un personnage à rendre ivre.`,
        components: [row],
      });
      return;
    }
  }

  // Confirmation simple sans step2
  if (buttonType === 'yes') {
    logAction(mjId, {
      roleId: action.roleId,
      roleName: ROLES[action.roleId]?.name ?? '?',
      playerName: action.playerName,
      description: 'utilise son pouvoir',
      targets: [],
      causedDeaths: [],
    });

    const next = advanceToNextAction(mjId);
    if (next) {
      await showActionPrompt(interaction, state, next);
    } else {
      await showNightSummary(interaction, state);
    }
  }
}

/**
 * Affiche l'étape 2 d'une action multi-étape.
 */
async function showStep2Prompt(
  interaction: StringSelectMenuInteraction | ButtonInteraction,
  state: NightState,
  action: QueuedAction,
  targetNames: string[]
): Promise<void> {
  const config = getNightConfig(action.roleId);
  if (!config || !config.step2Type) return;

  const step2Prompt = config.step2Prompt
    ? config.step2Prompt
        .replace(/\{name\}/g, action.playerName)
        .replace(/\{target\}/g, targetNames.join(' et '))
    : 'Étape suivante :';

  const embed = new EmbedBuilder()
    .setTitle(`🌙 Nuit ${state.nightNumber} — ${action.index + 1}/${state.queue.length} (suite)`)
    .setDescription(
      `**${ROLES[action.roleId]?.name}** (${action.playerName}) → **${targetNames.join(' et ')}**\n\n` +
      step2Prompt
    )
    .setColor(COLORS.NIGHT);

  const components: ActionRowBuilder<any>[] = [];

  switch (config.step2Type) {
    case 'drunk_choice': {
      // Boutons : qui devient ivre
      const btn1 = new ButtonBuilder()
        .setCustomId(`${CUSTOM_IDS.NIGHT_STEP2_PREFIX}${action.index}_drunk_self`)
        .setLabel(`${action.playerName} est ivre`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🍺');

      const btn2 = new ButtonBuilder()
        .setCustomId(`${CUSTOM_IDS.NIGHT_STEP2_PREFIX}${action.index}_drunk_target`)
        .setLabel(`${targetNames[0]} est ivre`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🍺');

      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(btn1, btn2));
      break;
    }

    case 'kill_count': {
      // Boutons : 0, 1, ou 2 kills
      const btns = [0, 1, 2].map((n) =>
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_IDS.NIGHT_STEP2_PREFIX}${action.index}_kills_${n}`)
          .setLabel(`${n} mort(s)`)
          .setStyle(n === 0 ? ButtonStyle.Secondary : ButtonStyle.Danger)
          .setEmoji(n === 0 ? '0️⃣' : n === 1 ? '1️⃣' : '2️⃣')
      );
      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...btns));
      break;
    }

    case 'select_role': {
      // Menu de sélection de rôle (Parieur devine, Courtisan choisit)
      const allRoles = Object.values(ROLES);
      const options = allRoles.slice(0, 25).map((r) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(r.name)
          .setValue(r.id)
          .setEmoji(ROLE_TYPE_EMOJIS[r.type])
      );

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`${CUSTOM_IDS.NIGHT_STEP2_PREFIX}${action.index}`)
        .setPlaceholder('Choisis un rôle...')
        .addOptions(options);

      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
      break;
    }

    case 'select_dead_player':
    case 'resurrect_choice': {
      // Menu de sélection de joueur mort
      const game = await getActiveGame(interaction.user.id);
      if (!game) return;

      const deadPlayers = game.players.filter((p) => !p.isAlive);
      if (deadPlayers.length === 0) {
        embed.setDescription(embed.data.description + '\n\n*Aucun joueur mort disponible.*');
        const skipBtn = new ButtonBuilder()
          .setCustomId(`${CUSTOM_IDS.NIGHT_SKIP_PREFIX}${action.index}`)
          .setLabel('Continuer')
          .setStyle(ButtonStyle.Secondary);
        components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(skipBtn));
        break;
      }

      const options = deadPlayers.map((p) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(p.displayName)
          .setValue(p.id)
          .setDescription(`${ROLES[p.role]?.name ?? '?'}`)
      );

      const skipBtn = new ButtonBuilder()
        .setCustomId(`${CUSTOM_IDS.NIGHT_SKIP_PREFIX}${action.index}`)
        .setLabel('Ne pas ressusciter')
        .setStyle(ButtonStyle.Secondary);

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`${CUSTOM_IDS.NIGHT_STEP2_PREFIX}${action.index}`)
        .setPlaceholder('Qui ressusciter ?')
        .addOptions(options);

      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(skipBtn));
      break;
    }
  }

  await interaction.update({ embeds: [embed], components });
}

/**
 * Gère les réponses de l'étape 2 (select menus).
 */
export async function handleNightStep2Select(
  interaction: StringSelectMenuInteraction,
  actionIndex: number
): Promise<void> {
  const mjId = interaction.user.id;
  const state = getNightState(mjId);
  if (!state || !state.step2Pending) return;

  const action = state.queue[actionIndex];
  if (!action) return;

  const config = getNightConfig(action.roleId);
  const game = await getActiveGame(mjId);
  if (!game) return;

  const step2Value = interaction.values[0];
  const step1Values = state.step2Pending.step1Values;

  // Résoudre les noms
  const step1Names = step1Values.map((id) => {
    const p = game.players.find((pl) => pl.id === id);
    return p?.displayName ?? id;
  });

  let description = '';
  const targets = [...step1Names];
  const deaths: string[] = [];

  switch (state.step2Pending.type) {
    case 'select_role': {
      const roleName = ROLES[step2Value]?.name ?? step2Value;
      description = `a choisi ${step1Names.join(' et ')} → devine : *${roleName}*`;
      targets.push(roleName);
      break;
    }
    case 'select_role': {
      const roleName = ROLES[step2Value]?.name ?? step2Value;
      description = `a choisi ${step1Names.join(' et ')} → devine : *${roleName}*`;
      targets.push(roleName);
      break;
    }
    case 'select_player': {
      const p = game.players.find(pl => pl.id === step2Value);
      description = `a choisi d'utiliser son pouvoir sur ${p?.displayName ?? '?'}`;
      targets.push(p?.displayName ?? '?');
      break;
    }
    case 'select_dead_player':
    case 'resurrect_choice': {
      const resurrected = game.players.find((p) => p.id === step2Value);
      description = `ressuscite ${resurrected?.displayName ?? '?'}`;
      targets.push(resurrected?.displayName ?? '?');
      break;
    }
    default:
      description = `a choisi ${step1Names.join(' et ')} (résultat: ${step2Value})`;
  }

  // Si le rôle peut tuer avec l'étape 1 et/ou 2 (Assassin inclus)
  if (config?.canKill && state.step2Pending.type !== 'select_role') {
    // Collect deaths (Assassins targets step2)
    if (state.step2Pending.type === 'select_player') {
         addPendingDeath(mjId, step2Value);
         const victim = game.players.find((p) => p.id === step2Value);
         deaths.push(victim?.displayName ?? step2Value);
    } else {
      for (const victimId of step1Values) {
        if (victimId !== 'confirmed') {
          addPendingDeath(mjId, victimId);
          const victim = game.players.find((p) => p.id === victimId);
          deaths.push(victim?.displayName ?? victimId);
        }
      }
    }
  }

  logAction(mjId, {
    roleId: action.roleId,
    roleName: ROLES[action.roleId]?.name ?? '?',
    playerName: action.playerName,
    description,
    targets,
    causedDeaths: deaths,
  });

  await addGameLog(
    state.gameId,
    `NIGHT_${state.nightNumber}`,
    `${ROLES[action.roleId]?.name} (${action.playerName}) ${description}`,
    mjId
  );

  const next = advanceToNextAction(mjId);
  if (next) {
    await showActionPrompt(interaction, state, next);
  } else {
    await showNightSummary(interaction, state);
  }
}

/**
 * Gère les boutons de l'étape 2 (drunk_choice, kill_count).
 */
export async function handleNightStep2Button(
  interaction: ButtonInteraction,
  actionIndex: number,
  buttonData: string   // ex: 'drunk_self', 'drunk_target', 'kills_0'
): Promise<void> {
  const mjId = interaction.user.id;
  const state = getNightState(mjId);
  if (!state || !state.step2Pending) return;

  const action = state.queue[actionIndex];
  if (!action) return;

  const game = await getActiveGame(mjId);
  if (!game) return;

  const step1Values = state.step2Pending.step1Values;
  const step1Names = step1Values.map((id) => {
    const p = game.players.find((pl) => pl.id === id);
    return p?.displayName ?? id;
  });

  let description = '';
  const deaths: string[] = [];

  if (buttonData.startsWith('drunk_')) {
    const drunkTarget = buttonData === 'drunk_self' ? action.playerName : step1Names[0];
    description = `a choisi ${step1Names.join(' et ')} → ${drunkTarget} est ivre ${EMOJIS.DRUNK}`;
  } else if (buttonData.startsWith('kills_')) {
    const killCount = parseInt(buttonData.split('_')[1], 10);
    description = `rôle absent → ${killCount} mort(s) au choix du MJ`;

    // Le MJ devra marquer les morts manuellement pour les kills > 0
    // On pourrait ajouter un sous-sélecteur ici, mais gardons simple
  }

  logAction(mjId, {
    roleId: action.roleId,
    roleName: ROLES[action.roleId]?.name ?? '?',
    playerName: action.playerName,
    description,
    targets: step1Names,
    causedDeaths: deaths,
  });

  await addGameLog(
    state.gameId,
    `NIGHT_${state.nightNumber}`,
    `${ROLES[action.roleId]?.name} (${action.playerName}) ${description}`,
    mjId
  );

  const next = advanceToNextAction(mjId);
  if (next) {
    await showActionPrompt(interaction, state, next);
  } else {
    await showNightSummary(interaction, state);
  }
}

/**
 * Bouton "Passer" → skip l'action courante.
 */
export async function handleNightSkip(
  interaction: ButtonInteraction,
  actionIndex: number
): Promise<void> {
  const mjId = interaction.user.id;
  const state = getNightState(mjId);
  if (!state) return;

  const action = state.queue[actionIndex];
  if (action) {
    logAction(mjId, {
      roleId: action.roleId,
      roleName: ROLES[action.roleId]?.name ?? '?',
      playerName: action.playerName,
      description: 'passé',
      targets: [],
      causedDeaths: [],
    });
  }

  const next = advanceToNextAction(mjId);
  if (next) {
    await showActionPrompt(interaction, state, next);
  } else {
    await showNightSummary(interaction, state);
  }
}

// ============================================================
// 4. Résumé de nuit & Réveil du village
// ============================================================

/**
 * Affiche le résumé de la nuit avec les morts et le bouton "Réveiller le village".
 */
export async function showNightSummary(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ChatInputCommandInteraction,
  state: NightState
): Promise<void> {
  const game = await getActiveGame(interaction.user.id);
  if (!game) return;

  const embed = new EmbedBuilder()
    .setTitle(`🌙 Nuit ${state.nightNumber} — Résumé`)
    .setColor(COLORS.NIGHT);

  // Actions effectuées
  if (state.resolvedActions.length > 0) {
    const actionLines = state.resolvedActions.map((a, i) =>
      `**${i + 1}.** ${ROLE_TYPE_EMOJIS[ROLES[a.roleId]?.type ?? 'TOWNSFOLK']} ` +
      `${a.roleName} (${a.playerName}) — ${a.description}`
    ).join('\n');

    embed.addFields({
      name: '📋 Actions de la nuit',
      value: actionLines,
      inline: false,
    });
  } else {
    embed.addFields({
      name: '📋 Actions de la nuit',
      value: '*Aucune action effectuée.*',
      inline: false,
    });
  }

  // Morts en attente
  if (state.pendingDeaths.length > 0) {
    const deathNames = state.pendingDeaths.map((id) => {
      const p = game.players.find((pl) => pl.id === id);
      return `${EMOJIS.DEAD} **${p?.displayName ?? '?'}** (${ROLES[p?.role ?? '']?.name ?? '?'})`;
    }).join('\n');

    embed.addFields({
      name: `💀 Morts cette nuit (${state.pendingDeaths.length})`,
      value: deathNames,
      inline: false,
    });
  } else {
    embed.addFields({
      name: '💀 Morts cette nuit',
      value: '*Personne ne meurt cette nuit.*',
      inline: false,
    });
  }

  // Ajouter la liste des rôles comme pense-bête
  embed.addFields(getRoleSummaryField(game));

  embed.setFooter({
    text: 'Vérifie les morts avant de réveiller le village. Tu peux modifier la liste.',
  });

  // Composants
  const components: ActionRowBuilder<any>[] = [];

  // Menu pour modifier les morts (ajouter/retirer)
  const alivePlayers = game.players.filter((p) => p.isAlive);
  if (alivePlayers.length > 0) {
    const options = alivePlayers.map((p) => {
      const isDying = state.pendingDeaths.includes(p.id);
      return new StringSelectMenuOptionBuilder()
        .setLabel(`${isDying ? '💀' : '💚'} ${p.displayName}`)
        .setValue(p.id)
        .setDescription(isDying ? 'Retirer de la liste des morts' : 'Ajouter aux morts')
        .setDefault(isDying);
    });

    const menu = new StringSelectMenuBuilder()
      .setCustomId(CUSTOM_IDS.NIGHT_SELECT_DEATHS)
      .setPlaceholder('Modifier les morts...')
      .setMinValues(0)
      .setMaxValues(options.length)
      .addOptions(options);

    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
  }

  // Bouton Réveiller le Village
  const wakeBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.NIGHT_WAKE)
    .setLabel('Réveiller le Village')
    .setStyle(ButtonStyle.Success)
    .setEmoji('🌅');

  components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(wakeBtn));

  if (interaction.isChatInputCommand()) {
    await interaction.reply({ embeds: [embed], components, ephemeral: true });
  } else {
    await interaction.update({ embeds: [embed], components });
  }
}

/**
 * Gère la modification de la liste des morts.
 */
export async function handleSelectDeaths(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const mjId = interaction.user.id;
  const state = getNightState(mjId);
  if (!state) return;

  // Les valeurs sélectionnées sont les joueurs qui doivent mourir
  state.pendingDeaths = interaction.values;

  // Réafficher le résumé
  await showNightSummary(interaction, state);
}

/**
 * Bouton "Réveiller le Village" → annonce les morts, passe au jour.
 */
export async function handleWakeVillage(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate(); // Empêche l'expiration des 3 secondes Discord (Timeout) pendant la génération du Grimoire

  const mjId = interaction.user.id;
  const state = getNightState(mjId);
  if (!state) return;

  const game = await getActiveGame(mjId);
  if (!game) return;

  // ── 1. Appliquer les morts en BDD ──
  const deadNames: string[] = [];
  for (const playerId of state.pendingDeaths) {
    await updatePlayerState(playerId, { isAlive: false });
    const player = game.players.find((p) => p.id === playerId);
    if (player) {
      deadNames.push(player.displayName);
      await addGameLog(
        state.gameId,
        `NIGHT_${state.nightNumber}`,
        `${player.displayName} est mort cette nuit`,
        'SYSTEM',
        player.discordId
      );
    }
  }

  // ── 2. Vérifier la fin de partie ──
  const winner = await checkGameEnd(state.gameId);
  if (winner) {
    await updateGameStatus(state.gameId, GameStatus.ENDED);
    await endGame(state.gameId, winner, mjId);

    // Annonce publique de fin
    try {
      const channel = await interaction.client.channels.fetch(game.channelId);
      if (channel && channel.isTextBased() && 'send' in channel) {
        const roleReveal = game.players
          .map((p) => {
            const dead = state.pendingDeaths.includes(p.id) || !p.isAlive;
            return `${dead ? EMOJIS.DEAD : EMOJIS.ALIVE} **${p.displayName}** — *${ROLES[p.role]?.name ?? '?'}*`;
          })
          .join('\n');

        const endEmbed = new EmbedBuilder()
          .setTitle(winner === 'GOOD' ? '🎉 Le Village a triomphé !' : '💀 Les Maléfiques règnent !')
          .setDescription(roleReveal)
          .setColor(winner === 'GOOD' ? COLORS.GOOD : COLORS.EVIL)
          .setTimestamp();

        await (channel as any).send({ embeds: [endEmbed] });
      }
    } catch { /* silent */ }

    clearNightState(mjId);
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setTitle(winner === 'GOOD' ? '👼 Victoire du Village !' : '😈 Victoire des Maléfiques !')
        .setDescription('La partie est terminée.')
        .setColor(winner === 'GOOD' ? COLORS.GOOD : COLORS.EVIL)],
      components: [],
    });
    return;
  }

  // ── 3. Passer au jour ──
  const dayNumber = state.nightNumber; // Nuit 1 → Jour 1
  await updateGameStatus(state.gameId, GameStatus.DAY, dayNumber);

  // ── 4. Annonce publique ──
  try {
    const channel = await interaction.client.channels.fetch(game.channelId);
    if (channel && channel.isTextBased() && 'send' in channel) {
      const description = deadNames.length > 0
        ? `La nuit a été sanglante...\n${deadNames.map((n) => `☠️ **${n}**`).join(', ')}`
        : `Le soleil se lève sur le village. **Personne** n'est mort cette nuit.`;

      await sendPublicGrimoireUpdate(
        interaction.client,
        game,
        `☀️ Jour ${dayNumber} — Le village se réveille`,
        description,
        COLORS.DAY
      );
    }
  } catch (error) {
    console.error('❌ Annonce publique échouée:', error);
  }

  // ── 5. Nettoyage nuit → Lancement du jour ──
  const gameId = state.gameId;
  clearNightState(mjId);

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setTitle(`☀️ Jour ${dayNumber}`)
      .setDescription('Le village est réveillé. Le dashboard de jour arrive...')
      .setColor(COLORS.DAY)],
    components: [],
  });

  // Envoyer le dashboard de jour
  await sendDayDashboard(interaction.user, gameId, dayNumber);

  console.log(`☀️ Jour ${dayNumber} — ${deadNames.length} mort(s) annoncée(s)`);
}

// ============================================================
// 5. Helpers
// ============================================================

/**
 * Fournit l'info explicite à donner au MJ pour un rôle spécifique.
 */
function getRoleSpecificInfo(
  roleId: string,
  game: any,
  state: NightState
): string | null {
  const players = game.players;
  
  switch (roleId) {
    case 'godfather': {
      if (state.isFirstNight) {
        const outsiders = players
          .filter((p: any) => ROLES[p.role]?.type === 'OUTSIDER')
          .map((p: any) => `• *${ROLES[p.role]?.name ?? '?'}*`);
        return outsiders.length > 0
          ? `Dis-lui que les Étrangers en jeu sont :\n${outsiders.join('\n')}`
          : 'Dis-lui : "Il n\'y a aucun étranger en jeu."';
      }
      return null;
    }
    
    case 'grandmother': {
      if (state.isFirstNight) {
        // La grand-mère apprend un joueur gentil et son perso. 
        // Le MJ choisit lequel, on lui liste juste les gentils pour l'aider.
        const goodPlayers = players
          .filter((p: any) => p.alignment === 'GOOD' && p.role !== 'grandmother' && p.isAlive)
          .map((p: any) => `• **${p.displayName}** est ${ROLES[p.role]?.name}`);
        return `Tu dois choisir un joueur gentil et lui révéler. Voici les gentils en jeu :\n${goodPlayers.join('\n')}`;
      }
      return null;
    }
    
    case 'chambermaid': {
      // Nombre de joueurs qui se sont réveillés cette nuit (ayant une action 'completed')
      // Note: C'est le MJ qui choisit les 2 joueurs, on peut juste lui donner l'état de chaque joueur pour l'aider !
      // En fait, l'info est : "combien se sont réveillés parmi les 2 cibles".
      // Listons tous les gens qui se sont réveillés :
      const actingPlayers = state.resolvedActions.map((a: any) => a.playerName);
      if (actingPlayers.length > 0) {
        return `Pour t'aider à lui répondre (selon ses choix), voici ceux qui ont agi ce soir :\n${actingPlayers.map((p: any) => `• ${p}`).join('\n')}`;
      } else {
         return `Personne d'autre n'a agi pour l'instant ce soir.`;
      }
    }
    
    // Tous les démons qui obtiennent les 3 bluffs et la liste des sbires
    case 'plague_doctor':
    case 'glutton':
    case 'designator': {
      if (state.isFirstNight) {
        const minions = players
           .filter((p: any) => ROLES[p.role]?.type === 'MINION')
           .map((p: any) => `• **${p.displayName}** (${ROLES[p.role]?.name})`);
           
        const minionText = minions.length > 0 
           ? `Tes sbires sont :\n${minions.join('\n')}`
           : `Tu n'as aucun sbire.`;
           
        // Chercher 3 rôles absents (Not in Game) de la config
        // Idéalement on devrait les pré-calculer, mais en attendant on rappelle la règle :
        return `Dévoile-lui 3 rôles absents (à toi de choisir judicieusement !).\n\nPuis, annonce-lui ses alliés :\n${minionText}`;
      }
      return null;
    }

    default:
      return null;
  }
}
