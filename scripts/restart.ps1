# ------------------------------------------------------------------
# 适用场景：Windows 服务器 (PowerShell)
# ------------------------------------------------------------------
$AppName = "zkjsplat-gateway.jar"

# 1. 查找并杀掉 Java 进程
# 筛选逻辑：java 进程且命令行包含对应的包名
$Process = Get-Process java -ErrorAction SilentlyContinue | Where-Object { 
    $_.CommandLine -like "*$AppName*" 
}

if ($Process) {
    Write-Host ">>> Stopping existing process..."
    $Process | Stop-Process -Force
    Start-Sleep -Seconds 2
}

# 2. 启动新包
Write-Host ">>> Starting new version..."
# 确保 logs 目录存在
if (!(Test-Path "logs")) { New-Item -ItemType Directory -Path "logs" }

Start-Process "java" -ArgumentList "-Xms512m -Xmx1024m -jar $AppName" -WindowStyle Hidden -RedirectStandardOutput "logs/stdout.log" -RedirectStandardError "logs/stderr.log"

Write-Host ">>> Startup command sent. Please check logs/stdout.log for progress."
