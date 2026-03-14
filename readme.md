# TimeTrack Mobile Web

Standalone mobile web app for clock in/out, team tracking, and timesheet export.

## Run locally

1. Install dependencies: `npm install`
2. Start development server: `npm run dev -- --host 0.0.0.0 --port 5173`
3. Open `http://localhost:5173`

## Build

- Production build: `npm run build`
- Preview build: `npm run preview`

## Data model

- App data is stored locally in browser `localStorage`.
- No external auth provider is required.
- Camera captures are stored as data URLs for local preview/history.

## Backend (optional)

This frontend can run independently. If you also use the Python backend for image/Excel flows,
run `server.py` separately on port `8765`.

### Vercel Postgres support

`server.py` can persist users and timesheet entries into Postgres when either of these env vars is set:

- `POSTGRES_URL`
- `DATABASE_URL`

The backend auto-runs schema bootstrap from `database/schema.sql` on first request.

### Google OAuth login

Google Sign-In is the primary login path in `src/pages/Login.jsx`.

Required frontend env var:

- `VITE_GOOGLE_CLIENT_ID`

Setup notes:

- Create a Google OAuth client in Google Cloud Console.
- Add your Vercel domain and localhost origins to authorized JavaScript origins.
- Set `VITE_GOOGLE_CLIENT_ID` in Vercel project environment variables.

Behavior:

- On Google sign-in, users are matched by email in app storage/database.
- Existing user `user_role` and `setup_complete` values are reused, so role is remembered after setup.
