import fs from 'node:fs/promises';
import { paths, ensureDataDir } from './paths.js';

export async function getConfig() {
  try {
    return JSON.parse(await fs.readFile(paths.config, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

export async function setConfig(patch) {
  await ensureDataDir();
  const next = { ...(await getConfig()), ...patch };
  await fs.writeFile(paths.config, JSON.stringify(next, null, 2) + '\n', 'utf8');
  try { await fs.chmod(paths.config, 0o600); } catch {}
  return next;
}

export async function getApiKey() {
  if (process.env.TMDB_API_KEY) return process.env.TMDB_API_KEY;
  const config = await getConfig();
  return config.tmdbApiKey || null;
}
