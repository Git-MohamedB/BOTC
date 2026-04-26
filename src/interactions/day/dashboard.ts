// ============================================================
// Day Flow — Dashboard, Timer, Nominations, Votes, Exécution
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
} from 'discord.js';
import { COLORS, EMOJIS, CUSTOM_IDS } from '../../utils/constants';
import { ROLES } from '../../data/roles';
import prisma from '../../database/prisma';
import { getActiveGame, updateGameStatus, addGameLog } from '../../services/gameService';
import {
  getVoteThreshold,
  executePlayer,
  consumeGhostVotes,
  checkGameEnd,
  endGame,
} from '../../services/dayEngine';
import { GameStatus } from '../../types/game';
import { sendNightDashboard } from '../night/dashboard';
import { generateGrimoire, type GrimoirePlayer } from '../../services/grimoire';
import {
  createDayState,
  getDayState,
  clearDayState,
  updateExecutionMark,
  type NominationRecord,
  type DayState,
} from './state';

/**
 * Envoie ou édite le Grimoire dans le salon public.
 */
export async function sendPublicGrimoireUpdate(
  client: any,
  game: any,
  title: string,
  description: string,
  color: number
): Promise<void> {
  try {
    const channel = await client.channels.fetch(game.channelId);
    if (!channel || !('send' in channel)) return;

    const grimoirePlayers: GrimoirePlayer[] = game.players.map((p: any) => ({
      displayName: p.displayName,
      avatarUrl: p.avatarUrl ?? `https://cdn.discordapp.com/embed/avatars/${parseInt(p.discordId) % 5}.png`,
      role: p.role,
      isAlive: p.isAlive,
      alignment: p.alignment,
      state: p.state,
      seatOrder: p.seatOrder,
    }));

    const statusLabel = game.status === 'NIGHT'
      ? `🌙 Nuit ${game.phase || 1}`
      : game.status === 'DAY'
        ? `☀️ Jour ${game.phase || 1}`
        : `⚙️ ${game.status}`;

    const { attachment, embed } = await generateGrimoire(grimoirePlayers, {
      showRoles: false,
      showAlignments: false,
      phaseLabel: statusLabel,
      title: '📜 Grimoire',
    });

    embed.setTitle(`📜 Grimoire — ${title}`);
    if (description) embed.setDescription(description);
    embed.setColor(color);

    // Chercher le dernier message du bot avec "Grimoire" pour l'éditer (évite le spam)
    const messages = await channel.messages.fetch({ limit: 20 });
    const lastGrimoireMsg = messages.find(
      (m: any) => m.author.id === client.user.id && m.embeds[0]?.title?.includes('Grimoire')
    );

    if (lastGrimoireMsg) {
      await lastGrimoireMsg.edit({ embeds: [embed], files: [attachment], attachments: [] });
    } else {
      await (channel as any).send({ embeds: [embed], files: [attachment] });
    }
  } catch (error) {
    console.error('❌ Grimoire public update failed:', error);
  }
}

// Helper pour afficher la liste des rôles sur le dashboard MJ
export function getRoleSummaryField(game: any) {
  const roleList = game.players
    .map((p: any) => `${p.isAlive ? EMOJIS.ALIVE : EMOJIS.DEAD} **${p.displayName}** — *${ROLES[p.role]?.name ?? '?'}*`)
    .join('\n');
  return {
    name: '👥 Joueurs et Rôles',
    value: roleList,
    inline: false
  };
}

// ============================================================
// 1. Dashboard de jour
// ============================================================

export async function sendDayDashboard(
  mjUser: User,
  gameId: string,
  dayNumber: number
): Promise<void> {
  const mjId = mjUser.id;
  const game = await getActiveGame(mjId);
  if (!game) return;

  createDayState(mjId, gameId, dayNumber);

  const alivePlayers = game.players.filter((p) => p.isAlive);
  const threshold = getVoteThreshold(alivePlayers.length);

  const embed = new EmbedBuilder()
    .setTitle(`☀️ JOUR ${dayNumber}`)
    .setDescription(
      `**${alivePlayers.length}** joueurs en vie sur **${game.players.length}**\n` +
      `**Seuil de vote :** ${threshold} (majorité absolue)\n\n` +
      `Fais tes nominations et votes silencieusement.`
    )
    .setColor(COLORS.DAY)
    .addFields(getRoleSummaryField(game))
    .setFooter({ text: `Partie ${gameId.slice(0, 8)} · Jour ${dayNumber}` });

  const timerBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.DAY_TIMER)
    .setLabel('Chrono 10min')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('⏱️');

  const nominateBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.DAY_NOMINATE)
    .setLabel('Nominer')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🗳️');

  const endDayBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.DAY_END)
    .setLabel('Fin du jour')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🌙');

  const endGameBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.MJ_END_GAME)
    .setLabel('Terminer la partie')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🏁');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    timerBtn,
    nominateBtn,
    endDayBtn,
    endGameBtn
  );

  await mjUser.send({ embeds: [embed], components: [row] });
}

