$env:PATH = "C:\Users\athol\AppData\Roaming\fnm\node-versions\v20.20.2\installation;" + $env:PATH
Set-Location "C:\Users\athol\guaranteed-performance"
node node_modules/typescript/bin/tsc --noEmit
