# BorderGuard AI — Full-Stack Prototype

Two processes: an Express + SQLite backend (`/server`), and a Vite + React
frontend (project root). Run both at the same time, in two terminals.

## 1. Install dependencies

```bash
# Terminal A — backend
cd server
npm install

# Terminal B — frontend
cd .            # project root
npm install
```

## 2. Run both servers

```bash
# Terminal A
cd server
npm start        # -> BorderGuard secure audit server active on port 3000

# Terminal B
npm run dev       # -> Vite dev server on http://localhost:5173
```

Open **http://localhost:5173** in your browser. Do not open the backend's
port 3000 directly for the app UI — that's the API only.

The Vite dev server proxies `/api/*` and `/uploads/*` to `http://localhost:3000`
(see `vite.config.js`), so the frontend can just call `fetch('/api/...')`
without hardcoding a host — this is what makes the two halves talk to each
other.

## 3. How the pieces connect

```
Browser (localhost:5173)
   │
   ├─ React app (Scanner, BiometricMatcher, ForensicAnalysis, AuditLedger,
   │  SampleCaseManager)
   │
   ├─ /api/*        ──proxy──>  Express server (localhost:3000)
   └─ /uploads/*     ──proxy──>  served straight from server/uploads/
```

- `Scanner.jsx` runs OCR **in the browser** via Tesseract.js — no upload needed for that step.
- `BiometricMatcher.jsx` runs face detection/matching **in the browser** via face-api.js, using the models already in `public/models`.
- Only the final result (`extractedText`, `matchScore`) is POSTed to
  `/api/verify-document`, which is what gets hash-chained into the audit
  ledger in SQLite (`server/borderguard.db`).
- `SampleCaseManager.jsx` is the new piece: it uploads an actual image file
  to `/api/cases` (multipart form), which Express saves to `server/uploads/`
  and records in the `cases` table, tagged `genuine` or `fake`.

## 4. Loading example genuine/fake IDs for a demo

1. Open the app, go to the **Sample Case Database** panel at the top.
2. Upload a made-up "genuine" ID photo, name it, tag it **Genuine ID**, save.
3. Upload a second made-up "fake"/tampered ID photo, tag it **Fake / tampered ID**, save.
4. Click **Load** on either card — it drops straight into the Scanner below.
5. Click **Initiate Scan** (OCR).
6. In the **Facial Biometric Terminal**, pick a comparison mode:
   - **Live Camera** — matches the document photo against your webcam, like a real checkpoint.
   - **Upload Second Photo** — matches the document photo against a second
     still image instead. This is the easiest way to demo a "same person"
     pair and a "different person" pair back to back without needing a
     webcam or a second person in the room.
   Then click **Run 1:1 Verification**.
7. Click **Submit to Audit Ledger** once both OCR and the face match are done.
8. Watch the result land in the **Cryptographic Audit Trail** panel, tagged
   with which sample case it came from.

**Building a convincing demo pair:** upload the same made-up face twice
under different filenames (once as the "document photo" sample case, once
as the "second photo" during matching) to show a high match score, then
swap in a different face for the second photo to show a low one.

Because this is stored in a real SQLite file (not memory), your sample
cases and ledger history survive restarting the backend — good for
re-running the same demo multiple times without re-uploading anything.

## 5. Resetting the demo data

```bash
cd server
rm -f borderguard.db borderguard.db-wal borderguard.db-shm
rm -f uploads/*.jpg uploads/*.jpeg uploads/*.png
```

Restart the server and it recreates an empty database automatically.

## 6. What changed from the original code (bug fixes)

- `Scanner.jsx` didn't accept or call the `onImageUploaded` prop `App.jsx`
  passed it — nothing downstream ever received the scanned image. Fixed.
- `verifyWithBackend()` was an empty stub — OCR results never reached the
  server. Fixed: extracted text and match score are now lifted into
  `App.jsx` and POSTed together once both exist.
- `BiometricMatcher.jsx` computed a match score but never reported it
  upward. Added `onMatchScore` prop. Also added an "Upload Second Photo"
  mode alongside the original live-camera mode, so you can demo two static
  photos against each other without needing a webcam.
- The audit ledger lived in a plain in-memory array and reset on every
  server restart. Replaced with a SQLite database (`server/db.js`).
- There was no way to store reference images at all. Added the `cases`
  table, `multer`-backed file upload, and the `SampleCaseManager` UI.
- There was no frontend build tooling whatsoever (no `package.json`, no
  bundler) — the `.jsx` files could not run. Added a Vite + React scaffold
  with a dev-server proxy to the backend.
- `multer@1.x` was flagged with known vulnerabilities; pinned to `2.x`.
- Downgraded `express` from an unreleased `^5.2.1` pin to the stable `4.x`
  line for compatibility with `multer` and `cors`.