// ============================================================
// 2. Timer de discussion
// ============================================================

export async function handleDayTimer(interaction: ButtonInteraction, isAdd: boolean = false): Promise<void> {
  const mjId = interaction.user.id;
  const state = getDayState(mjId);
  if (!state) return;

  const game = await getActiveGame(mjId);
  if (!game) return;

  if (isAdd && state.timerEnd) {
    state.timerEnd += 60; // +1 minute
  } else {
    state.timerEnd = Math.floor(Date.now() / 1000) + 600; // 10 minutes from now
  }

  // Edit or send the public timer message
  try {
    const channel = await interaction.client.channels.fetch(game.channelId);
    if (channel && channel.isTextBased() && 'send' in channel) {
      if (state.timerMsgId) {
        // Tente d'éditer le message existant
        try {
          const msg = await channel.messages.fetch(state.timerMsgId);
          await msg.edit(`⏱️ **Phase de discussion** — Le village a jusqu'à <t:${state.timerEnd}:T> (<t:${state.timerEnd}:R>)`);
        } catch {
          // Message deleted or not found, resend
          const newMsg = await (channel as any).send(
            `⏱️ **Phase de discussion** — Le village a jusqu'à <t:${state.timerEnd}:T> (<t:${state.timerEnd}:R>)`
          );
          state.timerMsgId = newMsg.id;
        }
      } else {
        const newMsg = await (channel as any).send(
          `⏱️ **Phase de discussion** — Le village a jusqu'à <t:${state.timerEnd}:T> (<t:${state.timerEnd}:R>)`
        );
        state.timerMsgId = newMsg.id;
      }
    }
  } catch (error) {
    console.error('❌ Chrono public échoué:', error);
  }

  const alivePlayers = game.players.filter((p) => p.isAlive);
  const threshold = getVoteThreshold(alivePlayers.length);

  const embed = new EmbedBuilder()
    .setTitle(`☀️ JOUR ${state.dayNumber} — Chrono <t:${state.timerEnd}:R>`)
    .setDescription(
      `**${alivePlayers.length}** en vie | Seuil de vote : **${threshold}**\n\n` +
      `Le timer public a été mis à jour.`
    )
    .setColor(COLORS.DAY)
    .addFields(getRoleSummaryField(game));

  const addTimerBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.DAY_TIMER_ADD)
    .setLabel('+1 min')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('⏳');

  const nominateBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.DAY_NOMINATE)
    .setLabel('Nominer')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🗳️');

  const endDayBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.DAY_END)
    .setLabel('Fin du jour')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🌙');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    addTimerBtn,
    nominateBtn,
    endDayBtn
  );

  await interaction.update({ embeds: [embed], components: [row] });
}

// ============================================================
// 3. Nomination
// ============================================================

export async function handleNominate(interaction: ButtonInteraction): Promise<void> {
  const mjId = interaction.user.id;
  const state = getDayState(mjId);
  if (!state) return;

  const game = await getActiveGame(mjId);
  if (!game) return;

  const alivePlayers = game.players.filter((p) => p.isAlive);
  const alreadyNominated = new Set(state.nominations.map((n) => n.nomineeId));
  const eligible = alivePlayers.filter((p) => !alreadyNominated.has(p.id));

  if (eligible.length === 0) {
    // Si aucun éligible, rester affiché sur le dashboard
    const m = interaction.message.embeds[0];
    await interaction.update({
      embeds: [new EmbedBuilder(m.data).setDescription(
        `${m.description}\n\n${EMOJIS.CROSS} **Tous les vivants ont déjà été nominés.**`
      )],
    });
    return;
  }

  const options = eligible.map((p) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(p.displayName)
      .setValue(p.id)
      .setDescription(`Siège ${p.seatOrder + 1}`)
  );

  const menu = new StringSelectMenuBuilder()
    .setCustomId(CUSTOM_IDS.DAY_NOM_SELECT)
    .setPlaceholder('Qui est nominé ?')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

  // Bouton retour rapide (Annuler)
  const cancelBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.DAY_CANCEL_NOM)
    .setLabel('Annuler la nomination')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('❌');

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(cancelBtn);

  const embed = new EmbedBuilder()
    .setTitle(`🗳️ Phase de Nomination`)
    .setDescription(`Choisis le joueur que l'on veut envoyer au bûcher.\n*(Action silencieuse sur Discord)*`)
    .setColor(COLORS.DAY)
    .addFields(getRoleSummaryField(game));

  await interaction.update({ embeds: [embed], components: [row, row2] });
}

