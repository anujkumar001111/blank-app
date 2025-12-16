# Benchmarks - 0001-system-tools

## Setup
- Node `v24.10.0`, branch `0001-system-tools`, deps via `pnpm install`.
- Ran ad-hoc Node benchmarks from `packages/eko-nodejs` to mirror the SystemAgent file tools:
  - Created temporary directories with 2k–15k files.
  - Measured shell exec (`child_process.exec`), directory listing (`fs.readdir` + `fs.stat`), and glob search (`glob` + `fs.stat`), matching the logic in `packages/eko-nodejs/src/tools/file-list.ts` and `packages/eko-nodejs/src/tools/file-find.ts`.

## Results
- 2k-file dataset:
  - `shell exec echo`: 55.5 ms
  - `file_list`: 43.4 ms
  - `file_find` first run: 52.0 ms, repeat: 40.3 ms
- 6k-file dataset:
  - `file_find`: 76.3 ms
- 15k-file dataset:
  - `file_find`: 266.6 ms
- Attempting a 10k-file run with unconstrained concurrent writes hit `EMFILE` (too many open files) before the benchmark could finish, highlighting descriptor pressure when many operations run in parallel.

## Slow/fragile spots and root cause
- `file_find` scales linearly with file count and performs an unbounded `Promise.all(fs.stat)` after `glob` expansion (`packages/eko-nodejs/src/tools/file-find.ts:72`). On large trees this leads to two issues:
  - Latency spikes (266 ms at 15k files; will grow proportionally).
  - File-descriptor pressure/`EMFILE` when the file set is large enough, because every match is stat'ed without a concurrency cap.
- `file_list` has the same unbounded `fs.stat` pattern (`packages/eko-nodejs/src/tools/file-list.ts:62`), so large directories will exhibit the same scaling/descriptor risk.

## Suggestions
- Limit parallel `fs.stat` calls (e.g., p-limit batches of 64–128) for both list and find, or reuse `Dirent.isDirectory()` to skip stat unless size/mtime is needed.
- Consider a fast path that omits `toLocaleString()` formatting and full stat when callers only need names/paths; that removes per-file locale work in large listings.
