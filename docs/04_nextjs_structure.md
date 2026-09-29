# Next.js Project Structure — Single App, Phase 1

One Next.js (App Router) codebase covers Admin, Trading, POS-PWA, and
Distribution-PWA. POS and Distribution routes are marked as PWA-installable
(separate manifest + service worker scope) while Admin/Trading are plain
server-rendered pages with no offline requirement.

```
erp-app/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (admin)/                     -- no offline needed
│   │   ├── layout.tsx                -- sidebar nav, permission-gated menu
│   │   ├── companies/page.tsx
│   │   ├── branches/page.tsx
│   │   ├── warehouses/page.tsx
│   │   ├── coa/page.tsx              -- tree view, level-1..4
│   │   ├── fiscal-years/page.tsx
│   │   ├── users/page.tsx
│   │   ├── roles/
│   │   │   ├── page.tsx
│   │   │   └── [roleId]/permissions/page.tsx   -- permission matrix grid
│   │   ├── parties/page.tsx
│   │   ├── items/page.tsx
│   │   ├── tax-master/page.tsx
│   │   └── numbering-series/page.tsx
│   ├── (trading)/                   -- online only, office use
│   │   ├── layout.tsx
│   │   ├── sales/
│   │   │   ├── quotations/
│   │   │   ├── orders/
│   │   │   ├── invoices/
│   │   │   │   ├── page.tsx          -- list
│   │   │   │   ├── new/page.tsx      -- create/edit DRAFT
│   │   │   │   └── [invId]/page.tsx  -- view/post/cancel/print
│   │   │   └── returns/
│   │   ├── purchase/
│   │   │   ├── po/
│   │   │   ├── grn/
│   │   │   ├── invoices/
│   │   │   └── returns/
│   │   ├── stock/
│   │   │   ├── transfers/
│   │   │   ├── ledger/page.tsx       -- stock card report
│   │   │   └── on-hand/page.tsx
│   │   └── accounting/
│   │       ├── vouchers/
│   │       ├── trial-balance/page.tsx
│   │       └── party-ledger/page.tsx
│   ├── (pos)/                        -- PWA scope starts here
│   │   ├── layout.tsx                 -- registers pos service worker
│   │   ├── manifest.json
│   │   ├── terminal/
│   │   │   ├── shift-open/page.tsx
│   │   │   ├── sale/page.tsx          -- main POS screen (cart, tender)
│   │   │   ├── shift-close/page.tsx   -- Z-report
│   │   │   └── sync-status/page.tsx   -- shows queued offline txns
│   ├── (distribution)/               -- PWA scope starts here
│   │   ├── layout.tsx
│   │   ├── manifest.json
│   │   ├── salesman/
│   │   │   ├── routes/page.tsx
│   │   │   ├── order-booking/page.tsx
│   │   │   ├── delivery/page.tsx
│   │   │   ├── recovery/page.tsx
│   │   │   └── sync-status/page.tsx
│   └── api/
│       └── auth/[...nextauth]/route.ts   -- NextAuth config, Credentials Provider
│
├── lib/
│   ├── ords-client.ts                -- typed fetch wrapper for ORDS REST, attaches JWT
│   ├── auth.ts                       -- NextAuth config + JWT callbacks (permission set embedded in token)
│   ├── permissions.ts                -- client-side helper: hasPermission(moduleCode, action)
│   ├── offline/
│   │   ├── db.ts                     -- Dexie.js IndexedDB schema (queued POS/dist txns)
│   │   ├── sync-engine.ts            -- background sync: drains queue to /pos/sale/batch-sync etc.
│   │   └── conflict-handling.ts      -- offline_uuid-based idempotency on the client side
│   └── print/
│       ├── pdf.ts                    -- server-side Puppeteer PDF generation (used by /reports API routes)
│       └── excel.ts                  -- exceljs workbook generation
│
├── components/
│   ├── ui/                           -- shared design system components (buttons, inputs, data-grid)
│   ├── data-grid/                    -- TanStack Table-based interactive grid (replaces APEX Interactive Grid)
│   ├── coa-tree/
│   ├── permission-matrix-editor/
│   └── print-view/                   -- shared @media print layout wrapper (A4 / 80mm variants)
│
├── public/
│   ├── pos-sw.js                     -- POS service worker (Workbox)
│   └── dist-sw.js                    -- Distribution service worker
│
├── proxy.ts                           -- optimistic auth redirect ONLY (cookie presence, no DB) + matcher
├── next.config.ts                     -- output: 'standalone'
└── package.json
```

