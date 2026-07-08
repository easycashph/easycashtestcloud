\*\*macbook pro 2015 a1398



**2026-07-08 update:** kailangan na ngayon ng backend + Postgres para gumana ang login at Payment
Recording (dating preview-lang, walang backend na kailangan). Sundin ang buong hakbang sa ibaba, o
gamitin na lang ang "Run LMS Preview.bat" sa root ng project — awtomatiko na nito pareho.



0\. (Isang beses lang) Siguraduhing tumatakbo ang Docker Desktop, tapos patakbuhin ang Postgres:

cd "D:\\ECLC CLAUDE CODE\\app\\docker"

docker compose up -d postgres



1\. Pumunta sa backend folder, patakbuhin ang dev server (bagong terminal window):

cd "D:\\ECLC CLAUDE CODE\\app\\backend"

npm run dev

Lalabas: "easycash-backend listening on port 4000"



2\. Pumunta sa frontend folder (ibang terminal window):

cd "D:\\ECLC CLAUDE CODE\\app\\frontend"



3\. Buksan ang terminal (PowerShell o Git Bash) sa project folder



~~4. I-install muna ang dependencies (kung hindi mo pa ginawa dati, one time only):~~

~~npm install~~



5\. Patakbuhin ang dev server:

npm run dev



6\. Lalabas sa terminal ang isang link, karaniwan:

Local:   http://localhost:5173/



7\. I-Ctrl+Click (or copy-paste) ang link na iyon sa Chrome/Edge.
