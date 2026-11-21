import { fileURLToPath } from 'node:url';
import { installNetguard } from './netguard.js';
import { startHttpServer, createApp } from './app.js';
import { assertBindAllowed, bindHost, resolvePort } from './safety.js';
import { modeFrom, realAvailableFrom } from './config.js';

installNetguard(); // before anything else can open a socket

try { process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url))); } catch { /* no .env */ }

console.log(`[ciba-approval-sequence-lab] starting in ${modeFrom()} mode`);
const host = assertBindAllowed(bindHost(), process.env);
const { url } = await startHttpServer({ port: resolvePort(), host, app: await createApp() });
console.log(`[ciba-approval-sequence-lab] lab at ${url} (loopback${realAvailableFrom() ? ', Real configured' : ', Mock only — no outbound network'})`);
console.log(`[ciba-approval-sequence-lab] health: ${url}api/health`);
