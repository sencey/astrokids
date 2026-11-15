// Minimal ambient typing so tests can read the real terrain files (no @types/node in this project).
declare module 'node:fs' {
  export function readFileSync(path: URL | string): Uint8Array;
}
