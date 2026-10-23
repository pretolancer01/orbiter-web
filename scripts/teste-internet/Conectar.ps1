param([ValidateSet('Host','Amigo')][string]$Modo='Amigo')
$ErrorActionPreference='Stop'
try {
  $orbiterExe=Join-Path $PSScriptRoot 'Orbiter 0.2.2.exe'
  if (!(Test-Path -LiteralPath $orbiterExe)) { throw 'O executavel Orbiter 0.2.2.exe precisa estar nesta pasta.' }
  if (Get-Process -Name Orbiter -ErrorAction SilentlyContinue) { throw 'Feche a janela atual do Orbiter antes de iniciar este teste.' }
  if ($Modo -eq 'Host') {
    $orbiterTailscale=Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
    if (!(Test-Path -LiteralPath $orbiterTailscale)) { throw 'Instale e conecte o Tailscale primeiro. Veja TESTE-INTERNET.md.' }
    $orbiterIp=((& $orbiterTailscale ip -4) | Select-Object -First 1)
  } else {
    $orbiterIp=Read-Host 'Digite o IP Tailscale do computador do anfitriao (100.x.x.x)'
  }
  $orbiterIp=([string]$orbiterIp).Trim()
  $orbiterParsed=$null
  if (![Net.IPAddress]::TryParse($orbiterIp,[ref]$orbiterParsed) -or $orbiterParsed.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { throw 'IP invalido.' }
  $orbiterBytes=$orbiterParsed.GetAddressBytes()
  if ($orbiterBytes[0] -ne 100 -or $orbiterBytes[1] -lt 64 -or $orbiterBytes[1] -gt 127) { throw 'Use o IP privado Tailscale (faixa 100.64.x.x a 100.127.x.x).' }
  $env:ORBITER_PORT='8765'
  $env:ORBITER_HOST=if ($Modo -eq 'Host') {$orbiterIp} else {'127.0.0.1'}
  $env:ORBITER_SERVER_URL="ws://${orbiterIp}:8765"
  Write-Host "Conectando ao Orbiter em $orbiterIp. Mantenha o Tailscale conectado."
  Start-Process -FilePath $orbiterExe -WorkingDirectory $PSScriptRoot
} catch { Write-Host $_.Exception.Message -ForegroundColor Red; Read-Host 'Pressione Enter para fechar'; exit 1 }