export async function handleNomSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const mjId = interaction.user.id;
  const state = getDayState(mjId);
  if (!state) return;

  const game = await getActiveGame(mjId);
  if (!game) return;

  const nomineeId = interaction.values[0];
  const nominee = game.players.find((p) => p.id === nomineeId);
  if (!nominee) return;

  const alivePlayers = game.players.filter((p) => p.isAlive);
  const deadWithGhostVote = game.players.filter((p) => !p.isAlive && p.hasGhostVote);
  const threshold = getVoteThreshold(alivePlayers.length);

  // Pas d'annonce publique ! Uniquement pour le MJ
  const voterOptions: StringSelectMenuOptionBuilder[] = [];

  for (const player of alivePlayers) {
    voterOptions.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(`💚 ${player.displayName}`)
        .setValue(player.id)
        .setDescription(player.id === nomineeId ? 'Le nominé' : `Siège ${player.seatOrder + 1}`)
    );
  }

  for (const player of deadWithGhostVote) {
    voterOptions.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(`👻 ${player.displayName} (ghost vote)`)
        .setValue(player.id)
        .setDescription('Vote fantôme (unique)')
    );
  }

  const voteEmbed = new EmbedBuilder()
    .setTitle(`🗳️ Vote : ${nominee.displayName}`)
    .setDescription(
      `Seuil d'exécution : **${threshold}** votes.\n` +
      `Coche TOUS les joueurs qui ont levé la main pour tuer **${nominee.displayName}**.\n\n` +
      `*Si tu sélectionnes des fantômes, leur jeton "Ghost Vote" sera défaussé définitivement.*`
    )
    .setColor(COLORS.DAY)
    .addFields(getRoleSummaryField(game))
    .setFooter({ text: `nominee:${nomineeId}` }); // Astuce de stockage pour handleVote

  const menu = new StringSelectMenuBuilder()
    .setCustomId(CUSTOM_IDS.DAY_VOTE)
    .setPlaceholder('Qui vote POUR ?')
    .setMinValues(0)
    .setMaxValues(voterOptions.length)
    .addOptions(voterOptions);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

  const cancelBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.DAY_CANCEL_NOM)
    .setLabel('Annuler la nomination')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('❌');
  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(cancelBtn);

  await interaction.update({ embeds: [voteEmbed], components: [row, btnRow] });
}

// ============================================================
// 4. Votes
// ============================================================

