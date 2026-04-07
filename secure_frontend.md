# Secure Frontend Implementation Plan

## Context
The frontend of zero-day-atlas is a Next.js/React app. A review against the frontend secure coding skills.md found two concrete issues and one structural gap:

1. **`javascript:` URL injection (XSS)** — `jiraLink`, `githubLink`, `agileplacLink`, and `externalLink` are user-entered strings stored in the DB and rendered as `href` values without URL scheme validation. A user could store `javascript:alert(document.cookie)` and have it execute when clicked.

2. **Missing JS frame-busting logic** — The skills.md requires a JavaScript `if (top !== self)` guard in addition to the `X-Frame-Options: DENY` header (already added in next.config.ts) for defence-in-depth.

3. **Redirects, output handling, CSS** — All `router.push` calls use hardcoded paths (no user input). No `dangerouslySetInnerHTML` or raw DOM manipulation. All dynamic styles come from predefined constant maps. These are already compliant.

---

## Changes

### 1. New `lib/url.ts` — URL scheme validator

Export `isSafeUrl(url: string): boolean` using the built-in `URL` constructor — returns `true` only for `https:` or `http:` protocols. Everything else (`javascript:`, `data:`, `vbscript:`, malformed) returns `false`.

### 2. `app/tasks/[id]/page.tsx` — Validate link URLs before rendering

**Lines 428–448** — `jiraLink`, `githubLink`, `agileplacLink` rendered as `<a href={task.jiraLink}>` etc. without scheme validation.

**Change:** Wrap each condition with `isSafeUrl()`:
- `{task.jiraLink && isSafeUrl(task.jiraLink) && <a href={task.jiraLink} ...>}`
- `{task.githubLink && isSafeUrl(task.githubLink) && <a href={task.githubLink} ...>}`
- `{task.agileplacLink && isSafeUrl(task.agileplacLink) && <a href={task.agileplacLink} ...>}`

### 3. `app/impact-assessment/[id]/page.tsx` — Validate externalLink URL

**Line 603** — `externalLink` rendered as `<a href={externalLink}>` without scheme check.

**Change:** `{isReadOnly && externalLink && isSafeUrl(externalLink) ? <a href={externalLink} ...> : ...}`

### 4. New `app/components/FrameBuster.tsx` — JS frame-busting guard

`'use client'` component with a `useEffect` that runs:
```ts
if (window.top !== window.self) {
  window.top!.location.href = window.location.href;
}
```
Defence-in-depth alongside the `frame-ancestors 'none'` CSP header already in `next.config.ts`.

### 5. `app/layout.tsx` — Mount FrameBuster globally

Add `<FrameBuster />` inside `<body>` so the guard runs on every page.

---

## Files
| Action | File |
|--------|------|
| Create | `lib/url.ts` |
| Modify | `app/tasks/[id]/page.tsx` |
| Modify | `app/impact-assessment/[id]/page.tsx` |
| Create | `app/components/FrameBuster.tsx` |
| Modify | `app/layout.tsx` |

## No New Dependencies
All changes use built-in browser APIs (`URL` constructor, `window.top`).

---

## Verification
1. **`javascript:` URL blocked** — Save `javascript:alert(1)` as a Jira link — link should not render (no clickable anchor).
2. **Valid URL passes** — Enter `https://github.com/org/repo` — renders and opens correctly.
3. **Frame-busting** — Load app inside an iframe — browser breaks out immediately.
4. **externalLink validation** — Save `javascript:void(0)` as external reference link — hidden in read-only view.
