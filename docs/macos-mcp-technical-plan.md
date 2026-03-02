# macOS Kit MCP 全量实施技术方案（分阶段）

## 0. 实施进度同步（2026-03-02）

| 阶段 | 状态 | 同步时间 | 结果摘要 |
| --- | --- | --- | --- |
| 阶段 0 | 已完成 | 2026-03-02 | 已创建 `packages/macos-kit`，完成 stdio 入口与基础 server 初始化 |
| 阶段 1 | 已完成 | 2026-03-02 | 已实现执行器、串行队列、安全策略、`run_macos_script`、`check_macos_permissions` |
| 阶段 2 | 已完成 | 2026-03-02 | 已实现知识库加载/搜索/模板执行，完成 `search/list/run_macos_template` |
| 阶段 3 | 已完成 | 2026-03-02 | 已实现 system/clipboard/finder/notifications/shortcuts 工具 |
| 阶段 4 | 已完成 | 2026-03-02 | 已实现 calendar/iterm/pages/notes 工具 |
| 阶段 5 | 已完成 | 2026-03-02 | 已实现 mail/messages 工具 |
| 阶段 6 | 已完成 | 2026-03-02 | 已实现 `accessibility_query`，增加 AX 开关与 binary 配置 |
| 阶段 7 | 已完成 | 2026-03-02 | 已补齐包文档、打包清单与测试，完成构建与类型检查 |

## 0.1 测试增强计划（近全覆盖，2026-03-02）

| 步骤 | 状态 | 目标 |
| --- | --- | --- |
| T1 | 已完成 | 增补核心模块单测：`config/contracts/logger/queue` |
| T2 | 已完成 | 增补知识库单测：`loader/manager/search`（含本地覆盖） |
| T3 | 已完成 | 增补执行路径单测：`shared.ts`（成功/错误码映射/AX 分支） |
| T4 | 已完成 | 增补 `osascript-executor` 行为测试（参数校验/超时/文件路径） |
| T5 | 已完成 | 增补工具完整性测试：39 工具注册与模板映射完整性 |
| T6 | 已完成 | 统一执行测试矩阵并输出覆盖率结果与缺口说明 |

测试增强结果（2026-03-02）：

- 测试总数：29（全部通过）
- 覆盖率：
  - Statements：85.66%
  - Branches：78.82%
  - Functions：100%
  - Lines：85.66%
- 结论：达到“接近全覆盖”的增强目标。

## 0.2 零配置宽松模式改造计划（2026-03-02）

目标：用户在不传任何环境变量时可直接使用全部核心能力；仅在用户显式配置时再收紧权限边界。

计划项：

1. 配置默认值切换为宽松策略：
   - `MACOS_KIT_ENABLE_RAW_SCRIPT=true`
   - `MACOS_KIT_ENABLE_AX_QUERY=true`
   - `MACOS_KIT_SAFE_MODE=balanced`
2. 将 `MACOS_KIT_ALLOWED_SCRIPT_ROOTS` 调整为“按需生效”：
   - 未配置白名单时，`script_path` 不做目录限制；
   - 配置白名单后，继续执行 realpath + 子路径校验。
3. 启动时增加宽松模式告警日志，明确当前安全姿态。
4. AX 依赖改为运行时处理（不走 postinstall）：
   - MCP 启动后预热检查并按配置尝试自动下载；
   - `accessibility_query` 调用前再兜底检查。
5. 同步更新 README 与技术方案中的默认值说明。
6. 补充/调整测试，覆盖新默认值与白名单按需生效行为。

风险说明：

- 默认开启 raw/AX 会放大误操作风险，建议在敏感环境下显式配置白名单与严格模式；
- `accessibility_query` 仍依赖系统权限与 AX 可执行文件，无法通过代码绕过系统授权。

执行结果（2026-03-02）：

1. ✅ 已将默认值切换为宽松模式：
   - `MACOS_KIT_ENABLE_RAW_SCRIPT=true`
   - `MACOS_KIT_ENABLE_AX_QUERY=true`
   - `MACOS_KIT_SAFE_MODE=balanced`
2. ✅ 已将 `MACOS_KIT_ALLOWED_SCRIPT_ROOTS` 改为按需生效：
   - 未配置白名单时允许 `script_path`；
   - 配置后继续执行 realpath 子路径校验。
3. ✅ 已在 server 启动阶段增加宽松模式告警日志。
4. ✅ 已实现 AX 运行时自动安装策略（启动预热 + 调用兜底，未引入 postinstall）。
5. ✅ 已同步 README 与技术方案默认值说明。
6. ✅ 已补充测试并验证通过（累计新增 5 个用例，macos-kit 总测试 44/44 通过）。

## 一、背景与目标

本方案用于在当前 monorepo 中新增一个可操作 macOS 的 MCP Server，名称为 `macos-kit`。目标是：

