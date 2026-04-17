import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

const DATA_DIR = path.join(os.homedir(), '.claude', 'data', 'claude-for-movies');

export const paths = {
  dataDir: DATA_DIR,
  config: path.join(DATA_DIR, 'config.json'),
  preferences: path.join(DATA_DIR, 'preferences.json'),
  watched: path.join(DATA_DIR, 'watched.json'),
  watchlist: path.join(DATA_DIR, 'watchlist.json')
};

export async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}