export async function handleVote(interaction: StringSelectMenuInteraction): Promise<void> {
  const mjId = interaction.user.id;
  const state = getDayState(mjId);
  if (!state) return;

  const game = await getActiveGame(mjId);
  if (!game) return;

  const embedMsg = interaction.message.embeds[0];
  const footerText = embedMsg?.footer?.text ?? '';
  const nomineeId = footerText.replace('nominee:', '');
  const nominee = game.players.find((p) => p.id === nomineeId);
  if (!nominee) return;

  const voterIds = interaction.values;
  const alivePlayers = game.players.filter((p) => p.isAlive);
  const threshold = getVoteThreshold(alivePlayers.length);

  const ghostVoterIds = voterIds.filter((id) => {
    const player = game.players.find((p) => p.id === id);
    return player && !player.isAlive;
  });

  const voterNames = voterIds.map((id) => {
    const player = game.players.find((p) => p.id === id);
    const isGhost = ghostVoterIds.includes(id);
    return `${isGhost ? '👻' : '✅'} ${player?.displayName ?? '?'}`;
  });

  const totalVotes = voterIds.length;
  const passed = totalVotes >= threshold;

  const nomination: NominationRecord = {
    nomineeId,
    nomineeName: nominee.displayName,
    voters: voterIds,
    voterNames: voterNames,
    ghostVoters: ghostVoterIds,
    totalVotes,
    threshold,
    passed,
  };

  state.nominations.push(nomination);
  updateExecutionMark(mjId, nomination);

  if (ghostVoterIds.length > 0) {
    await consumeGhostVotes(ghostVoterIds);
  }

  await addGameLog(
    state.gameId,
    `DAY_${state.dayNumber}`,
    `${nominee.displayName} nominé — ${totalVotes}/${threshold} votes — ${passed ? 'EXÉCUTÉ' : 'ACQUITTÉ'}`,
    mjId
  );

  const mark = state.markedForExecution;
  const resultEmbed = new EmbedBuilder()
    .setTitle(passed ? `${EMOJIS.DEAD} Déclaré Coupable !` : `${EMOJIS.CHECK} Déclaré Acquitté`)
    .setDescription(
      `**${nominee.displayName}** a reçu **${totalVotes}** vote(s) (Seuil: ${threshold}).\n\n` +
      (mark
        ? `📌 **Potentiellement exécuté :** ${mark.playerName} avec ${mark.voteCount} votes (sur la potence).`
        : '*Personne n\'est actuellement marqué pour l\'exécution.*') +
      `\n\n*(Les joueurs ne reçoivent rien, tout est géré par toi à l'oral)*`
    )
    .setColor(passed ? 0xe74c3c : COLORS.DAY)
    .addFields(getRoleSummaryField(game));

  const nominateBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.DAY_NOMINATE)
    .setLabel('Autre nomination')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🗳️');

  const endDayBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.DAY_END)
    .setLabel('Fin du jour')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🌙');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(nominateBtn, endDayBtn);

  await interaction.update({ embeds: [resultEmbed], components: [row] });
}

export async function handleCancelNomination(interaction: ButtonInteraction): Promise<void> {
  const mjId = interaction.user.id;
  const game = await getActiveGame(mjId);
  const embed = new EmbedBuilder()
    .setTitle(`☀️ JOUR`)
    .setDescription(`Nomination annulée.`)
    .setColor(COLORS.DAY);

  if (game) embed.addFields(getRoleSummaryField(game));

  const nominateBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.DAY_NOMINATE)
    .setLabel('Nominer')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🗳️');

  const endDayBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.DAY_END)
    .setLabel('Fin du jour')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🌙');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(nominateBtn, endDayBtn);

  await interaction.update({ embeds: [embed], components: [row] });
}

// ============================================================
// 5. Fin du jour & Exécution
// ============================================================

export async function handleEndDay(interaction: ButtonInteraction): Promise<void> {
  const mjId = interaction.user.id;
  const state = getDayState(mjId);
  if (!state) return;

  const game = await getActiveGame(mjId);
  if (!game) return;

  if (state.markedForExecution && !state.executionDone) {
    const confirmEmbed = new EmbedBuilder()
      .setTitle('⚖️ Confirmer la nuit')
      .setDescription(
        `La journée se termine !\n\n` +
        `**${state.markedForExecution.playerName}** est au bûcher avec ${state.markedForExecution.voteCount} votes.\n` +
        `Si tu confirmes son exécution, le joueur mourra et le Grimoire sera posté sur Discord.`
      )
      .setColor(0xe74c3c)
      .addFields(getRoleSummaryField(game));

    const confirmBtn = new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.DAY_EXEC_CONFIRM)
      .setLabel(`Exécuter ${state.markedForExecution.playerName}`)
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⚔️');

    const skipBtn = new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.DAY_SKIP_EXEC)
      .setLabel('Pardonner (Pas d\'exécution)')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⏭️');

    const cancelBtn = new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.DAY_CANCEL_EXEC)
      .setLabel('◀️ Faire une autre nomination')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('◀️');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, skipBtn, cancelBtn);

    await interaction.update({ embeds: [confirmEmbed], components: [row] });
    return;
  }

  await transitionToNight(interaction, state);
}

export async function handleExecConfirm(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();

  const mjId = interaction.user.id;
  const state = getDayState(mjId);
  if (!state || !state.markedForExecution) return;

  let game = await getActiveGame(mjId);
  if (!game) return;

  const result = await executePlayer(state.gameId, state.markedForExecution.playerId, mjId);
  state.executionDone = true;

  game = await getActiveGame(mjId); // Refresh

  // Annonce Grimoire Execution Automatique
  if (game) {
    await sendPublicGrimoireUpdate(
      interaction.client,
      game,
      '⚔️ Le couperet est tombé',
      `**${result.name}** a été exécuté par le village.`,
      0xe74c3c
    );
  }

  const winner = await checkGameEnd(state.gameId);
  if (winner) {
    await handleGameEnd(interaction, state, game, winner);
    return;
  }

  await transitionToNight(interaction, state);
}