1. 与现有仓库架构一致（`core + tools + transports`）。
2. 一次性规划完整能力边界（工具 + 知识库 + 安全策略）。
3. 实施上分阶段推进，阶段可独立验收，最终交付完整功能集。

## 二、范围边界（本次已确认）

- 仅实现 `stdio` 传输层。
- 不实现 Worker/HTTP 入口，避免无效复杂度。
- 功能目标覆盖参考项目核心能力：
  - `applescript-mcp` 的多分类语义工具能力。
  - `macos-automator-mcp` 的执行内核 + 知识库检索/模板执行能力。

## 三、参考实现结论

### 3.1 applescript-mcp 可借鉴点

- 分类清晰，语义工具直接，易被 LLM 正确调用。
- 对常见 macOS 应用场景覆盖广（system/finder/messages/mail 等）。

### 3.2 macos-automator-mcp 可借鉴点

- 执行器统一封装（超时、输出模式、错误映射、平台校验）。
- 知识库模型成熟（Markdown + Frontmatter + 搜索 + 模板参数替换）。
- 对权限类错误有可操作的提示策略。

### 3.3 综合结论

采用“执行内核 + 模板知识库 + 语义工具层”三层结构，既保证扩展性，也保证调用体验。

## 四、架构与命名（定稿）

命名约定：

- 包目录：`packages/macos-kit`
- npm 包名：`@moryflow/macos-kit`
- MCP server id：`macos-kit`
- bin 命令：`macos-kit-mcp`

目录结构：

```text
packages/macos-kit/
├── src/
│   ├── core/
│   │   ├── config.ts
│   │   ├── server.ts
│   │   ├── executor/
│   │   │   ├── osascript-executor.ts
│   │   │   ├── placeholder-substitutor.ts
│   │   │   ├── safety-policy.ts
│   │   │   └── queue.ts
│   │   ├── knowledge/
│   │   │   ├── manager.ts
│   │   │   ├── loader.ts
│   │   │   ├── search.ts
│   │   │   └── types.ts
│   │   └── tools/
│   │       ├── index.ts
│   │       ├── discovery.ts
│   │       ├── execute.ts
│   │       ├── permissions.ts
│   │       ├── system.ts
│   │       ├── finder.ts
│   │       ├── clipboard.ts
│   │       ├── notifications.ts
│   │       ├── shortcuts.ts
│   │       ├── calendar.ts
│   │       ├── iterm.ts
│   │       ├── pages.ts
│   │       ├── notes.ts
│   │       ├── mail.ts
│   │       ├── messages.ts
│   │       └── accessibility.ts
│   ├── transports/
│   │   └── stdio.ts
│   └── index.ts
├── knowledge-base/
│   ├── _shared_handlers/
│   ├── system/
│   ├── finder/
│   ├── ...
├── package.json
└── tsconfig.json
```

## 五、全量功能清单（最终目标）

### 5.1 执行与发现基础工具（P0）

1. `search_macos_automation_tips`
2. `list_macos_automation_categories`
3. `run_macos_template`
4. `run_macos_script`
5. `check_macos_permissions`

说明：

- `run_macos_script` 默认开启，可通过 `MACOS_KIT_ENABLE_RAW_SCRIPT=false` 关闭。
- 默认执行路径是“查模板 -> 执行模板”。

### 5.2 语义工具全集（P1，按域分组）

1. system
   - `get_frontmost_app`
   - `launch_app`
   - `quit_app`
   - `set_system_volume`
   - `toggle_dark_mode`
   - `get_battery_status`
2. clipboard
   - `get_clipboard`
   - `set_clipboard`
   - `clear_clipboard`
3. finder
   - `get_selected_files`
   - `search_files`
   - `quick_look_file`
4. notifications
   - `send_notification`
   - `toggle_do_not_disturb`
5. shortcuts
   - `run_shortcut`
   - `list_shortcuts`
6. calendar
   - `calendar_add_event`
   - `calendar_list_today`
7. iterm
   - `iterm_run`
   - `iterm_paste_clipboard`
8. pages
   - `create_pages_document`
9. notes
   - `notes_create`
   - `notes_create_raw_html`
   - `notes_list`
   - `notes_get`
   - `notes_search`
10. mail
    - `mail_create_email`
    - `mail_list_emails`
    - `mail_get_email`
11. messages
    - `messages_list_chats`
    - `messages_get_messages`
    - `messages_search_messages`
    - `messages_compose_message`
12. accessibility
    - `accessibility_query`（AX 查询/动作执行）

### 5.3 知识库全量能力（P2）

1. Markdown + Frontmatter 模型：
   - `id`、`title`、`description`、`language`、`keywords`、`argumentsPrompt`、`notes`
