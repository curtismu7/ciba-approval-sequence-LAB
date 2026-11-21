// Rule 13: a workspace id keeps one visitor's state apart from another's. Step 1 is data-only,
// so the workspace is just the id contract (default: "default"); per-visitor state arrives with
// later steps.
export const WORKSPACE_RE = /^[a-z0-9-]{1,40}$/;
export const DEFAULT_WORKSPACE = 'default';

export function workspaceFrom(req) {
  const raw = req.headers['x-workspace'];
  if (raw === undefined) return DEFAULT_WORKSPACE;
  return typeof raw === 'string' && WORKSPACE_RE.test(raw) ? raw : null;
}
