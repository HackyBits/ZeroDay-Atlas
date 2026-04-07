# Secure Backend Implementation Plan

## Context
zero-day-atlas has a single real API route (`/api/notify-slack`) and two supporting files (`next.config.ts`, `lib/instant.ts`). Review against secure coding practices revealed: no input validation, no security headers, hardcoded secrets fallback in source, and error responses leaking internal details.

---

## Changes

### 1. `app/api/notify-slack/route.ts` — Input Validation, Rate Limiting, Error Handling, External Request Safety

**Problems addressed (per skills.md):**
- No validation: body is cast directly to `VulnPayload` without checking types/lengths → violates "Validate and sanitize all user inputs"
- Error handling leaks Slack API response text to the client → violates "Handle errors securely without revealing sensitive details"
- No rate limiting → violates "Apply rate limiting to manage traffic"
- No timeout on outbound Slack webhook request → violates "Implement request timeouts" under External Requests
- `String(err)` in catch may leak stack traces/URLs → violates "Use error handling without revealing sensitive information"

**Changes:**
- Add a runtime validator checking required fields, string types, length limits (title ≤ 200 chars, description ≤ 2000 chars), and allowed enum values for `severity` (`Critical | High | Medium | Low`) and `riskScore` (0–100)
- Return `400` with a generic validation message for invalid payloads; log field-level details server-side only
- Add simple in-memory IP-based rate limiter (10 req/min per IP) using `Map<string, { count, resetAt }>`; return `429` when exceeded
- Add `AbortController` with 10-second timeout on the `fetch(webhookUrl, ...)` call
- Replace `NextResponse.json({ ok: false, error: text })` (line 98) with generic `"Notification service error"` — log the real Slack response with `console.error` server-side only
- Replace `String(err)` in catch (line 102) with `"Unexpected error"` to prevent leaking internals

### 2. `next.config.ts` — Security Headers

**Problems addressed (per skills.md):**
- No Content Security Policy → violates "Use a Content Security Policy (CSP) to protect against XSS and clickjacking"
- No X-Frame-Options, HSTS, content-type sniffing protection → violates "Enforce security headers"

**Changes:**
- Add `async headers()` export with rule matching `/:path*` that sets:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://*.instantdb.com wss://*.instantdb.com; frame-ancestors 'none'`

### 3. `lib/instant.ts` — Remove Hardcoded Fallback AppID

**Problems addressed (per skills.md):**
- `|| 'ae4ae7dd-...'` fallback → violates "Do not hardcode any secrets (credentials, API keys, etc) in the source code"

**Change:**
- Remove the `|| 'hardcoded-id'` fallback; add a startup assertion that throws a descriptive `Error` if `NEXT_PUBLIC_INSTANT_APP_ID` is not set, so misconfiguration fails fast instead of silently using an embedded ID

---

## Files to Modify
- `app/api/notify-slack/route.ts`
- `next.config.ts`
- `lib/instant.ts`

## No New Dependencies
All changes use native Next.js APIs, built-in `AbortController`, and a plain `Map` for rate limiting.

---

## Verification
1. **Input validation**: POST to `/api/notify-slack` with missing/invalid fields → expect `400`
2. **Rate limiting**: Send >10 requests in 1 minute from same IP → expect `429`
3. **Timeout**: Point `SLACK_WEBHOOK_URL` to a slow/non-responding endpoint → request aborts after 10s
4. **Security headers**: `curl -I http://localhost:3000` → response includes `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`
5. **Error leakage**: Trigger a Slack webhook error → client receives generic message, real error in server logs only
6. **Hardcoded AppID**: Remove `NEXT_PUBLIC_INSTANT_APP_ID` from `.env.local` → app throws on startup with clear message
