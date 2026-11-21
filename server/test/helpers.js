import http from 'node:http';
import { createApp, startHttpServer } from '../src/app.js';
import { createHealth } from '../src/health.js';

export async function withServer(fn, { env } = {}) {
  const health = createHealth();
  const { server, url } = await startHttpServer({ port: 0, host: '127.0.0.1', app: await createApp({ health, ...(env ? { env } : {}) }) });
  try { await fn(url.replace(/\/$/, '')); } finally { health.stop(); await new Promise((r) => server.close(r)); }
}

// fetch cannot set Host; node:http can. `path` is the request path override ("/api/..." form).
export function rawHttp(url, { method = 'GET', path: reqPath, headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const path2 = reqPath || u.pathname + u.search;
    const req = http.request({ host: u.hostname, port: u.port, path: path2, method, headers, agent: false }, (res) => {
      let data = ''; res.on('data', (c) => { data += c; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: data }));
    });
    req.on('error', reject); if (body) req.write(body); req.end();
  });
}

export const postJson = (url, path, body, headers = {}) => rawHttp(url, {
  method: 'POST', path, headers: { 'content-type': 'application/json', origin: url, ...headers }, body: JSON.stringify(body),
});
