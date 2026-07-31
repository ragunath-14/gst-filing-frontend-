# GST Filing — Frontend

React + Vite single-page app for the GST filing portal, with two role-based
areas: an **admin** panel (accountants managing client companies, filings,
and reminders) and a **company** portal (self-service document upload and
filing status for each client).

## Stack

- **React 19** + **React Router 7**
- **Vite** dev server / build
- **axios** for API calls, **react-hot-toast** for notifications, **lucide-react** for icons

## Project layout

```
src/
  api/axios.js              Configured axios instance (auth token, 401 handling)
  context/                  Auth + theme context providers
  components/               Shared UI (Sidebar, ThemeToggle)
  utils/
    fileGrouping.js         Groups uploaded files by year/financial-year → type → month
    fileUrl.js              Resolves uploaded-file URLs (see API_BASE_URL below)
  pages/
    Login.jsx
    admin/                  Dashboard, Companies, CompanyDetail, Reminders
    company/                Dashboard, Documents, Reminders
```

## Setup

```bash
npm install
```

## Run (dev)

```bash
npm run dev
```

Starts on `http://localhost:5173` (or the next free port). The dev server
proxies `/api` and `/uploads` to `http://localhost:5000` — see
`vite.config.js` — so run the backend alongside it (see
[`../backend/README.md`](../backend/README.md)).

## Build

```bash
npm run build
```

Outputs to `dist/`. In the default single-container deploy, FastAPI serves
this directory directly (see root `Dockerfile`), so no extra config is
needed and `/api` calls stay same-origin.

### Hosting frontend and backend separately

If the backend is hosted on a different domain (e.g. frontend on Vercel,
backend on Render), set `VITE_API_BASE_URL` to the backend's origin at build
time:

```bash
VITE_API_BASE_URL=https://your-backend.onrender.com npm run build
```

This is a build-time env var (Vite bakes it into the bundle), so set it in
your hosting platform's environment variable settings before triggering a
build — not at runtime. Leave it unset for same-origin deploys (local dev,
single-container).

## Lint

```bash
npm run lint
```