export async function handleSkipExec(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();

  const mjId = interaction.user.id;
  const state = getDayState(mjId);
  if (!state) return;

  state.markedForExecution = undefined;
  state.executionDone = true;

  await transitionToNight(interaction, state);
}

export async function handleCancelExec(interaction: ButtonInteraction): Promise<void> {
  // Re-affiches le dashboard du Jour sans valider.
  const mjId = interaction.user.id;
  const game = await getActiveGame(mjId);
  const state = getDayState(mjId);
  if (!game || !state) return;

  const alivePlayers = game.players.filter((p) => p.isAlive);
  const threshold = getVoteThreshold(alivePlayers.length);

  const embed = new EmbedBuilder()
    .setTitle(`☀️ JOUR ${state.dayNumber}`)
    .setDescription(
      `**${alivePlayers.length}** en vie | Seuil de vote : **${threshold}**\n\n` +
      `Retour aux nominations.`
    )
    .setColor(COLORS.DAY)
    .addFields(getRoleSummaryField(game));

  const addTimerBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.DAY_TIMER_ADD)
    .setLabel('+1 min')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('⏳');

  const nominateBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.DAY_NOMINATE)
    .setLabel('Nominer')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🗳️');

  const endDayBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.DAY_END)
    .setLabel('Fin du jour')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🌙');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    addTimerBtn,
    nominateBtn,
    endDayBtn
  );

  await interaction.update({ embeds: [embed], components: [row] });
}

async function transitionToNight(
  interaction: ButtonInteraction,
  state: DayState
): Promise<void> {
  const mjId = interaction.user.id;
  const nextNight = state.dayNumber + 1;

  await updateGameStatus(state.gameId, GameStatus.NIGHT, nextNight);

  const game = await getActiveGame(mjId);

  const embed = new EmbedBuilder()
    .setTitle(`📋 Résumé — Jour ${state.dayNumber}`)
    .setDescription(
      state.executionDone && state.markedForExecution
        ? `⚔️ **Exécuté :** ${state.markedForExecution.playerName}`
        : `✨ Personne n'a été exécuté.`
    )
    .setColor(COLORS.DAY)
    .setFooter({ text: `La nuit ${nextNight} commence...` });

  if (game) embed.addFields(getRoleSummaryField(game));

  const payload = { embeds: [embed], components: [] };
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload);
  } else {
    await interaction.update(payload);
  }

  // Optionnel: on n'envoie plus de msg de nuit textuel car le Grimoire fait foi,
  // et le user a dit de supprimer le message.
  clearDayState(mjId);
  await sendNightDashboard(interaction.user, state.gameId, nextNight);
}

// ============================================================
// 6. Fin de partie
// ============================================================

export async function handleEndGameButton(interaction: ButtonInteraction): Promise<void> {
  const confirmGoodBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.MJ_END_CONFIRM_GOOD)
    .setLabel('Victoire du Village')
    .setStyle(ButtonStyle.Success)
    .setEmoji('👼');

  const confirmEvilBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.MJ_END_CONFIRM_EVIL)
    .setLabel('Victoire des Maléfiques')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('😈');

  const cancelBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.MJ_END_CANCEL)
    .setLabel('Annuler')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('◀️');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmGoodBtn, confirmEvilBtn, cancelBtn);

  // Note: On ne fait pas fetch de game ici car on affiche direct les boutons, mais c'est okay
  await interaction.update({
    content: `${EMOJIS.WARNING} **Terminer la partie ?** Choisis le camp gagnant :`,
    embeds: [],
    components: [row],
  });
}

export async function handleEndGameConfirm(interaction: ButtonInteraction, winner: 'GOOD' | 'EVIL'): Promise<void> {
  const mjId = interaction.user.id;
  const game = await getActiveGame(mjId);
  if (!game) return;

  const state = getDayState(mjId);
  const gameId = state?.gameId ?? game.id;

  await handleGameEnd(interaction, state, game, winner);
}

