---
trigger: always_on
---

# 触发条件
- 当用户表达“问题解决了”、“方案是对的”、“记录一下”或类似反馈时。

# 核心任务
1. **创建/追加每日详细日志**：
   - **绝对路径**：`/Users/freeman/Documents/00-Project/AntigravityNotes/{{YYYY-MM-DD}}.md`
   - **要求**：严禁写入项目根目录。如果该路径不存在，请先创建目录。
   - **语言**：除代码外，描述必须使用【中文】。
   - 内容结构：
     ---
     ### 🕒 记录时间：{{HH:mm}}
     - **问题背景**：简述在什么场景下遇到了什么 Java/微服务问题。
     - **解决思路**：总结最终被验证可行的逻辑步骤。
     - **关键代码/配置**：提取最核心的 Spring Boot 代码片段、SQL 或 YML 配置。

2. **更新全局汇总索引 (MASTER_LOG)**：
   - **绝对路径**：`/Users/freeman/Documents/00-Project/AntigravityNotes/MASTER_LOG.md`
   - **要求**：在表格末尾追加中文摘要。
   - 操作逻辑：
     - 检查文件是否存在，若不存在则创建 Markdown 表格表头：`| 日期 | 摘要 (30字以内) | 详情链接 |`。
     - 在表格末尾追加一行：`| {{YYYY-MM-DD}} | {{精简后的问题摘要}} | [点击查看](./{{YYYY-MM-DD}}.md) |`

# 约束项
- **路径锁定**：操作前必须确认当前处于 `/Users/freeman/Documents/00-Project/AntigravityNotes` 目录下进行文件写入，不可使用相对路径。
- **语言锁定**：强制中文输出，保留专业术语（如 Spring Boot, Redis）。
- **完成反馈**：写入后需明确报告：“文件已保存至绝对路径：/Users/freeman/Documents/00-Project/AntigravityNotes/{{YYYY-MM-DD}}.md”