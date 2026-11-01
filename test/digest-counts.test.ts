import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { countNight } from '../src/digest/counts.js';

const line = (status: string) => JSON.stringify({ at: '2026-10-28T01:00:00+01:00', job: 'a', status, owner: null });

describe('countNight', () => {
  it('counts log lines by status and skips bad lines', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-counts-'));
    writeFileSync(join(dir, '2026-10-28.jsonl'), [line('ok'), line('ok'), line('retry'), 'nope', line('fail'), ''].join('\n'));
    expect(countNight(dir, '2026-10-28')).toEqual({ ok: 2, retry: 1, fail: 1 });
  });

  it('is null when the night has no file', () => {
    expect(countNight(mkdtempSync(join(tmpdir(), 'rig-counts-')), '2026-10-28')).toBeNull();
  });
});
