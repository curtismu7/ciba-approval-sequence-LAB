import { getJson } from "./safeFetch";

// Relative URLs on purpose (no leading slash): the app can be served under a path prefix
// (e.g. behind an ingress at /mock/ciba-approval-sequence/), so "api/x" resolves next to the page.
export const getDiagram = () => getJson("api/diagram");
export const getInfo = () => getJson("api/info");
export const getTalkTrack = () => getJson("api/talk-track");

// POST api/mode: the rule 19 Mock/Real toggle. 409 when Real is not configured, 403 in the hosted mock.
export async function setMode(source) {
  const r = await fetch("api/mode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source }) });
  let body = {};
  try { body = await r.json(); } catch { /* not JSON */ }
  return { ok: r.ok, status: r.status, body };
}

export const resetLab = () => fetch("api/reset", { method: "POST" }).then((r) => r.ok).catch(() => false);
