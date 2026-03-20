@echo off
setlocal

if "%~1"=="" (
  echo Kullanim: run_scraper_docker.bat ^<spider_adi^>
  echo Ornek: run_scraper_docker.bat youthall
  exit /b 1
)

cd /d %~dp0\..
docker compose --profile scraper run --rm scraper crawl %1