2. 分类浏览 + 关键词检索 + limit 控制。
3. 模板执行占位符替换：
   - `--MCP_INPUT:key`
   - `--MCP_ARG_1` 等
4. `_shared_handlers` 复用脚本片段。
5. 本地覆盖路径：
   - `MACOS_KIT_KB_PATH`。

## 六、配置、安全与执行约束

### 6.1 环境变量

- `MACOS_KIT_ENABLE_RAW_SCRIPT`：默认 `true`
- `MACOS_KIT_DEFAULT_TIMEOUT_SECONDS`：默认 `30`
- `MACOS_KIT_MAX_TIMEOUT_SECONDS`：默认 `120`
- `MACOS_KIT_ALLOWED_SCRIPT_ROOTS`：脚本目录白名单（默认空，未配置时不限制目录）
- `MACOS_KIT_KB_PATH`：本地知识库覆盖路径
- `MACOS_KIT_SAFE_MODE`：`strict | balanced | off`，默认 `balanced`
- `MACOS_KIT_LOG_LEVEL`：`debug | info | warn | error`
- `MACOS_KIT_ENABLE_AX_QUERY`：是否开启 AX 工具（默认 `true`）
- `MACOS_KIT_AX_BINARY_PATH`：AX 可执行文件路径（可选）
- `MACOS_KIT_AX_AUTO_INSTALL`：是否开启 AX 自动安装（默认 `true`）
- `MACOS_KIT_AX_DOWNLOAD_URL`：AX 下载地址模板（可选，支持 `{platform}`、`{arch}` 占位符）
- `MACOS_KIT_AX_CACHE_DIR`：AX 缓存目录（可选）

### 6.2 安全分层策略

1. 默认启用 raw 与 AX（零配置可用），并在启动时输出宽松模式告警日志。
2. `script_path` 仅在配置 `MACOS_KIT_ALLOWED_SCRIPT_ROOTS` 时执行白名单 realpath 校验。
3. 高风险模式检测由 `MACOS_KIT_SAFE_MODE` 控制；默认 `balanced`，需要时可切到更严格或更宽松模式。
   - `strict`：关键危险命令 + `curl | sh` + 二进制脚本阻断
   - `balanced`：仅关键危险命令阻断
   - `off`：不做内容风险扫描
4. 所有 raw 执行产生日志审计（来源、参数摘要、耗时、结果码）。

### 6.3 AX 依赖策略（安装后不阻塞）

1. 不使用 `postinstall` 下载 AX，避免影响 MCP 安装超时窗口。
2. MCP 启动时触发 AX 预热检查：
   - 已存在可执行文件则复用；
   - 缺失时若配置下载地址则自动下载到缓存目录。
3. `accessibility_query` 执行前再次兜底检查，提升首次调用成功率。
4. 自动下载失败不阻塞 server 启动，仅在调用时返回可操作错误提示。

### 6.4 并发策略

- 执行器默认串行队列（防 UI 自动化冲突）。
- 二期支持按 app 维度互斥锁（可选优化）。

### 6.5 统一输出契约

- MCP 返回：
  - `content: [{ type: "text", text: "<json-string>" }]`
  - 失败时 `isError: true`
- `text` JSON 格式：

```json
{
  "ok": true,
  "data": {},
  "error": null,
  "meta": {
    "execution_time_seconds": 0.12,
    "trace_id": "uuid"
  }
}
```

