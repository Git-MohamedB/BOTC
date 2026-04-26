import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  Events,
} from 'discord.js';
import config from './config/env';
import prisma from './database/prisma';
import { loadCommands, loadEvents } from './utils/loaders';
import type { BotCommand } from './types/command';

// ============================================================
// Client Discord avec les intents nécessaires
// ============================================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Channel, // Nécessaire pour recevoir les MP
    Partials.Message,
  ],
});

// Collection pour stocker les commandes slash
client.commands = new Collection<string, BotCommand>();

// ============================================================
// Initialisation
// ============================================================
async function main() {
  console.log('🔮 Blood on the Clocktower Bot - Démarrage...');

  // 1. Vérifier la connexion à la base de données
  try {
    await prisma.$connect();
    console.log('✅ Base de données SQLite connectée');
  } catch (error) {
    console.error('❌ Impossible de se connecter à la base de données:', error);
    process.exit(1);
  }

  // 2. Charger les commandes et événements
  await loadCommands(client);
  await loadEvents(client);

  // 3. Se connecter à Discord
  await client.login(config.DISCORD_TOKEN);
}

// ============================================================
// Gestion propre de l'arrêt (Graceful Shutdown)
// ============================================================
async function shutdown(signal: string) {
  console.log(`\n🛑 Signal ${signal} reçu. Arrêt en cours...`);
  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Catch unhandled errors pour éviter les crashs silencieux
process.on('unhandledRejection', (error: Error) => {
  console.error('❌ Unhandled Rejection:', error);
});

process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', error);
  // On laisse le process crash pour être redémarré proprement
  process.exit(1);
});

// Lancer le bot
main().catch((error) => {
  console.error('❌ Erreur fatale au démarrage:', error);
  process.exit(1);
});
