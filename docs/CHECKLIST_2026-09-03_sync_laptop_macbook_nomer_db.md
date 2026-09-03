# Checklist: I-sync ang Database ng Laptop Nomer at Macbook Nomer sa Office Server PC

**Layunin:** Palitan ang buong database ng Laptop Nomer at Macbook Nomer ng eksaktong kopya ng
Office Server PC's database (na naglalaman na ng §78 fix - tamang Principal/Interest/Fees/Penalty
balances para sa migrated loans), para magkatugma ang tatlong machine sa datos, user accounts, at
system settings.

**Pinagmulan:** Session log `docs/session-logs/Office Server PC/
SESSION_LOG_2026-08-14_office_server_move_and_manual_payment_adjustment.md`, §78 at ang
sumunod na diskusyon (2026-09-03).

⚠️ **BABALA:** Ang restore step sa ibaba ay **buong papalitan ang existing database** ng target
machine (Laptop Nomer o Macbook Nomer) - walang babalik pang lumang datos doon matapos ito.
Kumpirmado na (2026-09-03, user): walang natatanging datos sa dalawang machine na kailangang
i-preserve, kaya ligtas ang full-overwrite approach.

---

## Sa Office Server PC (gawin isang beses)

- [ ] Gumawa ng full database dump:
  ```bash
  cd "E:\ECLC LMS CLAUDE CODE\easycash-lms"
  docker exec easycash-postgres-1 pg_dump -U easycash -d easycash -F c -f /tmp/easycash_full_backup.dump
  docker cp easycash-postgres-1:/tmp/easycash_full_backup.dump legacy/db-exports/easycash_full_backup_YYYYMMDD.dump
  ```
- [ ] I-verify na nagawa ang file (~28 MB) sa `legacy/db-exports/`
- [ ] Ilipat ang `.dump` file papunta sa Laptop Nomer at Macbook Nomer (USB, cloud drive, o file
      share) - ilagay sa parehong `legacy/db-exports/` na folder ng repo doon
      (gitignored ang `*.dump` - hindi ito dadaan sa `git push`/`git pull`, kailangang manual na
      ilipat)

## Sa Laptop Nomer / Macbook Nomer (bawat machine, hiwalay)

- [ ] I-pull muna ang latest code (kasama ang §78 fix at ang updated
      `Update Database From SDevTech.bat`):
  ```bash
  cd "path/to/easycash-lms"
  git pull
  ```
- [ ] Itigil ang backend bago mag-restore (para walang susulat sa database habang ginagawa ito):
  ```bash
  cd app/docker
  docker compose stop easycashbackend
  ```
- [ ] Kopyahin ang dump file papasok sa Postgres container:
  ```bash
  docker cp "../../legacy/db-exports/easycash_full_backup_YYYYMMDD.dump" easycash-postgres-1:/tmp/restore.dump
  ```
- [ ] I-restore (papalitan ang buong database):
  ```bash
  docker exec easycash-postgres-1 pg_restore -U easycash -d easycash --clean --if-exists -v /tmp/restore.dump
  ```
- [ ] I-rebuild at i-restart ang backend:
  ```bash
  docker compose up -d --build easycashbackend
  ```
- [ ] I-verify na "Up"/healthy ang container: `docker ps`

## Pag-verify pagkatapos ng restore (bawat machine)

- [ ] Makapag-login gamit ang existing (Office Server PC) account
- [ ] "Detailed Ending Current Balance" report - dapat tugma na sa SDevTech, gaya ng sa Office
      Server PC
- [ ] Sample loan (hal. `SML-MAX_P1F1A`, kung meron) - dapat tugma na ang top card sa Repayment
      Schedule tab
- [ ] Settings / System configuration - dapat pareho na sa Office Server PC

## Para sa susunod na "Update Database From SDevTech" run sa alinmang machine

- [ ] Hindi mo na kailangang ulitin ang buong restore process na ito paulit-ulit - basta na-`git
      pull` na ang machine ng latest `.bat` file, awtomatiko nang isasama ang [10/20]-[11/20]
      resync steps sa bawat susunod na SDevTech sync, kaya self-healing na ang proseso mula rito.
