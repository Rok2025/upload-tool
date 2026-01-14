# 项目发布及自动化部署工具 (Upload Tool)

## 工具概述
这是一个集发布包上传、自动化部署、运行日志查看于一体的内部管理工具。

### 核心功能
1. **中转式安全上传**：开发人员将包上传至中转服务器 (1.50 Windows)，控制台自动分发至目标 Linux 测试机。开发人员无法直连目标机。
2. **多模块支持**：针对微服务架构，支持前端及后台 (`gateway`, `system`, `infra`, `eng`) 模块的独立发布。
3. **级联备份策略**：
   - **1.50 服务器**：保留最近 **7 天** 的历史发布包。
   - **目标服务器**：保留最近 **3 天** 的备份包，支持自动滚动清理。
4. **非破坏性部署**：采用“安全重命名”机制，替换包时重命名旧版本而非直接删除，确保秒级回滚。
5. **实时日志穿透**：通过控制台 UI 实时 tail 目标 Linux 服务器上的运行日志。

### 技术架构
- **控制台中枢**: 基于 Next.js，部署于 1.50 Windows，作为唯一安全跳转中心。
- **目标环境**: 华为云等 Linux 测试服务器。
- **配置存储**: MySQL (包含 **AES 加密存储** 的服务器 SSH 凭证)。
- **通讯协议**: SSH/SCP (用于自动化执行及分发)。

### 控制台功能
- **用户认证**: JWT 会话管理，支持登录/登出。
- **用户管理**: 用户 CRUD，角色分配（admin/developer/viewer）。
- **权限控制**: 基于项目的部署权限管理（RBAC）。
- **动态仪表盘**: 实时展示项目数量、模块总数、部署环境、今日发布次数等统计。
- **项目配置管理**: 左侧 Tab 菜单 + 右侧内容的布局，支持部署环境和项目模块的 CRUD。
- **侧边栏导航**: 带图标的菜单项，自动高亮当前页面。
- **实时日志**: 通过 SSE 推送远程服务器的 `tail -f` 日志流。
- **手动服务控制**: 支持独立重启和停止服务，无需重新部署。
- **部署日志分类**: 自动区分发包部署、服务重启、服务停止三种操作类型。
- **部署历史查询**: 支持按项目、模块、服务器、状态、操作类型等多维度筛选。

### 部署流程
`上传 (1.50) -> 归档 (1.50 7天) -> 分发 (B节点) -> 安全更名备份 (B节点 3天) -> 包替换与重启 -> 健康检查`

---

## 安装与部署

> [!NOTE]
> **Windows Server 用户请看这里！** 
> - 📘 **分步操作手册**：[从本地打包到服务器部署的完整流程](./DEPLOY_STEP_BY_STEP.md) ⭐ 推荐
> - 📖 **详细部署指南**：[Windows Server 环境配置和高级设置](./DEPLOY_WINDOWS.md)

### 环境要求

#### 必备软件
- **Node.js**: >= 20.0.0
- **npm**: >= 10.0.0
- **MySQL**: >= 8.0
- **操作系统**: Windows Server (1.50 中转服务器) 或 Linux (开发/测试环境)

#### 目标服务器需求
- 支持 SSH 连接
- 具备 SCP 文件传输能力
- 目标 Linux 服务器需要 Java 运行环境 (如果部署 Java 应用)

### 安装步骤

#### 1. 克隆项目
```bash
git clone <repository-url>
cd upload-tool
```

#### 2. 安装依赖
```bash
npm install
```

#### 3. 数据库初始化

**创建数据库**
```sql
CREATE DATABASE `upload-tool` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**导入数据库结构**
```bash
mysql -u root -p upload-tool < db/schema.sql
```

#### 4. 配置环境变量

**复制环境变量模板**
```bash
cp env.example .env.local
```

**编辑 `.env.local` 文件**
```env
# MySQL 数据库配置
MYSQL_HOST=localhost          # 数据库主机地址
MYSQL_PORT=5836              # 数据库端口
MYSQL_USER=root              # 数据库用户名
MYSQL_PASSWORD=your_password # 数据库密码
MYSQL_DATABASE=upload-tool   # 数据库名称

