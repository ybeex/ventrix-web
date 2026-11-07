# Ventrix web

React + TypeScript + Vite front end for the Ventrix API, styled from `StoreKeeper_UI_kit.html` (Concrete and Night palettes).

    npm install
    npm run dev        # http://localhost:5173, proxies /v1 to http://localhost:3000 (override with API_PROXY)
    npm run build      # typecheck + production build in dist/

Production: set `VITE_API_URL` to the API origin at build time and add the web origin to the API's `CORS_ORIGINS`.
Demo login: org `lekki-works-supply`, `supervisor@lekki-works-supply.test` / `Lekki-Works-Demo-42` (from `npm run seed:demo` in the API repo).

Screens: sign-in, home, outstanding, check out (batch), items + item detail, collections, low stock, stock counts (supervisor), approvals, sync problems, activity, notifications bell.
Offline: items and holders are cached in IndexedDB (delta refresh via /sync/snapshot), so search, scanning, the holder picker, single-item actions and check-out keep working without a connection. Actions are saved on the device and replayed through /sync/batch on reconnect (offline check-out applies line by line, not atomically). The cache is wiped on sign-out.
Protocols from FRONTEND-INTEGRATION.md: bearer token in memory only, any 401 ends the session, one Idempotency-Key per intent
reused on retry, 202 pending_approval handled, 429/503 retried with the same key.

Also: item photos (resized in the browser before upload), jobs (and a job picker at check-out), notification settings (personal, plus admin routing by role), CSV import (admin), shared-device PIN switching (trusted tablet) and Set PIN, reports (with CSV download), announcements (admin), add item (admin, or staff when the org allows it), announcement banner, Settings (admin: approval policy and store rules), People & teams, Team (invite, role, deactivate), a More menu for secondary pages.

Also included: session persistence (per-tab `sessionStorage`, 30-minute idle sign-out; set `VITE_PERSIST_SESSION=false` to keep the token memory-only, `VITE_IDLE_MINUTES` to change the window; PIN "home" sessions are never persisted), store layout management for admins (locations, shelves, categories), item edit/archive/restore, and transaction photo snapshots (required or optional per the organization's `requirePhotoFor` setting, which admins toggle in Settings; a required photo cannot be saved offline).

Navigation: a grouped sidebar on screens 900px and wider; a bottom tab bar (Home, Out, Scan, Items, More) on phones, with every other page in the More sheet. Both come from one list in `src/components/Layout.tsx`, filtered by role.

Scanning: every item gets a scan code when it is created (a custom code if you set one, otherwise its Item ID such as AST-0001). The item page shows its QR label with Print and Download. Anywhere you search for an item there is a camera button that reads QR codes (and common barcodes where the browser supports `BarcodeDetector`); the phone Scan tab opens the camera directly. Typed codes and keyboard-style scanners still work. Camera access needs https (or localhost).

Self-serve sign-up at `/signup` creates an organization through the API's public `POST /v1/auth/register-org` and shows the organization ID needed to sign in. Set `VITE_SITE_URL` to link the Terms and Privacy pages to your marketing site.

## Search and AI crawlers

The app shell includes Ventrix page and social-preview metadata, but is marked `noindex` because it is an authenticated inventory application, not a public marketing site. `public/robots.txt` blocks crawlers from app routes while allowing `public/llms.txt`, which describes the product at a high level and points to the public website.

These files apply only to the origin serving this app. The public marketing website at `https://ventrix.app/` must publish its own crawlable product content, metadata, structured data, and crawler guidance; this app cannot configure SEO for a separately hosted site.

Not built yet: multiple locations beyond what the API's MVP supports; billing (sign-up does not take payment).

## Printing labels

**Print labels** (Stock group in the menu, or the button on Items) prints QR labels in bulk.

1. Pick items: search, filter by category, tick, or "Select all matching" (up to 500 labels per job).
2. First time only, say what you print on: A4 sticker sheets (21-up or 8-up), a 50×30 or 100×50 mm roll, or a custom size. Browsers cannot detect printers, so this is asked once and remembered **on this device** (localStorage `sk.labels`). There is no organisation-wide default yet; that would need a backend settings field.
3. Preview, then Print. "Print a test (with outlines)" draws label borders so you can check alignment; use the shift-right / shift-down inputs to correct small offsets.

In the print dialog choose your printer, set the paper size to match, margins "None", scale 100%. QR codes are generated in the browser, so printing needs no extra API calls. A warning appears when a code is long enough that the QR gets too dense for the label size.
