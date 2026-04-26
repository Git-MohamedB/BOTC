// ============================================================
// Service : Grimoire Visuel (Canvas)
// ============================================================
// Génère une image du cercle des joueurs avec leurs avatars Discord,
// leurs noms, et leur statut (vivant/mort, rôle pour le MJ).

import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { ROLES } from '../data/roles';
import { RoleType, Alignment } from '../types/game';

// ============================================================
// Constantes visuelles
// ============================================================

const CANVAS_SIZE = 900;
const CENTER_X = CANVAS_SIZE / 2;
const CENTER_Y = CANVAS_SIZE / 2 + 20; // Le cercle descend un peu pour le titre
const CIRCLE_RADIUS = 320;
const AVATAR_SIZE = 72;
const AVATAR_BORDER = 4;

// Palette de couleurs BotC
const PALETTE = {
  BACKGROUND_TOP: '#1a0a2e',     // Violet très sombre
  BACKGROUND_BOTTOM: '#0d0d2b',  // Bleu nuit
  ALIVE_BORDER: '#2ecc71',       // Vert vif
  DEAD_BORDER: '#e74c3c',        // Rouge vif (pour qu'on voie bien le cercle des morts)
  EVIL_GLOW: '#8b0000',          // Rouge sombre
  GOOD_GLOW: '#2e8b57',          // Vert forêt
  TEXT_WHITE: '#ffffff',
  TEXT_GREY: '#aaaaaa',
  TEXT_DEAD: '#777777',
  ROLE_TOWNSFOLK: '#3498db',     // Bleu
  ROLE_OUTSIDER: '#9b59b6',      // Violet
  ROLE_MINION: '#e74c3c',        // Rouge
  ROLE_DEMON: '#c0392b',         // Rouge foncé
  CENTER_BG: 'rgba(0, 0, 0, 0.5)',
  TITLE_GOLD: '#f1c40f',         // Or
} as const;

const ROLE_COLORS: Record<string, string> = {
  [RoleType.TOWNSFOLK]: PALETTE.ROLE_TOWNSFOLK,
  [RoleType.OUTSIDER]: PALETTE.ROLE_OUTSIDER,
  [RoleType.MINION]: PALETTE.ROLE_MINION,
  [RoleType.DEMON]: PALETTE.ROLE_DEMON,
};

// ============================================================
// Types
// ============================================================

export interface GrimoirePlayer {
  displayName: string;
  avatarUrl: string;     // URL de l'avatar Discord (128px)
  role: string;          // roleId
  isAlive: boolean;
  alignment: string;     // GOOD | EVIL
  state: string;         // NORMAL | DRUNK | POISONED
  seatOrder: number;
}

export interface GrimoireOptions {
  /** Afficher les rôles (vue MJ) ou les cacher (vue publique) */
  showRoles: boolean;
  /** Afficher les alignements */
  showAlignments: boolean;
  /** Numéro de la phase (Nuit 1, Jour 1, etc.) */
  phaseLabel: string;
  /** Titre additionnel */
  title?: string;
}

// ============================================================
// Génération de l'image
// ============================================================

/**
 * Génère l'image du Grimoire et retourne un AttachmentBuilder Discord.
 */
export async function generateGrimoire(
  players: GrimoirePlayer[],
  options: GrimoireOptions
): Promise<{ attachment: AttachmentBuilder; embed: EmbedBuilder }> {
  const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  const ctx = canvas.getContext('2d');

  // 1. Fond dégradé
  drawBackground(ctx);

  // 2. Titre
  drawTitle(ctx, options);

  // 3. Cercle central (info)
  drawCenterInfo(ctx, players, options);

  // 4. Lignes de connexion (cercle)
  drawCircleLines(ctx, players.length);

  // 5. Joueurs autour du cercle
  await drawPlayers(ctx, players, options);

  // 6. Légende (en bas)
  drawLegend(ctx, options);

  // Exporter le canvas en PNG
  const buffer = canvas.toBuffer('image/png');
  const attachment = new AttachmentBuilder(buffer, { name: 'grimoire.png' });

  const embed = new EmbedBuilder()
    .setTitle(options.title ?? '📜 Grimoire')
    .setImage('attachment://grimoire.png')
    .setColor(0x9b59b6)
    .setFooter({ text: options.phaseLabel });

  return { attachment, embed };
}

// ============================================================
// Fonctions de dessin
// ============================================================

/** Fond dégradé violet/bleu nuit */
function drawBackground(ctx: SKRSContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_SIZE);
  gradient.addColorStop(0, PALETTE.BACKGROUND_TOP);
  gradient.addColorStop(1, PALETTE.BACKGROUND_BOTTOM);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Effet étoilé subtil
  ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * CANVAS_SIZE;
    const y = Math.random() * CANVAS_SIZE;
    const r = Math.random() * 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Titre en haut du grimoire */
