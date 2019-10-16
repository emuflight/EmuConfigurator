@echo off

setlocal

Set-ExecutionPolicy -ExecutionPolicy RemoteSigned
get-host

iwr -useb get.scoop.sh | iex
scoop bucket add nsis https://github.com/NSIS-Dev/scoop-nsis
scoop install nsis/nsis
