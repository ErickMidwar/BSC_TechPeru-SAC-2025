@echo off
cd /d "C:\Downloads\BSC_Prototipo_Interactivo-v3 (1)\BSC_Prototipo"

echo === Inicializando repositorio Git ===
git init
git branch -M main

echo === Configurando remote ===
git remote remove origin 2>nul
git remote add origin https://github.com/ErickMidwar/BSC_TechPeru-SAC-2025.git

echo === Agregando archivos ===
git add .
git status --short

echo === Creando commit inicial ===
git commit -m "feat: BSC TechPeru SAC 2025 - Sistema completo con backend Node.js/Express/SQLite"

echo === Subiendo a GitHub ===
git push -u origin main

echo === LISTO - Exit: %ERRORLEVEL% ===