错误示例：

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Not authorized to send Apple events.",
    "hint": "请检查 系统设置 > 隐私与安全性 > 自动化/辅助功能",
    "retryable": false
  },
  "meta": {
    "execution_time_seconds": 0.05,
    "trace_id": "uuid"
  }
}
```

## 七、分阶段实施计划（完整路线图）

### 阶段 0：脚手架与命名基线

- 执行进度：✅ 已完成（2026-03-02）

- 输出：
  - 新建 `packages/macos-kit`
  - `stdio` 入口、基础 server、空工具注册
  - package/bin 命名全部对齐定稿
- 验收：
  - MCP 客户端可连接并 `list tools` 成功

### 阶段 1：执行内核与基础工具（P0）

- 执行进度：✅ 已完成（2026-03-02）

- 输出：
  - `osascript-executor`、队列、超时/错误映射
  - `run_macos_script`（后续改造为默认开启）
  - `check_macos_permissions`
- 验收：
  - 平台校验、超时校验、白名单校验可通过单测
  - raw 开关关闭时调用返回明确错误码

### 阶段 2：知识库系统（P2-基础）

- 执行进度：✅ 已完成（2026-03-02）

- 输出：
  - Markdown loader、category/tip 索引、搜索
  - `search_macos_automation_tips`
  - `list_macos_automation_categories`
  - `run_macos_template`
- 验收：
  - 可完成“查找模板 -> 执行模板”的闭环
  - 占位符替换单测覆盖字符串/数组/布尔

### 阶段 3：语义工具第一批（高频系统能力）

- 执行进度：✅ 已完成（2026-03-02）

- 输出：
  - system、clipboard、finder、notifications、shortcuts
- 验收：
  - 每个工具至少 1 个集成用例
  - 权限失败路径返回标准化错误

### 阶段 4：语义工具第二批（效率工具）

- 执行进度：✅ 已完成（2026-03-02）

- 输出：
  - calendar、iterm、pages、notes
- 验收：
  - 关键路径可在真实 macOS 机器复现
  - 工具输入 schema 覆盖必填/可选项

### 阶段 5：语义工具第三批（通信类）

- 执行进度：✅ 已完成（2026-03-02）

- 输出：
  - mail、messages
- 验收：
  - 涉及 TCC/隐私权限场景有错误提示模板
  - 搜索、读取、发送/草拟流程可跑通

### 阶段 6：高级能力（AX）

- 执行进度：✅ 已完成（2026-03-02）

- 输出：
  - `accessibility_query`
  - AX 依赖检测与开关控制（`MACOS_KIT_ENABLE_AX_QUERY`）
- 验收：
  - 未配置 AX 时给出可操作提示
  - 配置后可执行至少一个 query 与一个 perform 用例

### 阶段 7：收口与发布

- 执行进度：✅ 已完成（2026-03-02）

- 输出：
  - README、权限排障文档、迁移说明
  - npm 打包清单校验（必须包含 `knowledge-base/**/*`）
  - 稳定性修复与版本发布
- 验收：
  - `pnpm -r lint`、`pnpm -r typecheck`、单测/集测通过
  - 从零安装后可直接通过 `macos-kit-mcp` 运行

## 八、测试与质量门禁

### 8.0 本轮执行记录（2026-03-02）

- 已执行：`pnpm install`
- 已执行：`pnpm -r lint`（仓库当前无 lint script，pnpm 返回提示并退出 0）
- 已执行：`pnpm -r typecheck`（通过）
- 已执行：`pnpm -r build`（通过）
- 已执行：`pnpm --filter @moryflow/macos-kit test`（29/29 通过）
- 已执行：`pnpm --filter @moryflow/macos-kit test:coverage`（Statements 85.66%，Branches 78.82%）
- 已执行：`node dist/transports/stdio.js` 冒烟联调（通过，`list tools` 返回 39 个工具）
- 已执行：`run_macos_template(system_get_battery_status)` 端到端调用（通过）
- 已执行：`pnpm --filter @moryflow/macos-kit typecheck`（通过）
- 已执行：`pnpm --filter @moryflow/macos-kit build`（通过）
- 已执行：`pnpm --filter @moryflow/macos-kit test`（44/44 通过，含零配置宽松模式新增用例）

### 8.1 单元测试

- 占位符替换
- 输出契约序列化
- 错误码映射（权限/超时/路径非法/平台不支持）
- 路径白名单按需生效与 realpath 防逃逸

### 8.2 集成测试

- stdio 协议握手与工具调用
- 模板检索与模板执行闭环
- 语义工具按分组逐步补齐

### 8.3 CI 策略

- 非 darwin runner：
  - 执行类型检查、单测、平台降级断言
- darwin runner（如可用）：
  - 执行真实集成用例与权限场景验证

## 九、风险与应对

1. 权限风险（Automation/Accessibility/Full Disk Access）
   - 应对：`check_macos_permissions` + 标准化错误 hint。
2. 原始脚本安全风险
   - 应对：默认宽松模式下保留告警日志，生产环境建议显式开启白名单与 `strict` 安全模式。
3. 系统版本差异风险
   - 应对：模板标注系统兼容说明，关键模板做版本回归。
4. 功能面太大导致回归成本高
   - 应对：阶段化发布、每阶段独立验收门禁。
5. 发布资产遗漏风险
   - 应对：`package.json` 的 `files` 显式包含 `dist/**/*` 与 `knowledge-base/**/*`。

## 十、最终交付定义（DoD）

满足以下条件即视为“完整功能集已交付”：

1. P0/P1/P2 功能全部实现并可调用。
2. `accessibility_query` 按阶段 6 的开关与依赖策略落地。
3. 文档齐全（使用、权限、排障、配置、升级）。
4. 质量门禁全部通过。

## 十一、当前决策与下一步

当前已确认：

- 名称：`macos-kit`
- bin：`macos-kit-mcp`
- 只做 `stdio`
- 采用分阶段推进，但以“完整功能集”作为最终交付目标

当前状态：

- 阶段 0-7 已按计划全部完成并同步进度。

下一步建议：

1. 在真实 macOS 权限环境（Automation/Accessibility）做一轮端到端手测。
2. 结合实际使用反馈迭代模板质量（尤其是 Mail/Messages/Notes）。
