#!/bin/bash
# ============================================================================
# Upload Tool - 快速打包脚本（用于 Linux 生产环境）
# ============================================================================
# 使用方法：
#   ./package-for-linux.sh [选项]
# 选项：
#   --full      完整打包（包含 node_modules）
#   --light     轻量打包（不含 node_modules）
#   --update    仅打包更新文件（.next, src, package.json）
# ============================================================================

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 配置
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATE=$(date +%Y%m%d-%H%M%S)
VERSION_SHORT=$(date +%Y%m%d)

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# 检查是否已构建
check_build() {
    if [ ! -d "$PROJECT_DIR/.next" ]; then
        print_warn ".next 目录不存在，开始构建..."
        npm run build
    else
        print_info "检测到 .next 目录，使用现有构建"
    fi
}

# 完整打包（包含 node_modules）
package_full() {
    print_info "开始完整打包（包含 node_modules）..."
    
    OUTPUT_FILE="upload-tool-full-$VERSION_SHORT.tar.gz"
    
    tar -czf "$OUTPUT_FILE" \
        --exclude='.git' \
        --exclude='.env.local' \
        --exclude='uploads' \
        --exclude='*.log' \
        --exclude='.DS_Store' \
        --exclude='node_modules/.cache' \
        --exclude='*.zip' \
        .next node_modules db public src \
        package.json package-lock.json \
        next.config.ts tsconfig.json env.example
    
    print_info "完整打包完成: $OUTPUT_FILE"
    print_info "文件大小: $(du -h $OUTPUT_FILE | cut -f1)"
}

# 轻量打包（不含 node_modules）
package_light() {
    print_info "开始轻量打包（不含 node_modules）..."
    
    OUTPUT_FILE="upload-tool-light-$VERSION_SHORT.tar.gz"
    
    tar -czf "$OUTPUT_FILE" \
        --exclude='.git' \
        --exclude='.env.local' \
        --exclude='uploads' \
        --exclude='*.log' \
        --exclude='.DS_Store' \
        --exclude='*.zip' \
        .next db public src \
        package.json package-lock.json \
        next.config.ts tsconfig.json env.example
    
    print_info "轻量打包完成: $OUTPUT_FILE"
    print_info "文件大小: $(du -h $OUTPUT_FILE | cut -f1)"
    print_warn "注意：部署时需要在服务器上执行 npm install --production"
}

# 更新打包（仅核心文件）
package_update() {
    print_info "开始更新打包（仅核心文件）..."
    
    OUTPUT_FILE="upload-tool-update-$VERSION_SHORT.tar.gz"
    
    tar -czf "$OUTPUT_FILE" \
        .next src package.json package-lock.json
    
    print_info "更新打包完成: $OUTPUT_FILE"
    print_info "文件大小: $(du -h $OUTPUT_FILE | cut -f1)"
    print_warn "这是更新包，仅用于已部署环境的快速更新"
}

# 显示使用说明
show_usage() {
    cat <<EOF
Usage: $0 [选项]

选项:
  --full      完整打包（包含 node_modules, 约 200-500MB）
              适用于: 首次部署，或服务器网络较慢
              
  --light     轻量打包（不含 node_modules, 约 10-50MB）
              适用于: 服务器网络较快，可以快速安装依赖
              部署时需运行: npm install --production
              
  --update    仅更新打包（约 5-20MB）
              适用于: 已部署环境的代码更新
              仅包含: .next, src, package.json
              
  --help      显示此帮助信息

示例:
  $0 --full      # 首次部署推荐
  $0 --light     # 网络好可选此项
  $0 --update    # 快速更新

EOF
}

# 显示上传提示
show_upload_tips() {
    cat <<EOF

${GREEN}================================${NC}
${GREEN}打包完成！接下来的步骤：${NC}
${GREEN}================================${NC}

1. 上传到服务器:
   ${YELLOW}scp $OUTPUT_FILE user@your-server:/tmp/${NC}

2. 或使用 rsync (推荐):
   ${YELLOW}rsync -avz --progress $OUTPUT_FILE user@your-server:/tmp/${NC}

3. 服务器端解压:
   ${YELLOW}cd /opt/upload-tool
   tar -xzf /tmp/$OUTPUT_FILE${NC}

4. 重启应用:
   ${YELLOW}pm2 restart upload-tool${NC}

详细部署指南请参考: ${GREEN}DEPLOY_LINUX.md${NC}

EOF
}

# 主函数
main() {
    cd "$PROJECT_DIR"
    
    # 解析参数
    case "${1:---help}" in
        --full)
            check_build
            package_full
            ;;
        --light)
            check_build
            package_light
            ;;
        --update)
            check_build
            package_update
            ;;
        --help|*)
            show_usage
            exit 0
            ;;
    esac
    
    show_upload_tips
}

main "$@"
