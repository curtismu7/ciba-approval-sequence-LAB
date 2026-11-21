// W3C traceparent helper (rule 14). Step 1 has no multi-hop calls yet, so nothing issues a
// traceparent; the envelope util is kept ready for when hops exist.
import { randomUUID } from 'node:crypto';

const TRACEPARENT = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export function newTrace(incoming) {
  const m = TRACEPARENT.exec(String(incoming || ''));
  const traceId = m ? m[2] : randomUUID().replaceAll('-', '');
  const spanId = randomUUID().replaceAll('-', '').slice(0, 16);
  return { traceId, spanId, traceparent: `00-${traceId}-${spanId}-01` };
}
