import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Validation stricte des variables d'environnement au démarrage
const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN est requis'),
  CLIENT_ID: z.string().min(1, 'CLIENT_ID est requis'),
  GUILD_ID: z.string().min(1, 'GUILD_ID est requis'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requis'),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variables d\'environnement invalides :');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export default config;
