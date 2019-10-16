@echo off

setlocal

powershell -Command Set-MpPreference -DisableArchiveScanning 'Set-ExecutionPolicy -ExecutionPolicy RemoteSigned'
powershell -Command Set-MpPreference -DisableArchiveScanning 'get-host'

iwr -useb get.scoop.sh | iex
scoop bucket add nsis https://github.com/NSIS-Dev/scoop-nsis
scoop install nsis/nsis
