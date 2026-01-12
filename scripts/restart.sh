#!/bin/bash
# ------------------------------------------------------------------
# 适用场景：Linux 服务器 (配合无感启动流程)
# ------------------------------------------------------------------

APP_NAME="zkjsplat-gateway.jar" # 请修改为您的实际包名

# 1. 查找并优雅停止旧进程
PID=$(ps -ef | grep $APP_NAME | grep -v grep | awk '{print $2}')

if [ -z "$PID" ]; then
    echo ">>> 没有发现运行中的 $APP_NAME 进程。"
else
    echo ">>> 正在停止运行中的进程 (PID: $PID)..."
    kill $PID
    sleep 3
    # 如果 3 秒后还在，强制杀掉
    kill -9 $PID 2>/dev/null
fi

# 2. 启动新包
echo ">>> 正在拉起新版本..."
# 确保 logs 目录存在
mkdir -p logs
nohup java -Xms512m -Xmx1024m -jar $APP_NAME > logs/stdout.log 2>&1 &

# 3. 简单的启动检查
sleep 2
NEW_PID=$(ps -ef | grep $APP_NAME | grep -v grep | awk '{print $2}')
if [ -n "$NEW_PID" ]; then
    echo ">>> 启动成功！新 PID: $NEW_PID"
else
    echo "ERROR: 启动失败，请检查 logs/stdout.log"
    exit 1
fi
