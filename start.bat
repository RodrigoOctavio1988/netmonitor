@echo off
title Monitor de Rede - Inicializador
echo ===================================================
echo   Iniciando o Aplicativo de Monitoramento de Rede
echo ===================================================
echo.

:: 1. Verifica se o Node.js/NPM está instalado
where node >nul 2>&1
if errorlevel 1 goto NO_NODE

:: 2. Verifica se a pasta node_modules existe na raiz e no backend
if not exist node_modules goto INSTALL_DEPS
if not exist backend\node_modules\helmet goto INSTALL_DEPS

echo Dependencias ja instaladas.
goto START_APP

:INSTALL_DEPS
echo Instalando/Atualizando as dependencias do projeto...
echo Isso pode levar alguns minutos. Por favor, aguarde...
call npm run install-all
if errorlevel 1 goto ERROR_INSTALL
goto START_APP

:START_APP
echo.
echo Iniciando o Frontend (Porta 5173) e o Backend (Porta 3001)...
echo A aplicacao abrira no seu navegador em breve.
echo.
echo Pressione Ctrl+C para encerrar o aplicativo a qualquer momento.
echo.

:: Abre o navegador no endereço do frontend
start http://localhost:5173

:: Inicia o processo concorrente
call npm run dev
if errorlevel 1 goto ERROR_DEV
goto END

:NO_NODE
echo [ERRO] O Node.js nao foi encontrado no seu computador!
echo Por favor, instale o Node.js (versao LTS recomendada) antes de rodar o aplicativo.
echo Baixe em: https://nodejs.org/
echo.
pause
exit /b

:ERROR_INSTALL
echo.
echo [ERRO] Ocorreu uma falha ao instalar as dependencias.
echo Verifique sua conexao com a internet ou se ha restricoes de proxy.
echo.
pause
exit /b

:ERROR_DEV
echo.
echo [ERRO] Falha ao iniciar os servidores de desenvolvimento.
echo.
pause
exit /b

:END
