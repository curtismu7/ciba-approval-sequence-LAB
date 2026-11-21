// Writes docs/talk-track.md from the talk-track data (so the doc and the web talk-track view cannot drift).
// The {{cast}} tokens are filled with the default vertical's cast (rule 10); the doc shows the filled text.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { TALK } = await import(`file://${path.join(ROOT, 'web/src/talkTrack.js')}`);
const { loadCast, fillDeep, unfilled } = await import(`file://${path.join(ROOT, 'server/src/cast.js')}`);

const cast = loadCast(null); // the default vertical; a customer.config override would drift the doc from the pack
const holes = TALK.flatMap((t) => unfilled(t.say, cast));
if (holes.length) { console.error(`unfilled {{cast}} tokens: ${[...new Set(holes)].join(', ')}`); process.exit(1); }

const md = [
  '# Talk track',
  '',
  '<!-- Generated from web/src/talkTrack.js by `npm run talk-track`. Do not edit by hand. -->',
  '',
  ...fillDeep(TALK, cast).flatMap((t) => [`## ${t.title}`, '', t.say, '']),
].join('\n');

fs.writeFileSync(path.join(ROOT, 'docs/talk-track.md'), md);
console.log('wrote docs/talk-track.md');
