$env:PATH = "C:\Users\athol\AppData\Roaming\fnm\node-versions\v20.20.2\installation;" + $env:PATH
Set-Location "C:\Users\athol\guaranteed-performance"
node --version
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm install --legacy-peer-deps
