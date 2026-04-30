import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

const DATA_DIR = path.join(os.homedir(), '.claude', 'data', 'movies-for-ai-agents');
const LEGACY_DATA_DIR = path.join(os.homedir(), '.claude', 'data', 'claude-for-movies');

export const paths = {
  dataDir: DATA_DIR,
  config: path.join(DATA_DIR, 'config.json'),
  preferences: path.join(DATA_DIR, 'preferences.json'),
  watched: path.join(DATA_DIR, 'watched.json'),
  watchlist: path.join(DATA_DIR, 'watchlist.json'),
  lists: path.join(DATA_DIR, 'lists.json'),
  active: path.join(DATA_DIR, 'active.json'),
  imdbCache: path.join(DATA_DIR, 'imdb-cache.json'),
  interestsCache: path.join(DATA_DIR, 'imdb-interests.json')
};

let migrationAttempted = false;

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDataDir() {
  if (!migrationAttempted) {
    migrationAttempted = true;
    const newExists = await exists(DATA_DIR);
    const legacyExists = await exists(LEGACY_DATA_DIR);
    if (!newExists && legacyExists) {
      try {
        await fs.mkdir(path.dirname(DATA_DIR), { recursive: true });
        await fs.rename(LEGACY_DATA_DIR, DATA_DIR);
        process.stderr.write(`[movies-for-ai-agents] migrated state from ~/.claude/data/claude-for-movies/\n`);
        return;
      } catch (err) {
        process.stderr.write(`[movies-for-ai-agents] state migration skipped (${err.message}); using fresh ${DATA_DIR}\n`);
      }
    }
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
}
