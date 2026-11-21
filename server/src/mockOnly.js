// MOCK_ONLY=1 (or true), or MODE=mock: hosted-mock mode (STANDALONE-RULES section 6).
// The server pins the mode to mock and refuses every non-read /api request in one place.
export const isMockOnly = (env = process.env) => (
  ['1', 'true'].includes(String(env.MOCK_ONLY || '').trim().toLowerCase())
  || String(env.MODE || '').trim().toLowerCase() === 'mock'
);
export const MOCK_REFUSAL = { error: 'mock_only', message: 'Disabled in the hosted mock.' };

export function mockGuard(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  return res.status(403).json(MOCK_REFUSAL);
}
