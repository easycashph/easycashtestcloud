# Windows Setup Guide — Building/Running the Easycash LMS from Scratch

Step-by-step para sa bagong Windows machine: mula sa pag-install ng Claude Code, Docker, at
GitHub, hanggang sa unang pag-login sa system. Ginawa base sa aktwal na setup na ginagamit sa
project na ito ngayon (`C:\ECLC CLAUDE CODE`). Kapareho ng layunin ng
`docs/MACOS_SETUP_GUIDE.md`, pero para sa Windows/PowerShell.

Bawat machine (Windows, Mac, atbp.) ay may sariling **local PostgreSQL database** — shared sa
GitHub ang code, pero hindi ang database.

---

## 1. I-install ang mga kailangan

### 1a. Git
- I-download mula [git-scm.com](https://git-scm.com/download/win), i-install gamit ang default
  options.
- I-verify: `git --version`

### 1b. Node.js 20+
- I-download mula [nodejs.org](https://nodejs.org) (LTS version).
- I-verify: `node --version` (dapat v20 o mas mataas)

### 1c. Docker Desktop
- I-download mula [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop).
- Kailangan ng WSL2 enabled sa Windows (i-guguide ka ng installer kung kulang pa).
- Buksan ang Docker Desktop pagkatapos i-install, at hintayin maging "Running" ang whale icon sa
  taskbar bago magpatuloy.
- I-verify: `docker --version` at `docker compose version`

### 1d. GitHub CLI (opsyonal pero madaling gamitin)
- I-download mula [cli.github.com](https://cli.github.com/), o `winget install --id GitHub.cli`.
- Mag-login: `gh auth login` (piliin ang GitHub.com, HTTPS, at i-authenticate sa browser).
- I-verify: `gh --version`

### 1e. Claude Code CLI
- Kailangan muna ng Node.js (§1b).
- `npm install -g @anthropic-ai/claude-code`
- Patakbuhin ang `claude` sa loob ng project folder — mag-p-prompt ito ng login sa unang beses
  (browser-based auth papunta sa Anthropic account na may Claude Code access).
- I-verify: `claude --version`

---

## 2. I-clone ang repository

```powershell
gh repo clone easycashph/easycash-lms
cd easycash-lms
```

O kung wala kang GitHub CLI:

```powershell
git clone https://github.com/easycashph/easycash-lms.git
cd easycash-lms
```

---

## 3. I-setup ang environment files

Ang `.env` files ay hindi kasama sa git (baka may laman na sensitive) — kailangan gawin sarili
mula sa `.env.example`:

```powershell
Copy-Item app\easycashbackend\.env.example app\easycashbackend\.env
Copy-Item app\lmsfrontend\.env.example app\lmsfrontend\.env
```

Para sa **local dev**, gumagana na ang mga default values sa `.env.example` nang walang
karagdagang palitan — hindi kailangan ng totoong secrets para tumakbo lokal. I-double-check lang
na tumutugma ang `DATABASE_URL` sa `app/easycashbackend/.env` sa Docker Postgres container na sisimulan sa
Step 4:

```
DATABASE_URL=postgresql://easycash:easycash@localhost:5432/easycash?schema=public
```

Kung may ibibigay sa'yo ang teammate na totoong values (hal. shared JWT secret), ipasa ito sa
secure channel (password manager, encrypted file) — huwag sa email o plain-text chat.

---

## 4. Simulan ang PostgreSQL, i-setup ang database schema

```powershell
cd app\docker
docker compose up -d postgres
cd ..\..

cd app
npm install
cd backend
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
```

Ito ang gagawin ng bawat command:
- `docker compose up -d postgres` — sinisimulan lang ang Postgres container (hindi pa ang buong
  app), sa background.
- `npm install` — ini-install ang dependencies ng backend AT frontend (workspace setup).
- `prisma generate` — bumubuo ng typed database client mula sa `schema.prisma`.
- `prisma migrate deploy` — inaaplay ang lahat ng migrations (kasalukuyang 39+ files) sa bagong
  database.
- `prisma db seed` — nagla-lagay ng seed data (ang "HQ" branch at role records) — kailangan ito
  bago gumana ang susunod na step.

---

## 5. Gumawa ng unang MIS (admin) account

Walang HTTP endpoint para gumawa ng admin account (sinadya, para hindi ito ma-abuso) — CLI script
lang:

```powershell
cd app\easycashbackend
$env:BOOTSTRAP_ADMIN_EMAIL = "admin@easycash.ph"
$env:BOOTSTRAP_ADMIN_PASSWORD = "PalitanMoIto123!"
npx tsx scripts/bootstrap-admin.ts
```

- Tatanggihan nito kung may existing MIS account na — para hindi ma-duplicate ang super-user.
- Sundan agad ang mga instructions ng script kung may hihilingin pang input.

*(Opsyonal na hakbang lang ito — kung may kasalukuyan nang database mula sa isang shared dump,
maaaring mayroon nang MIS account, tignan lang sa DB kung meron.)*

---

## 6. Populuhan ng totoong (migrated) data (opsyonal, para sa full dataset)

Walang laman ang bagong local Postgres. Kung kailangan ang parehong legacy MongoDB export na
ginamit ng ibang team member, sundan ang buong proseso sa `docs/MACOS_SETUP_GUIDE.md` §5 (parehong
hakbang, iba lang ang OS ng shell commands) — kasama ang exact order ng migration scripts sa
`docs/Architecture/MIGRATION_LEDGER.md`. Real client PII ang dump na ito — hindi kailanman
ipapasa via email/cloud share, laging via secure/encrypted channel.

---

## 7. Patakbuhin ang app

```powershell
# Terminal 1 — backend
cd app\easycashbackend
npm run dev

# Terminal 2 — frontend
cd app\lmsfrontend
npm run dev
```

Buksan ang `http://localhost:5173`, mag-login gamit ang admin account mula sa Step 5.

**Alternatibo:** kung gusto ng buong Docker stack (backend + frontend + postgres, hindi hot-reload):

```powershell
cd app\docker
docker compose up -d --build
```

---

## 8. Pang-araw-araw na workflow (pagkatapos ng unang setup)

Kapag na-set up na, sundan na lang ang `docs/DEVICE_SYNC_GUIDE.md` para sa pag-sync ng code
(`git pull`/`git push`), pag-apply ng bagong migrations, at pag-verify bago mag-commit —
hindi na kailangang ulitin ang mga hakbang sa itaas.

Karaniwang git flow:

```powershell
git pull origin main          # kumuha ng bagong commits
cd app\easycashbackend
npx prisma migrate deploy     # i-apply ang anumang bagong migration
npx prisma generate
cd ..\..
```

Kapag may sarili kang binago:

```powershell
git add <files>
git commit -m "..."
git push origin main
```

Kung magkaiba na ang local at remote history (divergence), `git merge origin/main` muna bago
mag-push — huwag `git push --force` sa `main` maliban kung sinabi mo talagang gawin ito (mawawala
ang commits ng ibang tao).

---

## Buod ng buong flow (mula wala)

```
1. Install: Git, Node.js 20+, Docker Desktop, GitHub CLI, Claude Code CLI
2. gh repo clone easycashph/easycash-lms
3. Copy .env.example -> .env (backend + frontend)
4. docker compose up -d postgres
5. npm install (sa app/)
6. npx prisma generate / migrate deploy / db seed (sa app/easycashbackend/)
7. npx tsx scripts/bootstrap-admin.ts (gumawa ng unang MIS account)
8. npm run dev (sa app/easycashbackend at app/lmsfrontend, dalawang hiwalay na terminal)
9. Buksan http://localhost:5173, mag-login
```
