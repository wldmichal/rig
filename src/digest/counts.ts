import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRunLine } from './read.js';
import type { RunStatus } from './types.js';

export type NightCounts = Record<RunStatus, number>;

// Log lines per status in runs/<night>.jsonl. Lines that don't parse are not counted.
// null = the file can't be read (the board shows —).
export function countNight(runsDir: string, night: string): NightCounts | null {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseRunLine(raw);
    if (line !== null) counts[line.status]++;
  }
  return counts;
}
