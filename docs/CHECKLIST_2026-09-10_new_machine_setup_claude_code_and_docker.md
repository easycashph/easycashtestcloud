# Checklist: Bagong Machine Setup — Claude Code + Docker + Easycash LMS

**Layunin:** Gabay para masetup ang buong development environment (Claude Code, Docker, at ang
LMS/Portal/Backend na tatlong app) sa isang bagong laptop/PC mula sa simula.

**Kailan gagamitin:** Bagong laptop, bagong office PC, o reinstall ng existing machine.

---

## 1. I-install ang mga kailangang tools

- [ ] **Git** — [git-scm.com](https://git-scm.com/download/win)
- [ ] **Node.js** (LTS, hal. 20.x) — [nodejs.org](https://nodejs.org)
- [ ] **Docker Desktop** — [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
      — buksan pagkatapos i-install, siguraduhing tumatakbo (may icon sa taskbar/system tray)
- [ ] **Claude Code** — sundin ang opisyal na install guide sa
      [claude.com/claude-code](https://claude.com/claude-code) (karaniwan ay
      `npm install -g @anthropic-ai/claude-code`, pero i-verify laban sa pinaka-bagong
      opisyal na instructions)

## 2. I-clone ang repository

```bash
git clone https://github.com/easycashph/easycash-lms.git "C:\ECLC CLAUDE CODE"
```

Gamitin ang parehong folder path (`C:\ECLC CLAUDE CODE`) na ginagamit sa ibang machine, para
consistent ang mga script/reference sa buong project.

## 3. I-setup ang `.env` file ng backend

Walang totoong `.env` na naka-commit sa repo (gitignored dahil may secrets). May
`app/easycashbackend/.env.example` na minimal starting point (server port, DB URL placeholder,
JWT secrets, CORS, storage driver) — pero **hindi kumpleto** ito para sa live/production-parity
na setup, kulang ito ng: SMS/Email reminder gateway credentials (M360, SMTP), e-signature SMTP
alias, at SDevTech SFTP credentials.

- [ ] **Kopyahin ang totoong `.env`** mula sa isa pang machine (Laptop Nomer, Macbook Nomer, o
      Office Server PC) via USB/secure file-share, ilagay sa `app/easycashbackend/.env`
      (huwag i-commit sa git — laging gitignored ito)
- [ ] Kung walang access sa ibang machine, kopyahin muna ang `.env.example` bilang `.env`, tapos
      punan ang mga kulang na value (hingi ng access sa may-ari ng negosyo)

## 4. I-install ang dependencies (npm)

```bash
cd "C:\ECLC CLAUDE CODE\app\easycashbackend" && npm install
cd "C:\ECLC CLAUDE CODE\app\lmsfrontend" && npm install
cd "C:\ECLC CLAUDE CODE\app\portalfrontend" && npm install
```

## 5. Patakbuhin ang Docker

```bash
cd "C:\ECLC CLAUDE CODE\app\docker"
docker compose up -d --build
```

Ito ang mag-bu-build at magpapatakbo ng apat na container: `postgres`, `easycashbackend`,
`lmsfrontend`, `portalfrontend`.

## 6. I-apply ang mga Prisma migrations

```bash
cd "C:\ECLC CLAUDE CODE\app\easycashbackend"
npx prisma migrate deploy
npx prisma generate
```

## 7. I-verify na gumagana

```bash
docker ps
curl http://localhost:4000/health
```

- [ ] Lahat ng 4 na container ay "Up" (at "healthy" para sa `postgres`)
- [ ] `/health` ay nagbabalik ng `{"status":"ok","service":"easycash-backend",...}`
- [ ] Buksan sa browser: `http://localhost:5173` (LMS), `http://localhost:5199` (Portal)

## 8. Database — kopyahin ang totoong data (opsyonal pero inirerekomenda)

Kung gusto mong may laman agad (hindi blangko) ang database sa bagong machine na ito:

- [ ] Kumuha ng fresh na `pg_dump` (.dump file) mula sa isang existing machine (tingnan ang
      `docs/CHECKLIST_2026-09-03_sync_laptop_macbook_nomer_db.md` para sa buong hakbang ng
      pag-restore)
- [ ] Ilipat ang `.dump` file papunta sa bagong machine (USB/cloud drive — `*.dump` ay
      gitignored, hindi ito dadaan sa `git pull`)
- [ ] Itigil muna ang `easycashbackend` bago mag-restore: `docker compose stop easycashbackend`
- [ ] `pg_restore --clean --if-exists` papunta sa `easycash` database sa loob ng
      `easycash-postgres-1` container
- [ ] I-restart ang backend at i-verify

## 9. Kailangang malaman: mga standing gotcha sa Docker sa buong project

- [ ] **Docker Desktop mismo (hindi lang ang mga container) ay madalas na hindi automatic
      tumatakbo** pagka-restart ng Windows — laging i-check muna (`docker ps`) bago mag-`docker
      compose` command; kung "cannot connect to Docker API" ang error, buksan muna ang Docker
      Desktop app manually.
- [ ] Palaging patakbuhin ang `scripts/write-build-info.ps1` **bago** mag-rebuild ng
      `easycashbackend`/`lmsfrontend`/`portalfrontend`, para tama ang commit hash na makikita sa
      About page (para malaman kaagad kung stale ang deployment).
- [ ] Ang `app/*/build-info.json` files ay **hindi dapat i-commit** — machine-specific ito
      (bawat machine may sariling build hash), kaya laging naka-`git stash`/discard bago mag-`git
      pull` kapag may conflict dito.

## 10. Gumawa ng "Sync After Pull" na script para sa bagong machine (opsyonal)

Meron nang ganitong script para sa ibang machine (`scripts/Sync After Pull (Nomer Laptop).bat`,
`scripts/Sync After Pull (Office Server PC).bat`) — awtomatikong nagpu-pull, nag-a-apply ng
migrations, at nagre-rebuild. Kopyahin at i-adjust ang isa sa mga ito para sa bagong machine na
ito, para hindi na kailangan ulitin manually ang mga hakbang 5-7 sa itaas sa tuwing may bagong pull.

---

## Kapag tapos na ang lahat

- [ ] I-confirm kay Claude Code (sa bagong machine) na healthy ang lahat, tapos itanong kung
      kailangan pang i-configure ang machine-specific na bagay (LAN IP, Cloudflare tunnel, atbp.
      — tingnan ang `scripts/Update LAN IP (Laptop-Nomer).bat` bilang halimbawa kung kailangan ng
      katulad nito sa bagong machine)
