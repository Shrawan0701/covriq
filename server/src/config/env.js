import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Search potential .env locations in order (server folder, parent root, cwd)
const candidatePaths = [
  path.resolve(__dirname, '../../.env'), // c:\Users\...\CovrIQ\server\.env
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), 'server/.env'),
  path.resolve(process.cwd(), '.env')
];

let loadedPath = null;
for (const envPath of candidatePaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    loadedPath = envPath;
    break;
  }
}

if (!loadedPath) {
  dotenv.config();
}

/**
 * Returns true if SERPAPI_API_KEY is properly configured with a valid non-empty string.
 * Never logs or exposes the actual key value.
 */
export function isSerpApiConfigured() {
  const key = process.env.SERPAPI_API_KEY;
  return Boolean(key && typeof key === 'string' && key.trim().length > 5);
}

/**
 * Safely gets the SerpApi API key string.
 */
export function getSerpApiKey() {
  const key = process.env.SERPAPI_API_KEY;
  if (!key || typeof key !== 'string') return '';
  return key.trim();
}

export default {
  isSerpApiConfigured,
  getSerpApiKey
};
