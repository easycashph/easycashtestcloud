# Session Log — 2026-09-12 — Live Site Login Outage (Dead Cloudflare Tunnel)

**Machine:** Office Server PC
**Requested by:** Nomer Perez

## Summary

User reported "hindi ako makalogin sa live" (can't log in to the live LMS). Root cause: the
`cloudflared` quick-tunnel process was still running (PID visible in Task Manager, listening
locally) but had silently lost its connection to Cloudflare's edge — its own `/ready` endpoint
reported `{"status":503,"readyConnections":0}`. Confirmed independently via `easycashbackend`'s
request logs: zero requests of any kind (not just login) had reached the backend from the live
site in the prior hour. Not a login/auth bug — the live domain simply wasn't routing to this
machine at all.

## Why this happens

This setup uses a free Cloudflare **quick tunnel** (`cloudflared tunnel --url ...`), not a named
tunnel with a fixed domain — there's no Cloudflare-owned domain for this office yet. A quick
tunnel's URL is random and changes every time the tunnel process (re)starts, so
`scripts/Start Cloudflare Tunnel (Auto-Update).ps1` exists specifically to: start a new tunnel,
capture its new URL, then push that URL into the LMS's (and Portal's) Cloudflare Pages
`VITE_API_BASE_URL` env var and trigger a redeploy — because the frontend bakes that URL in at
build time. If the tunnel process ever dies or (this incident) goes quietly disconnected without
dying, every deployed frontend is left pointing at a URL that no longer resolves to anything, with
no visible error beyond "can't log in" / everything timing out.

## Fix applied

1. Diagnosed via the tunnel's own local metrics/ready endpoint (`curl http://127.0.0.1:<port>/ready`
   — the port is whatever `netstat -ano` shows LISTENING for the `cloudflared.exe` PID).
2. Could not kill the stale process — **this session's shell is an admin-named account but an
   unelevated token** (`IsInRole(Administrator)` returned `false`), so both `taskkill /F` and
   PowerShell's `Stop-Process -Force` failed with Access Denied even though `whoami` shows an
   admin account. Worked around it: started a **new** `cloudflared` instance without killing the
   old one first (confirmed no port conflict - each instance picks its own free metrics port), via
   `scripts/Start Cloudflare Tunnel (Auto-Update).ps1` launched in its own detached window
   (`Start-Process powershell.exe -NoExit ...`, since the script intentionally blocks on
   `Wait-Process` forever and must be left running).
3. Verified end-to-end: new tunnel URL responded with the backend's real `/health` payload: new
   tunnel's `/ready` also came back healthy after 2026-09-12 12:27:36Z; Cloudflare Pages API
   showed a new `main` branch deployment (id `2a6226e9`) created at 12:27:40Z with status
   `success` — matches the timing of the script's Pages update step exactly.

## Known loose end

The old, disconnected `cloudflared.exe` process is still running (Task Manager will show two
`cloudflared.exe` entries until someone kills the stale one manually with elevated rights, or the
machine is next rebooted). It's harmless - it holds no port the new instance needs - but worth
cleaning up when convenient. **Whoever next opens an elevated PowerShell/Task Manager here should
end the stale `cloudflared.exe` PID** (check which one has 0 ready connections via its `/ready`
endpoint before killing, in case a third instance gets started before then).

## Follow-up worth considering (not requested, just noticed)

A named Cloudflare Tunnel (needs a domain added to the Cloudflare account - see the auto-update
script's own header comment) would fix this whole class of outage permanently: a fixed hostname
means no more "which random trycloudflare.com URL is live right now" and no redeploy-on-every-
restart requirement. Flagged here for awareness, not actioned - the office doesn't own a domain on
Cloudflare yet per the script's existing comment.