function drawTitle(ctx: SKRSContext2D, options: GrimoireOptions): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Titre principal
  ctx.fillStyle = PALETTE.TITLE_GOLD;
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('Blood on the Clocktower', CENTER_X, 30);

  // Sous-titre (phase)
  ctx.fillStyle = PALETTE.TEXT_GREY;
  ctx.font = '18px sans-serif';
  ctx.fillText(options.phaseLabel, CENTER_X, 58);
}

/** Informations au centre du cercle */
function drawCenterInfo(
  ctx: SKRSContext2D,
  players: GrimoirePlayer[],
  options: GrimoireOptions
): void {
  const alive = players.filter((p) => p.isAlive).length;
  const dead = players.length - alive;

  // Cercle semi-transparent au centre
  ctx.beginPath();
  ctx.arc(CENTER_X, CENTER_Y, 80, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.CENTER_BG;
  ctx.fill();
  ctx.strokeStyle = 'rgba(241, 196, 15, 0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Compteurs
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = PALETTE.ALIVE_BORDER;
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(`${alive}`, CENTER_X - 25, CENTER_Y - 10);

  ctx.fillStyle = PALETTE.TEXT_GREY;
  ctx.font = '20px sans-serif';
  ctx.fillText('/', CENTER_X, CENTER_Y - 10);

  ctx.fillStyle = PALETTE.DEAD_BORDER;
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(`${dead}`, CENTER_X + 25, CENTER_Y - 10);

  ctx.fillStyle = PALETTE.TEXT_GREY;
  ctx.font = '14px sans-serif';
  ctx.fillText('vivants / morts', CENTER_X, CENTER_Y + 20);

  // Phase
  ctx.fillStyle = PALETTE.TITLE_GOLD;
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(options.phaseLabel, CENTER_X, CENTER_Y + 45);
}

/** Lignes reliant les joueurs en cercle */
function drawCircleLines(ctx: SKRSContext2D, playerCount: number): void {
  if (playerCount < 2) return;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;

  for (let i = 0; i < playerCount; i++) {
    const angle1 = (2 * Math.PI * i) / playerCount - Math.PI / 2;
    const angle2 = (2 * Math.PI * ((i + 1) % playerCount)) / playerCount - Math.PI / 2;

    const x1 = CENTER_X + CIRCLE_RADIUS * Math.cos(angle1);
    const y1 = CENTER_Y + CIRCLE_RADIUS * Math.sin(angle1);
    const x2 = CENTER_X + CIRCLE_RADIUS * Math.cos(angle2);
    const y2 = CENTER_Y + CIRCLE_RADIUS * Math.sin(angle2);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

/** Dessine tous les joueurs autour du cercle */
async function drawPlayers(
  ctx: SKRSContext2D,
  players: GrimoirePlayer[],
  options: GrimoireOptions
): Promise<void> {
  const count = players.length;

  for (let i = 0; i < count; i++) {
    const player = players[i];
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const x = CENTER_X + CIRCLE_RADIUS * Math.cos(angle);
    const y = CENTER_Y + CIRCLE_RADIUS * Math.sin(angle);

    await drawPlayer(ctx, player, x, y, options);
  }
}

/** Dessine un joueur individuel */
async function drawPlayer(
  ctx: SKRSContext2D,
  player: GrimoirePlayer,
  x: number,
  y: number,
  options: GrimoireOptions
): Promise<void> {
  const halfAvatar = AVATAR_SIZE / 2;
  const role = ROLES[player.role];

  // ── Bordure colorée (anneau) ──
  const borderColor = player.isAlive ? PALETTE.ALIVE_BORDER : PALETTE.DEAD_BORDER;
  ctx.beginPath();
  ctx.arc(x, y, halfAvatar + AVATAR_BORDER, 0, Math.PI * 2);
  ctx.fillStyle = borderColor;
  ctx.fill();

  // Glow pour les maléfiques (MJ only)
  if (options.showAlignments && player.alignment === Alignment.EVIL && player.isAlive) {
    ctx.beginPath();
    ctx.arc(x, y, halfAvatar + AVATAR_BORDER + 4, 0, Math.PI * 2);
    ctx.strokeStyle = PALETTE.EVIL_GLOW;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // ── Avatar ──
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, halfAvatar, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  try {
    const avatarImage = await loadImage(player.avatarUrl);
    ctx.drawImage(
      avatarImage,
      x - halfAvatar,
      y - halfAvatar,
      AVATAR_SIZE,
      AVATAR_SIZE
    );
  } catch {
    // Avatar introuvable → fond gris
    ctx.fillStyle = '#333333';
    ctx.fillRect(x - halfAvatar, y - halfAvatar, AVATAR_SIZE, AVATAR_SIZE);
    ctx.fillStyle = PALETTE.TEXT_WHITE;
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(player.displayName.charAt(0).toUpperCase(), x, y);
  }

  ctx.restore();

  // ── Bannière de Rôle Incrustée (MJ View - Grimoire Animé) ──
  if (options.showRoles && role) {
    const bannerHeight = 16;
    const bannerY = y + halfAvatar - bannerHeight;

    ctx.save();
    // Ombre de fond pour la lisibilité
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(x - halfAvatar, bannerY, AVATAR_SIZE, bannerHeight);

    // Texte du rôle centré
    const roleColor = ROLE_COLORS[role.type] ?? PALETTE.TEXT_WHITE;
    ctx.fillStyle = player.isAlive ? roleColor : PALETTE.TEXT_DEAD;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Si ivre ou empoisonné, on le met en rouge clignotant (Visuel fort)
    const roleText = (player.state !== 'NORMAL' && player.isAlive) 
      ? `⚠️ ${player.state}` 
      : role.name.toUpperCase();
      
    if (player.state !== 'NORMAL' && player.isAlive) {
      ctx.fillStyle = '#ffcc00'; // Warning Gold
    }

    ctx.fillText(roleText.substring(0, 15), x, bannerY + (bannerHeight / 2));
    ctx.restore();
  }

  // ── Overlay mort (croix ou gris) ──
  if (!player.isAlive) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, halfAvatar, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x - halfAvatar, y - halfAvatar, AVATAR_SIZE, AVATAR_SIZE);
    ctx.restore();

    // Skull emoji / X
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✕', x, y);
  }

  // ── Indicateur ivre/empoisonné ──
  if (player.state === 'DRUNK' || player.state === 'POISONED') {
    // Petit cercle en haut à droite
    const badgeX = x + halfAvatar - 5;
    const badgeY = y - halfAvatar + 5;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 10, 0, Math.PI * 2);
    ctx.fillStyle = player.state === 'DRUNK' ? '#f39c12' : '#8e44ad';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = PALETTE.TEXT_WHITE;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(player.state === 'DRUNK' ? 'D' : 'P', badgeX, badgeY);
  }

  // ── Numéro de siège ──
  const seatBadgeX = x - halfAvatar + 5;
  const seatBadgeY = y - halfAvatar + 5;
  ctx.beginPath();
  ctx.arc(seatBadgeX, seatBadgeY, 10, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fill();
  ctx.fillStyle = PALETTE.TEXT_WHITE;
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${player.seatOrder + 1}`, seatBadgeX, seatBadgeY);

  // ── Nom du joueur ──
  const nameY = y + halfAvatar + AVATAR_BORDER + 16;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = player.isAlive ? PALETTE.TEXT_WHITE : PALETTE.TEXT_DEAD;
  ctx.font = `bold 13px sans-serif`;

  // Tronquer le nom si trop long
  const maxNameWidth = 90;
  let displayName = player.displayName;
  if (ctx.measureText(displayName).width > maxNameWidth) {
    while (ctx.measureText(displayName + '…').width > maxNameWidth && displayName.length > 0) {
      displayName = displayName.slice(0, -1);
    }
    displayName += '…';
  }
  ctx.fillText(displayName, x, nameY);

  // ── Rôle (MJ view) ──
  if (options.showRoles && role) {
    const roleY = nameY + 16;
    const roleColor = ROLE_COLORS[role.type] ?? PALETTE.TEXT_GREY;
    ctx.fillStyle = player.isAlive ? roleColor : PALETTE.TEXT_DEAD;
    ctx.font = '11px sans-serif';

    let roleName = role.name;
    if (ctx.measureText(roleName).width > maxNameWidth) {
      while (ctx.measureText(roleName + '…').width > maxNameWidth && roleName.length > 0) {
        roleName = roleName.slice(0, -1);
      }
      roleName += '…';
    }
    ctx.fillText(roleName, x, roleY);
  }
}

/** Légende en bas de l'image */
function drawLegend(ctx: SKRSContext2D, options: GrimoireOptions): void {
  const y = CANVAS_SIZE - 25;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '12px sans-serif';
  ctx.fillStyle = PALETTE.TEXT_GREY;

  let legend = '🟢 Vivant  ⚫ Mort';
  if (options.showRoles) {
    legend += `  |  Bleu=Citadin  Violet=Étranger  Rouge=Sbire/Démon`;
  }
  if (options.showAlignments) {
    legend += '  |  Halo rouge=Maléfique';
  }

  ctx.fillText(legend, CENTER_X, y);
}
