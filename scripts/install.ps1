# Xinyang KB MCP Server - Windows PowerShell installer
# Simple wrapper that delegates to the cross-platform Node.js installer.
Set-Location $PSScriptRoot\..
node scripts\install.cjs @args