export async function handleEndGameCancel(interaction: ButtonInteraction): Promise<void> {
  const mjId = interaction.user.id;
  const game = await getActiveGame(mjId);
  const embed = new EmbedBuilder().setTitle('☀️ JOUR').setColor(COLORS.DAY);
  if (game) embed.addFields(getRoleSummaryField(game));

  const endDayBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.DAY_END)
    .setLabel('Fin du jour')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🌙');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(endDayBtn);

  await interaction.update({
    content: `${EMOJIS.CHECK} Annulé. La partie continue.`,
    embeds: [embed],
    components: [row],
  });
}

async function handleGameEnd(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  state: DayState | undefined,
  game: any,
  winner: 'GOOD' | 'EVIL'
): Promise<void> {
  const mjId = interaction.user.id;
  const gameId = state?.gameId ?? game.id;

  await endGame(gameId, winner, mjId);
  if (state) clearDayState(mjId);

  const roleReveal = game.players
    .map((p: any) => {
      const role = ROLES[p.role];
      const status = p.isAlive ? EMOJIS.ALIVE : EMOJIS.DEAD;
      const alignment = p.alignment === 'EVIL' ? EMOJIS.EVIL : EMOJIS.GOOD;
      return `${status} ${alignment} **${p.displayName}** — *${role?.name ?? '?'}*`;
    })
    .join('\n');

  const mjEmbed = new EmbedBuilder()
    .setTitle(winner === 'GOOD' ? '👼 Victoire du Village !' : '😈 Victoire des Maléfiques !')
    .setDescription(`La partie est terminée.\n\n**Rôles :**\n${roleReveal}`)
    .setColor(winner === 'GOOD' ? COLORS.GOOD : COLORS.EVIL)
    .setTimestamp();

  // ── Générer l'Historique de Partie ──
  const logs = await prisma.gameLog.findMany({
    where: { gameId },
    orderBy: { createdAt: 'asc' },
  });

  const historyLines = logs.map((log) => {
    const time = new Date(log.createdAt).toLocaleTimeString('fr-FR');
    const phase = `[${log.phase}]`;
    const actorStr = log.actor ? `${log.actor} ` : '';
    const targetStr = log.target ? ` -> ${log.target}` : '';
    const resultStr = log.result ? ` (${log.result})` : '';
    return `${time} ${phase} ${actorStr}${log.action}${targetStr}${resultStr}`;
  });

  const historyText = `=====================================\n` +
                      `HISTORIQUE DE LA PARTIE : ${gameId}\n` +
                      `Victoire : ${winner === 'GOOD' ? 'Village' : 'Maléfiques'}\n` +
                      `=====================================\n\n` +
                      historyLines.join('\n');

  const historyBuffer = Buffer.from(historyText, 'utf-8');
  const historyAttachment = {
    attachment: historyBuffer,
    name: `botc_historique_${gameId.slice(0, 8)}.txt`,
  };

  const mjPayload = {
    content: '',
    embeds: [mjEmbed],
    components: [],
    files: [historyAttachment]
  };

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(mjPayload);
  } else {
    await interaction.update(mjPayload);
  }

  // Update public with grimoire (fully revealed)
  try {
    const channel = await interaction.client.channels.fetch(game.channelId);
    if (channel && channel.isTextBased() && 'send' in channel) {
      const grimoirePlayers: GrimoirePlayer[] = game.players.map((p: any) => ({
        displayName: p.displayName,
        avatarUrl: p.avatarUrl ?? `https://cdn.discordapp.com/embed/avatars/${parseInt(p.discordId) % 5}.png`,
        role: p.role,
        isAlive: p.isAlive,
        alignment: p.alignment,
        state: p.state,
        seatOrder: p.seatOrder,
      }));

      const { attachment, embed } = await generateGrimoire(grimoirePlayers, {
        showRoles: true,
        showAlignments: true,
        phaseLabel: '🏁 Fin de partie',
        title: winner === 'GOOD' ? '👼 Victoire du Village !' : '😈 Victoire des Maléfiques !',
      });

      embed.setDescription(
        (winner === 'GOOD'
          ? 'Les forces du Bien ont terrassé le Mal !\n\n'
          : 'Les ténèbres engloutissent le village...\n\n') +
        `**Révélation des rôles :**\n${roleReveal}`
      );
      embed.setColor(winner === 'GOOD' ? COLORS.GOOD : COLORS.EVIL);

      // Pour la fin de partie, on envoie un nouveau message public pour marquer le coup
      await (channel as any).send({ embeds: [embed], files: [attachment] });
    }
  } catch (error) {
    console.error('❌ Annonce fin de partie échouée:', error);
  }

  console.log(`🏁 Partie ${gameId} terminée — ${winner} gagne !`);
}
