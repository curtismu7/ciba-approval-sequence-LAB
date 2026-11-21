// Runtime netguard: zero real outbound. Every non-loopback socket, DNS lookup, fetch and UDP send is refused and recorded.
// This lab is data-only in step 1, so nothing in it has a reason to leave the machine.
import dns from 'node:dns';
import net from 'node:net';
import dgram from 'node:dgram';
import { isLoopbackHost } from './safety.js';

let active = null;

export function installNetguard() {
  if (active) return active;
  const attempts = [];
  const real = {
    connect: net.Socket.prototype.connect, lookup: dns.lookup, fetch: globalThis.fetch, send: dgram.Socket.prototype.send,
    plookup: dns.promises.lookup,
  };
  const RESOLVERS = ['resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCaa', 'resolveCname', 'resolveMx', 'resolveNaptr', 'resolveNs', 'resolvePtr', 'resolveSoa', 'resolveSrv', 'resolveTxt', 'reverse'];
  const savedResolvers = [];
  const blockedResolver = (label, name, target) => function guardedResolve(host, ...rest) {
    const h = String(host);
    if (isLoopbackHost(h)) return target.apply(this, [host, ...rest]);
    attempts.push(`dns:${h}`);
    const err = new Error(`network blocked: ${h}`);
    const cb = rest.find((r) => typeof r === 'function');
    if (label === 'cb') { if (cb) return cb(err); throw err; }
    return Promise.reject(err);
  };
  for (const [label, holder] of [['cb', dns], ['promise', dns.promises], ['cb', dns.Resolver.prototype], ['promise', dns.promises.Resolver.prototype]]) {
    for (const name of RESOLVERS) {
      if (typeof holder[name] !== 'function') continue;
      const orig = holder[name];
      savedResolvers.push([holder, name, orig]);
      holder[name] = blockedResolver(label, name, orig);
    }
  }
  const hostOf = (rawArgs) => {
    const args = Array.isArray(rawArgs[0]) ? rawArgs[0] : rawArgs;
    const a = args[0];
    if (a && typeof a === 'object' && !Array.isArray(a)) return a.path ? 'unix-socket' : (a.host || 'localhost');
    if (typeof a === 'string' && Number.isNaN(Number(a))) return 'unix-socket';
    return typeof args[1] === 'string' ? args[1] : 'localhost';
  };
  net.Socket.prototype.connect = function guardedConnect(...args) {
    const host = hostOf(args);
    if (!isLoopbackHost(host)) { attempts.push(`socket:${host}`); throw new Error(`network blocked: ${host}`); }
    return real.connect.apply(this, args);
  };
  dns.lookup = function guardedLookup(host, ...rest) {
    if (!isLoopbackHost(host) && host !== '0.0.0.0' && host !== '::') {
      attempts.push(`dns:${host}`);
      const cb = rest.find((r) => typeof r === 'function');
      return cb?.(new Error(`network blocked: ${host}`));
    }
    return real.lookup.call(dns, host, ...rest);
  };
  dns.promises.lookup = async function guardedPromiseLookup(host, ...rest) {
    if (!isLoopbackHost(host) && host !== '0.0.0.0' && host !== '::') { attempts.push(`dns:${host}`); throw new Error(`network blocked: ${host}`); }
    return real.plookup.call(dns.promises, host, ...rest);
  };
  globalThis.fetch = async function guardedFetch(input, init) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (!isLoopbackHost(url.hostname)) { attempts.push(`fetch:${url.hostname}`); throw new Error(`network blocked: ${url.hostname}`); }
    return real.fetch(input, init);
  };
  dgram.Socket.prototype.send = function guardedSend(...args) {
    const rest = args.slice(1);
    const addr = typeof rest[1] === 'number' ? rest[3] : rest[1];
    const ok = addr === undefined || typeof addr === 'function' || (typeof addr === 'string' && isLoopbackHost(addr));
    if (!ok) { attempts.push(`udp:${addr}`); throw new Error(`network blocked: ${addr}`); }
    return real.send.apply(this, args);
  };
  active = {
    attempts,
    restore() {
      for (const [holder, name, orig] of savedResolvers) holder[name] = orig;
      dns.promises.lookup = real.plookup;
      net.Socket.prototype.connect = real.connect; dns.lookup = real.lookup; globalThis.fetch = real.fetch; dgram.Socket.prototype.send = real.send;
      active = null;
    },
  };
  return active;
}