# AES 加密密钥（用于加密存储 SSH 凭证）
ENCRYPTION_KEY=your_secret_32_char_encryption_key_here

# JWT 认证密钥
JWT_SECRET=your_jwt_secret_key_here

# 文件存储路径
UPLOAD_DIR=./uploads/tmp      # 临时上传目录
STORAGE_DIR=./uploads/archive # 归档存储目录
```

> [!IMPORTANT]
> - `ENCRYPTION_KEY` 必须是 32 字符的字符串（用于 AES-256 加密）
> - `JWT_SECRET` 建议使用至少 64 字符的随机字符串
> - 生产环境请务必修改默认密钥

#### 5. 验证数据库连接
```bash
node check_db.js
```

如果配置正确，将输出数据库连接成功的信息。

### 启动应用

#### 开发模式（推荐用于本地开发）
```bash
npm run dev
```
应用将在 `http://localhost:4000` 启动

#### 生产模式

**构建项目**
```bash
npm run build
```

**启动生产服务器 - Linux**
```bash
npm start
```

**启动生产服务器 - Windows (PowerShell)**
```powershell
.\scripts\restart.ps1
```

**启动生产服务器 - Linux (使用脚本)**
```bash
chmod +x scripts/restart.sh
./scripts/restart.sh
```

> [!TIP]
> 生产环境建议使用 PM2 进行进程管理：
> ```bash
> npm install -g pm2
> pm2 start npm --name "upload-tool" -- start
> pm2 save
> pm2 startup
> ```

### 首次使用

1. **访问应用**: 浏览器打开 `http://localhost:4000`
2. **初始登录**: 使用默认管理员账号登录（请查看数据库初始化脚本中的默认账号）
3. **配置项目**: 进入"配置管理"页面，添加：
   - 部署环境（目标服务器信息 + SSH 凭证）
   - 项目配置
   - 模块配置（含部署命令和重启命令）
4. **上传测试**: 上传发布包测试部署流程

### 目录结构说明

```
upload-tool/
├── db/                    # 数据库脚本
│   └── schema.sql        # 数据库结构
├── public/               # 静态资源
├── scripts/              # 启动脚本
│   ├── restart.sh       # Linux 重启脚本
│   └── restart.ps1      # Windows 重启脚本
├── src/
│   ├── app/             # Next.js 页面和 API 路由
│   ├── components/      # React 组件
│   ├── lib/             # 工具库（数据库、SSH、加密等）
│   └── middleware/      # 中间件（认证等）
├── uploads/             # 上传文件存储（自动创建）
│   ├── tmp/            # 临时文件
│   └── archive/        # 归档文件
├── .env.local          # 环境变量配置（不提交到Git）
├── env.example         # 环境变量模板
└── package.json        # 项目依赖

```

### 常见问题

**Q: 数据库连接失败？**  
A: 检查 `.env.local` 中的数据库配置，确保 MySQL 服务已启动且端口正确。

**Q: 上传失败或部署失败？**  
A: 
- 检查目标服务器 SSH 凭证是否正确
- 确认目标服务器网络可达
- 查看部署历史页面的错误日志

**Q: 如何修改端口？**  
A: 修改 `package.json` 中的 `scripts.dev` 和 `scripts.start`，将 `-p 4000` 改为其他端口。

**Q: 如何备份数据？**  
A: 
```bash
mysqldump -u root -p upload-tool > backup_$(date +%Y%m%d).sql
```

### 安全建议

> [!CAUTION]
> 生产环境部署时，请务必：
> - 修改所有默认密码和密钥
> - 启用 HTTPS（配置反向代理如 Nginx）
> - 限制数据库仅允许本地访问
> - 定期更新依赖包（`npm audit fix`）
> - 配置防火墙规则，仅开放必要端口
> - 定期备份数据库和上传文件

### 技术支持

如有问题，请查看[项目编码指南.md](./项目编码指南.md)或联系开发团队。