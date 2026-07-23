# Easycash Portal

Client-facing web app for Easycash Lending Company Inc. — sign up, apply for a loan, and track
application status online. Hosted on GitHub Pages as a static SPA; talks to the Easycash LMS
backend's `/api/v1/portal/*` routes over a separate auth realm from internal staff accounts.

This app is developed from the main LMS monorepo at `app/portal/` and mirrored here for GitHub
Pages hosting. See the main repo's `CLAUDE.md` for the platform's overall architecture and
conventions.

## Status

Preview build. The backend isn't yet exposed on a public URL, so account creation/login won't
work until `VITE_API_BASE_URL` (set as a repo variable, `Settings > Secrets and variables >
Actions > Variables`) points at a real, publicly-reachable backend origin.

## Local development

```bash
npm install
npm run dev
```

## Deployment

Push to `main` triggers `.github/workflows/deploy.yml`, which builds the app and publishes it to
GitHub Pages via GitHub Actions.
