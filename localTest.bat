@ECHO OFF
del .\examples\ngAutocomplete.js
xcopy /f /y .\src\ngAutocomplete.js .\examples\
ECHO install of npm
CALL npm install http-server -g
CALL http-server ./examples