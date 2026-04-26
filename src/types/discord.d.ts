import { Collection } from 'discord.js';
import type { BotCommand } from './command';

// Étendre le type Client de Discord.js pour ajouter la collection de commandes
declare module 'discord.js' {
  interface Client {
    commands: Collection<string, BotCommand>;
  }
}
