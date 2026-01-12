#!/bin/bash

echo "=== Git 推送前安全检查 ==="
echo ""

# 检查是否已初始化Git
if [ ! -d ".git" ]; then
    echo "ℹ️  Git仓库未初始化"
    echo "运行以下命令初始化:"
    echo "  git init"
    echo "  git remote add origin https://github.com/YOUR_USERNAME/upload-tool.git"
    echo ""
fi

# 检查敏感文件
echo "🔍 检查敏感文件..."
SENSITIVE_FOUND=0

if [ -f ".env.local" ]; then
    if git check-ignore .env.local > /dev/null 2>&1 || [ ! -d ".git" ]; then
        echo "✅ .env.local 已被忽略或Git未初始化"
    else
        echo "❌ 警告: .env.local 未被忽略!"
        SENSITIVE_FOUND=1
    fi
fi

if [ -d "uploads" ]; then
    if git check-ignore uploads > /dev/null 2>&1 || [ ! -d ".git" ]; then
        echo "✅ uploads/ 目录已被忽略或Git未初始化"
    else
        echo "❌ 警告: uploads/ 目录未被忽略!"
        SENSITIVE_FOUND=1
    fi
fi

# 检查测试文件
if [ -f "check_db.js" ]; then
    echo "⚠️  发现测试文件 check_db.js（应该被忽略）"
fi

if [ -f "test_path.js" ]; then
    echo "⚠️  发现测试文件 test_path.js（应该被忽略）"
fi

echo ""
echo "📋 推送前清单:"
echo "  [ ] 已复制 env.example 为 .env.local 并配置"
echo "  [ ] .env.local 包含真实密码（不会被提交）"
echo "  [ ] uploads/ 目录包含上传文件（不会被提交）"
echo "  [ ] README 中添加了安全配置说明"
echo ""

if [ $SENSITIVE_FOUND -eq 0 ]; then
    echo "✅ 安全检查通过! 可以安全推送"
else
    echo "❌ 发现安全问题，请检查 .gitignore"
    exit 1
fi

echo ""
echo "推荐的Git命令:"
echo "  git init"
echo "  git add ."
echo "  git commit -m \"Initial commit: Upload and deployment tool\""
echo "  git branch -M main"
echo "  git remote add origin https://github.com/YOUR_USERNAME/upload-tool.git"
echo "  git push -u origin main"
