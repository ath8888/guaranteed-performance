$env:PATH = "C:\Users\athol\AppData\Roaming\fnm\node-versions\v20.20.2\installation;" + $env:PATH
Set-Location "C:\Users\athol\guaranteed-performance"
npm install --legacy-peer-deps
node_modules\.bin\jest.cmd --no-coverage
