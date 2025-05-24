@echo off
cd /d "C:\Users\home\Desktop\agricola_obs"
start "" "C:\Program Files\obs-studio\bin\64bit\obs64.exe" --profile "Bez tytułu"
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" http://localhost:3000
node server.js