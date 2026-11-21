// The {{cast}} fill for the web, mirroring server/src/cast.js (a plain copy: the web must not import
// the server's Node module). Only fill/fillDeep are needed here.
const TOKEN = /\{\{(\w+)\}\}/g;

export const fill = (text, cast) => String(text).replace(TOKEN, (m, k) => (Object.hasOwn(cast, k) ? cast[k] : m));
export function fillDeep(value, cast) {
  if (typeof value === "string") return fill(value, cast);
  if (Array.isArray(value)) return value.map((v) => fillDeep(v, cast));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => fillDeep(v, cast)));
  return value;
}
