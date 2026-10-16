@echo off
title MyFin server
cd /d "%~dp0"
echo MyFin ishga tushmoqda... Bu oynani yopsangiz sayt ham to'xtaydi.
rem Server tayyor bo'lgach brauzerni ochish (birinchi ochilish ~30 soniya).
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 60;$i++){try{Invoke-WebRequest http://localhost:3100/login -UseBasicParsing -TimeoutSec 90 | Out-Null; Start-Process http://localhost:3100; break}catch{Start-Sleep 2}}"
npm run dev
