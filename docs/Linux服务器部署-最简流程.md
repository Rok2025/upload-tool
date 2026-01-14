# Linux 服务器部署 - 最简流程

> **核心思路**：本地打包 → 上传服务器 → 解压 → PM2 启动 ✅

---

## 🎯 三步部署法

### 步骤 1️⃣：本地打包 (在你的 Mac 上）

```bash
cd /Users/freeman/Documents/00-Project/upload-tool

# 构建生产版本
npm run build

# 打包（包含 node_modules，可直接运行）
./package-for-linux.sh --full

# 生成文件：upload-tool-full-YYYYMMDD.tar.gz
```

---

### 步骤 2️⃣：上传到服务器

```bash
# 上传打包文件
scp upload-tool-full-20260114.tar.gz root@your-server-ip:/opt/

# 或者使用 rsync（断点续传）
rsync -avz --progress upload-tool-full-20260114.tar.gz root@your-server-ip:/opt/
```

---

### 步骤 3️⃣：服务器解压和启动

```bash
# SSH 登录服务器
ssh root@your-server-ip

# 解压到部署目录
cd /opt
mkdir -p upload-tool
tar -xzf upload-tool-full-20260114.tar.gz -C upload-tool/
cd upload-tool

# 配置环境变量（首次需要）
cp env.example .env.local
nano .env.local  # 修改数据库密码等配置

# 创建必要目录
mkdir -p uploads/tmp uploads/archive logs

# 使用 PM2 启动
pm2 start npm --name "upload-tool" -- start

# 查看状态
pm2 status
pm2 logs upload-tool

# 保存配置（开机自启）
pm2 save
pm2 startup  # 执行输出的命令
```

**完成！** 访问 `http://your-server-ip:4000`

---

## 📝 首次部署需要的前置条件

### 在服务器上安装（仅首次需要）：

```bash
# 1. Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. PM2
sudo npm install -g pm2

# 3. MySQL（如果数据库在同一服务器）
sudo apt-get install -y mysql-server
# 创建数据库
mysql -u root -p
CREATE DATABASE upload_tool CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

---

## 🔄 日常更新（更快）

```bash
# 本地打包更新版（只打包变化的文件，更小更快）
./package-for-linux.sh --update

# 上传
scp upload-tool-update-20260114.tar.gz root@server:/tmp/

# 服务器上更新
ssh root@server
cd /opt/upload-tool
pm2 stop upload-tool
tar -xzf /tmp/upload-tool-update-20260114.tar.gz  # 覆盖旧文件
pm2 restart upload-tool
pm2 logs upload-tool  # 确认启动成功
```

---

## 💡 关键说明

### ✅ 为什么可以直接启动？

因为完整打包（`--full`）包含了：
- ✅ `.next/` - 已编译的生产代码
- ✅ `node_modules/` - 所有依赖包
- ✅ `src/` - 源代码
- ✅ `package.json` - 配置文件

**无需在服务器上运行 `npm install`！**

### 📦 三种打包模式

| 模式 | 命令 | 大小 | 适用场景 |
|------|------|------|----------|
| **完整** | `--full` | ~300MB | 首次部署、服务器网络慢 |
| **轻量** | `--light` | ~10MB | 服务器网络快（需运行 npm install） |
| **更新** | `--update` | ~5MB | 日常代码更新 |

### ⚙️ PM2 常用命令

```bash
pm2 list                    # 查看所有应用
pm2 status upload-tool      # 查看状态
pm2 logs upload-tool        # 实时日志
pm2 restart upload-tool     # 重启
pm2 stop upload-tool        # 停止
pm2 delete upload-tool      # 删除
pm2 monit                   # 资源监控
```

---

## 🚀 完整流程示例

```bash
# ========== 本地（Mac）==========
cd /Users/freeman/Documents/00-Project/upload-tool
npm run build
./package-for-linux.sh --full
scp upload-tool-full-20260114.tar.gz root@192.168.1.100:/opt/

# ========== 服务器 ==========
ssh root@192.168.1.100
cd /opt
tar -xzf upload-tool-full-20260114.tar.gz -C upload-tool/
cd upload-tool
cp env.example .env.local
nano .env.local  # 修改配置
mkdir -p uploads/tmp uploads/archive logs

# 导入数据库（首次）
mysql -u root -p upload_tool < db/schema.sql

# 启动
pm2 start npm --name "upload-tool" -- start
pm2 save
pm2 startup

# 查看
pm2 logs upload-tool
```

**访问**: `http://192.168.1.100:4000`

---

## ❓ 常见问题

**Q: 必须先安装 MySQL 吗？**  
A: 不一定。如果使用远程 MySQL，只需在 `.env.local` 中配置远程地址即可。

**Q: 端口 4000 被占用怎么办？**  
A: 修改 `package.json` 中的 `"start": "next start -p 4000"` 改为其他端口。

**Q: 如何配置 HTTPS？**  
A: 参考 [DEPLOY_LINUX.md](./DEPLOY_LINUX.md) 中的 Nginx + Let's Encrypt 配置。

**Q: 忘记数据库密码怎么办？**  
A: 查看 `.env.local` 文件：`cat .env.local | grep MYSQL_PASSWORD`

---

## 📚 更多资源

- **详细部署指南**: [DEPLOY_LINUX.md](./DEPLOY_LINUX.md)
- **自动化部署脚本**: `./deploy-linux.sh`
- **Nginx 配置模板**: `nginx-config-template.conf`
- **数据库备份脚本**: `scripts/backup-db.sh`

---

**就这么简单！** 🎉
