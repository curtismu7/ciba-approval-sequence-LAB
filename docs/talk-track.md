# Talk track

<!-- Generated from web/src/talkTrack.js by `npm run talk-track`. Do not edit by hand. -->

## The one-line version

A person asks payments-agent, Fabrikam Bank's AI agent, to book a flight. Writing the booking is a sensitive action, so the policy engine holds it and demands an out-of-band approval: the CIBA flow. The person approves on another device, the agent replays the same call with the approval, and the booking goes through.

## Three phases

Phase 1 is the search: every hop narrows the token as it goes down. Phase 2 is the held write: a 401 auth_challenge starts CIBA, the backchannel request returns an auth_req_id, and the gateway polls while the person decides. Phase 3 is the replay: the same call, now with an approved grant, PERMIT, and a confirmed booking.

## Watch the tokens, not the arrows

Each hop either keeps the user's token, exchanges it for a narrower one (RFC 8693), or mints a gateway-bound one. Click any message: the pane shows the exact wire form and the decoded claims, and the audience claim tells you who is allowed to accept each token.

## Why out-of-band

A push approval on a second device is stronger than anything in-channel: the approving session is not the session that could be prompt-injected. The binding message ties the approval to this one booking (BK-XXXX), so a stolen approval approves nothing else.

## The poll loop

The gateway holds the agent's call open and polls the authorization server every two seconds: authorization_pending means keep waiting, slow_down means back off, and a final deny or expiry ends the held call with a clear error payments-agent can explain. The model never approves; it only reports the outcome.
