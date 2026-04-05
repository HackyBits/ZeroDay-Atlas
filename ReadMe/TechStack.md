# Zero-Day Atlas — Tech Stack

---

## Frontend

| Technology | Purpose |
|------------|---------|
| [React](https://react.dev) | Component-based UI library |
| [Next.js](https://nextjs.org) | React framework (routing, SSR, API routes) |
| [TypeScript](https://www.typescriptlang.org) | Type-safe JavaScript |
| [Tailwind CSS](https://tailwindcss.com) | Utility-first styling |

---

## Backend & Authentication

| Technology | Purpose |
|------------|---------|
| [InstantDB](https://www.instantdb.com) | Realtime database, auth, and backend-as-a-service |

---

## Deployment

| Technology | Purpose |
|------------|---------|
| [Vercel](https://vercel.com) | Hosting, CI/CD, and edge deployment for Next.js |

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│              Frontend                   │
│   React + Next.js + TypeScript          │
│   Tailwind CSS (styling)                │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│         Backend & Auth                  │
│   InstantDB                             │
│   (Realtime DB + Authentication)        │
└─────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│           Deployment                    │
│   Vercel                                │
└─────────────────────────────────────────┘
```
