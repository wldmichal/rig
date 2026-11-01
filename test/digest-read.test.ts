import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const tempDirs: string[] = [];

function tempRuns(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  tempDirs.push(dir);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('gives 5 jobs sorted by job and counts the 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.night).toBe('2026-10-28');
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('keeps the last error after a later ok, and the log offsets', () => {
    const row = night?.rows.find((r) => r.job === 'fixtures/refresh');
    expect(row).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('marks a failed job and keeps a row with no owner', () => {
    expect(night?.rows.find((r) => r.job === 'notes/backup')?.lastStatus).toBe('fail');
    const render = night?.rows.find((r) => r.job === 'digest/render');
    expect(render).toBeDefined();
    expect(render?.owner).toBeNull();
  });
});

describe('readNight edge cases', () => {
  it('returns null when the night has no file', () => {
    expect(readNight(tempRuns(), '2026-10-30')).toBeNull();
  });

  it('gives no rows and no bad lines for an empty file', () => {
    const dir = tempRuns({ '2026-10-30.jsonl': '' });
    expect(readNight(dir, '2026-10-30')).toEqual({ night: '2026-10-30', rows: [], badLines: 0 });
  });

  it('skips blank lines and counts lines that are JSON but not a run line', () => {
    const lines = [
      '{"at":"2026-10-30T23:00:00+01:00","job":"a","status":"ok","owner":"x"}',
      '',
      '{"at":"2026-10-30T23:01:00+01:00","job":"a","status":"done","owner":"x"}',
      '{"at":"2026-10-30T23:02:00+01:00","job":"a","status":"ok"}',
      '{"at":"2026-10-30T23:03:00+01:00","job":"a","status":"ok","owner":7}',
      '{"job":"a","status":"ok","owner":"x"}',
      '[1,2]',
      'null',
      '',
    ];
    const dir = tempRuns({ '2026-10-30.jsonl': lines.join('\n') });
    const result = readNight(dir, '2026-10-30');
    expect(result?.badLines).toBe(6);
    expect(result?.rows).toHaveLength(1);
    expect(result?.rows[0]?.runs).toBe(1);
  });

  it('treats a night that is not YYYY-MM-DD as no file', () => {
    const dir = tempRuns({ '2026-10-30.jsonl': '' });
    expect(readNight(dir, '../2026-10-30')).toBeNull();
    expect(readNight(dir, '2026-10-30.jsonl')).toBeNull();
  });
});
