import { REST, Routes } from 'discord.js';
import config from './config/env';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// ============================================================
// Script de déploiement des Slash Commands sur Discord
// Usage : npm run deploy-commands
// ============================================================

async function deployCommands(): Promise<void> {
  const commands: object[] = [];
  const commandsPath = path.join(__dirname, 'commands');

  if (!fs.existsSync(commandsPath)) {
    console.error('❌ Dossier commands/ introuvable.');
    process.exit(1);
  }

  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

  for (const file of commandFiles) {
    const command = await import(pathToFileURL(path.join(commandsPath, file)).href);
    if ('data' in command) {
      commands.push(command.data.toJSON());
      console.log(`  📦 Commande trouvée : /${command.data.name}`);
    }
  }

  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);

  try {
    console.log(`\n🔄 Déploiement de ${commands.length} commande(s)...`);

    // Déploiement sur un serveur spécifique (plus rapide pour le dev)
    await rest.put(
      Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID),
      { body: commands }
    );

    console.log('✅ Commandes déployées avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors du déploiement:', error);
    process.exit(1);
  }
}

deployCommands();
