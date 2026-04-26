import { Client, Collection } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { BotCommand } from '../types/command';

// ============================================================
// Chargeur dynamique de commandes et d'événements
// ============================================================

/**
 * Charge toutes les commandes depuis le dossier src/commands/
 * Structure attendue : src/commands/<nom>.ts exporte { data, execute }
 */
export async function loadCommands(client: Client): Promise<void> {
  const commandsPath = path.join(__dirname, '..', 'commands');

  if (!fs.existsSync(commandsPath)) {
    console.warn('⚠️  Dossier commands/ introuvable. Aucune commande chargée.');
    return;
  }

  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const command: BotCommand = await import(pathToFileURL(filePath).href);

      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`  📦 Commande chargée : /${command.data.name}`);
      } else {
        console.warn(`  ⚠️  ${file} : manque "data" ou "execute".`);
      }
    } catch (error) {
      console.error(`  ❌ Erreur au chargement de ${file}:`, error);
    }
  }

  console.log(`✅ ${client.commands.size} commande(s) chargée(s)`);
}

/**
 * Charge tous les événements depuis le dossier src/events/
 * Structure attendue : src/events/<nom>.ts exporte { name, once?, execute }
 */
export async function loadEvents(client: Client): Promise<void> {
  const eventsPath = path.join(__dirname, '..', 'events');

  if (!fs.existsSync(eventsPath)) {
    console.warn('⚠️  Dossier events/ introuvable. Aucun événement chargé.');
    return;
  }

  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

  let count = 0;

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
      const event = await import(pathToFileURL(filePath).href);

      if (!event.name) {
        console.warn(`  ⚠️  ${file} : propriété "name" manquante.`);
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args: unknown[]) => event.execute(...args));
      } else {
        client.on(event.name, (...args: unknown[]) => event.execute(...args));
      }

      console.log(`  🔔 Événement chargé : ${event.name} ${event.once ? '(once)' : ''}`);
      count++;
    } catch (error) {
      console.error(`  ❌ Erreur au chargement de ${file}:`, error);
    }
  }

  console.log(`✅ ${count} événement(s) chargé(s)`);
}
