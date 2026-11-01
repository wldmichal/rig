import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const GOOD = '2026-10-29';
const EMPTY = '2026-10-30';
const MISSING = '2026-10-31';

// Two jobs in file order lane/sync first, so the sort by job is visible; one truncated line.
const goodLines = [
  '{"at":"2026-10-29T01:30:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
  '{"at":"2026-10-29T01:31:00+01:00","job":"digest/render","status":"retry","owner":null,"error":"timeout"}',
  '{"at":"2026-10-29T01:32:00+01:00","job":"lane/sync","sta',
  '{"at":"2026-10-29T01:33:00+01:00","job":"digest/render","status":"ok","owner":null}',
  '{"at":"2026-10-29T01:34:00+01:00","job":"lane/sync","status":"fail","owner":"rook","error":"upstream 503"}',
];

const config = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: '',
};

let runsDir = '';

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  writeFileSync(join(runsDir, `${GOOD}.jsonl`), goodLines.join('\n') + '\n');
  writeFileSync(join(runsDir, `${EMPTY}.jsonl`), '');
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

const app = () => createApp({ ...config, runsDir });

// Position of each job's first table cell, so page order can be compared with JSON order.
function pageJobOrder(html: string, jobs: string[]): string[] {
  return jobs
    .map((job) => ({ job, at: html.indexOf(`<td>${job}</td>`) }))
    .sort((a, b) => a.at - b.at)
    .map((x) => x.job);
}

describe('GET /digest/:night', () => {
  it('200 for a night with rows: each job, and the bad-line note', async () => {
    const res = await app().request(`/digest/${GOOD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest · 2026-10-29');
    expect(html).toContain('<td>digest/render</td>');
    expect(html).toContain('<td>lane/sync</td>');
    expect(html).toContain('1 line didn&#39;t parse');
  });

  it('404 for a night with no file', async () => {
    const res = await app().request(`/digest/${MISSING}`);
    expect(res.status).toBe(404);
  });

  it('200 "nothing ran" for an empty night file', async () => {
    const res = await app().request(`/digest/${EMPTY}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('didn&#39;t parse');
  });
});

describe('GET /api/digest/:night', () => {
  it('200 with rows in job order and badLines 1 for the good night', async () => {
    const res = await app().request(`/api/digest/${GOOD}`);
    expect(res.status).toBe(200);
    const night = (await res.json()) as Night;
    expect(night.night).toBe(GOOD);
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual(['digest/render', 'lane/sync']);
    expect(night.rows.find((r) => r.job === 'lane/sync')).toMatchObject({
      runs: 2,
      lastStatus: 'fail',
      lastError: 'upstream 503',
    });
  });

  it('404 for a night with no file', async () => {
    const res = await app().request(`/api/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('200 with rows [] and badLines 0 for the empty night', async () => {
    const res = await app().request(`/api/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: EMPTY, rows: [], badLines: 0 });
  });
});

describe('page and JSON agree', () => {
  it('list the jobs in the same order for the good night', async () => {
    const html = await (await app().request(`/digest/${GOOD}`)).text();
    const night = (await (await app().request(`/api/digest/${GOOD}`)).json()) as Night;
    const jobs = night.rows.map((r) => r.job);
    expect(pageJobOrder(html, jobs)).toEqual(jobs);
  });
});
