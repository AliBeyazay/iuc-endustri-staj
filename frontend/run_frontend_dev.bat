@echo off
cd /d %~dp0
.\node-v22.14.0-win-x64\node.exe .\node_modules\next\dist\bin\next dev -p 3002 1> ..\frontend-dev.log 2> ..\frontend-dev.err.log