## Next.js 16 corrections to this plan

Verified against the bundled docs in `node_modules/next/dist/docs/` for Next 16.3.7.

1. **`middleware.ts` is deprecated and renamed to `proxy.ts`** (root level, default export named
   `proxy`). Its runtime is now Node.js, not Edge — setting `runtime` throws. Without a `matcher`
   it runs on every request including `_next/static`, which would block the app's own CSS/JS.
   Codemod: `npx @next/codemod@canary middleware-to-proxy .`
2. **Proxy must not be the permission gate.** The docs state it is for *optimistic* checks only —
   read the session cookie, never query the database. The real `module_code` permission check
   belongs in a Data Access Layer called from each page / route handler / Server Action, backed by
   `pkg_security` in the database. This preserves the "enforce in both layers" decision; it just
   moves the app-side layer out of proxy. Note also that Server Actions POST to the route they live
   on, so a `matcher` that excludes a path silently skips proxy for its actions — always re-verify
   inside the action.
3. **Permission-gated layouts are not a security boundary.** Layouts do not re-render on navigation
   (Partial Rendering), so a session check in `(admin)/layout.tsx` will not run on route changes, and
   a layout cannot prevent child segments from executing or appearing in the RSC payload. Use the
   layout to render the nav; enforce access in the DAL and in each page.
4. **One manifest, not two.** Route groups do not affect URLs, so `(pos)/manifest.json` and
   `(distribution)/manifest.json` both resolve to `/manifest.webmanifest` and fail the build. Serve
   two distinct static manifests from `public/` (e.g. `pos.webmanifest`, `dist.webmanifest`) and
   reference each from its route group's `metadata`. Service-worker scope is set at
   `navigator.serviceWorker.register(url, { scope })` and is unrelated to route groups.
5. **Route handler `params` must be awaited**, along with `cookies()`, `headers()` and `draftMode()`
   — the Next 15 synchronous shim is gone. A generated `RouteContext<'/path/[id]'>` type is available.
6. **Cache Components stay off.** They require explicit `cacheComponents: true`; leaving it off keeps
   classic dynamic rendering, which suits per-user-scoped ERP data.
7. **Turbopack is the default** for `dev` and `build`. A custom `webpack` config fails the build —
   use `--webpack` to opt out. `next lint` has been removed (`package.json` uses `eslint` directly).

## Required packages (compulsory to run this, per your Q3)

| Package | Purpose |
|---|---|
| `next`, `react`, `react-dom` | framework |
| `next-auth` | session/JWT auth against custom `app_user` table |
| `bcryptjs` | password hashing/verification (Node side, never PL/SQL) |
| `dexie` | IndexedDB wrapper for offline queue (POS + Distribution) |
| `@tanstack/react-table` | data grid (interactive-grid replacement) |
| `puppeteer` | server-side PDF rendering for reports |
| `exceljs` | Excel export for reports |
| `zod` | request/response schema validation (matches the ORDS contract) |
| `pm2` (global, not a project dependency) | process manager on Windows Server |

## Deployment (Windows Server — per compulsory stack, your Q3)

1. Install Node.js LTS on the server.
2. `next build` with `output: 'standalone'`.
3. Run the standalone server under **PM2** (`pm2 start server.js --name erp-app`), one PM2 process per app if you split POS/Distribution into separate deployable units later — Phase 1 ships as one app on one port.
4. IIS with **ARR + URL Rewrite** reverse-proxies the public subdomain (e.g. `erp.goldengroupofcompany.com`) to `localhost:3000`, consistent with your existing `feed`/`daal` subdomain pattern.
5. TLS certificate terminated at IIS — required for the PWA service workers to register (HTTPS-only, except localhost).
6. ORDS stays as-is, fronting the Oracle schema; Next.js API calls go to the ORDS REST base path over HTTPS (internal network or same reverse-proxy tier).
