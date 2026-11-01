// Plan morning-digest § 1. Types only: every part of § 2 starts against this file.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job in the night.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number; // lines for this job
  retries: number; // lines with status 'retry'
  lastStatus: RunStatus;
  lastError: string | null; // last error seen for the job, even if a later line was ok
  firstAt: string; // as in the log, offset kept, never UTC
  lastAt: string;
};

// A night that has a file. An empty file gives rows: [] ("nothing ran").
export type Night = {
  night: string;
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that don't parse as a RunLine: counted, never thrown
};

// null = no runs/<night>.jsonl (the page answers 404).
// Implemented in src/digest/read.ts as `export const readNight: ReadNight = ...`.
export type ReadNight = (runsDir: string, night: string) => Night | null;
