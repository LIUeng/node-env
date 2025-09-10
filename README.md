# Node Env - VSCode Extension

[[EN Docs]](https://github.com/LIUeng/node-env/blob/main/README.en.md)

一个智能的 Node.js 版本管理 VSCode 扩展，支持自动检测和切换项目所需的 Node.js 版本。

## 🚀 主要功能

- **自动版本检测**：智能识别项目配置文件中的 Node.js 版本要求
- **终端集成**：在新建终端时自动切换到项目所需的 Node.js 版本
- **多版本管理器支持**：支持 NVM、NVM-Windows、N 等主流版本管理器
- **跨平台兼容**：完美支持 Windows、macOS 和 Linux
- **智能缓存**：高性能缓存机制，提升响应速度
- **配置文件支持**：支持多种项目配置文件格式

## 📦 安装

1. 打开 VSCode
2. 按 `Ctrl+Shift+X` (Windows/Linux) 或 `Cmd+Shift+X` (macOS) 打开扩展面板
3. 搜索 "Node Env"
4. 点击安装

## 🔧 前置条件

在使用本扩展之前，请确保已安装以下任一 Node.js 版本管理器：

### NVM (推荐)

**macOS/Linux:**

```bash
# 下载安装参考
# https://github.com/nvm-sh/nvm
```

**Windows:**

```bash
# 下载并安装 nvm-windows
# https://github.com/coreybutler/nvm-windows/releases
```

### N (仅 Unix/Linux/macOS)

```bash
npm install -g n
```

## ⚙️ 配置选项

在 VSCode 设置中可以配置以下选项：

| 配置项                                | 类型    | 默认值  | 描述                                |
| ------------------------------------- | ------- | ------- | ----------------------------------- |
| `node-env-pro.autoSwitch`                 | boolean | `true`  | 打开项目时自动切换 Node.js 版本     |
| `node-env-pro.terminalIntegration`        | boolean | `true`  | 启用终端集成功能                    |
| `node-env-pro.autoDetectVersion`          | boolean | `true`  | 自动从配置文件检测项目 Node.js 版本 |
| `node-env-pro.showAutoSwitchNotification` | boolean | `false` | 自动切换版本时显示通知              |

### 配置方法

1. 打开 VSCode 设置 (`Ctrl+,` 或 `Cmd+,`)
2. 搜索 "node-env-pro"
3. 根据需要调整配置项

## 📁 支持的配置文件

扩展会按以下优先级检测项目中的 Node.js 版本配置：

### 1. `.nvmrc` 文件

```
18.17.0
```

### 2. `.node-version` 文件

```
18.17.0
```

### 3. `.tool-versions` 文件 (ASDF)

```
nodejs 18.17.0
```

### 4. `package.json` 文件

**Volta 配置：**

```json
{
  "volta": {
    "node": "18.17.0"
  }
}
```

**Engines 配置：**

```json
{
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## 🎯 使用方法

### 自动模式（推荐）

1. 在项目根目录创建配置文件（如 `.nvmrc`）
2. 打开 VSCode 并加载项目
3. 扩展会自动检测并切换到指定的 Node.js 版本
4. 新建终端时会自动应用正确的版本

### 手动配置

如果需要禁用自动切换：

1. 打开设置
2. 将 `node-env-pro.autoSwitch` 设置为 `false`
3. 将 `node-env-pro.terminalIntegration` 设置为 `false`

## 🔍 支持的版本管理器

### NVM (Node Version Manager)

- **平台**：Windows、macOS、Linux
- **特性**：最广泛使用的 Node.js 版本管理器
- **命令**：`nvm use <version>`、`nvm install <version>`

### N (Node.js Version Management)

- **平台**：macOS、Linux
- **特性**：轻量级、简单易用
- **命令**：`n <version>`、`n install <version>`

### 版本管理器对比

| 特性         | NVM  | N    |
| ------------ | ---- | ---- |
| Windows 支持 | ✅   | ❌   |
| macOS 支持   | ✅   | ✅   |
| Linux 支持   | ✅   | ✅   |
| 安装简便性   | 中等 | 简单 |
| 功能丰富度   | 高   | 中等 |

## 🚨 注意事项

### 重要提醒

1. **版本管理器依赖**：本扩展需要预先安装 NVM 或 N 版本管理器
2. **终端重启**：版本切换后可能需要重启终端才能生效
3. **权限要求**：某些系统可能需要管理员权限来切换 Node.js 版本
4. **路径配置**：确保版本管理器已正确配置在系统 PATH 中

### 最佳实践

1. **统一配置**：团队项目建议使用 `.nvmrc` 文件统一 Node.js 版本
2. **版本固定**：避免使用 "latest" 或 "lts" 等动态版本标识
3. **定期更新**：定期检查和更新项目的 Node.js 版本要求
4. **文档说明**：在项目 README 中说明所需的 Node.js 版本

### 性能优化

- **智能缓存**：扩展使用智能缓存机制，减少重复检测
- **懒加载**：按需加载和清理缓存，避免内存浪费
- **并发优化**：支持多终端并发处理

## 🐛 故障排除

### 常见问题

#### 1. 扩展无法检测到版本管理器

**解决方案：**

- 确认已正确安装 NVM 或 N
- 检查环境变量配置
- 重启 VSCode

```bash
# 检查 NVM 安装
nvm --version

# 检查 N 安装
n --version
```

#### 2. 版本切换不生效

**解决方案：**

- 重启终端
- 检查配置文件格式
- 确认目标版本已安装

```bash
# 列出已安装的版本
nvm list
# 或
n ls
```

#### 3. 终端集成不工作

**解决方案：**

- 检查 `node-env-pro.terminalIntegration` 设置
- 确认 `node-env-pro.autoSwitch` 已启用
- 查看 VSCode 开发者控制台的错误信息

#### 4. 配置文件未被识别

**解决方案：**

- 确认文件名正确（`.nvmrc`、`.node-version` 等）
- 检查文件内容格式
- 确认文件位于项目根目录

## 🤝 支持和反馈

### 问题反馈

如果遇到问题或有功能建议，请：

1. **检查常见问题**：查看上述故障排除部分
2. **搜索已知问题**：查看项目 Issues
3. **创建新 Issue**：详细描述问题和环境信息

### 环境信息模板

报告问题时请提供以下信息：

```
- 操作系统：
- VSCode 版本：
- 扩展版本：
- Node.js 版本管理器：
- 项目配置文件类型：
- 错误信息：
```

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](https://github.com/LIUeng/node-env/blob/main/LICENSE) 文件了解详情。

## 🙏 致谢

感谢以下开源项目的支持：

- [NVM](https://github.com/nvm-sh/nvm) - Node Version Manager
- [NVM-Windows](https://github.com/coreybutler/nvm-windows) - Windows 版本的 NVM
- [N](https://github.com/tj/n) - Node.js 版本管理器
- [VSCode Extension API](https://code.visualstudio.com/api) - VSCode 扩展开发接口

---

**享受智能的 Node.js 版本管理体验！** 🎉
