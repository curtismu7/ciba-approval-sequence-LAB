// Mock/Real toggle (rule 19). Real mode is owner-configured via the .env beside the compose
// file; this lab is data-only in step 1, so Real mode is a contract that exists but is not
// wired to servers yet. When the required vars are absent, POST /api/mode answers 409.

export const REAL_MODE_VARS = ['REAL_CIBA_ENV_ID', 'REAL_CIBA_CLIENT_ID', 'REAL_CIBA_CLIENT_SECRET'];

// Which real configuration exists (never the values — only whether they are present).
export function realAvailableFrom(env = process.env) {
  return REAL_MODE_VARS.every((k) => Boolean(env[k]));
}

// Default: Real if configured, else Mock.
export function modeFrom(env = process.env) {
  return realAvailableFrom(env) ? 'real' : 'mock';
}
