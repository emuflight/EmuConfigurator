@echo off

setlocal

powershell -Command 'Set-ExecutionPolicy -ExecutionPolicy RemoteSigned'
powershell -Command 'get-host'

powershell -Command 'iwr -useb get.scoop.sh | iex'
powershell -Command 'scoop bucket add nsis https://github.com/NSIS-Dev/scoop-nsis'
powershell -Command 'scoop install nsis/nsis'
