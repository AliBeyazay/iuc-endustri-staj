@echo off
cd /d %~dp0
set USE_SQLITE=True
.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000 --noreload
