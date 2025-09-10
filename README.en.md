# Node Env - VSCode Extension

An intelligent Node.js version management VSCode extension that supports automatic detection and switching of Node.js versions required by projects.

## 🚀 Key Features

- **Automatic Version Detection**: Intelligently identifies Node.js version requirements from project configuration files
- **Terminal Integration**: Automatically switches to the required Node.js version when creating new terminals
- **Multiple Version Manager Support**: Supports mainstream version managers like NVM, NVM-Windows, N, etc.
- **Cross-Platform Compatibility**: Perfect support for Windows, macOS, and Linux
- **Smart Caching**: High-performance caching mechanism to improve response speed
- **Configuration File Support**: Supports multiple project configuration file formats

## 📦 Installation

1. Open VSCode
2. Press `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (macOS) to open the Extensions panel
3. Search for "Node Env"
4. Click Install

## 🔧 Prerequisites

Before using this extension, please ensure you have installed one of the following Node.js version managers:

### NVM (Recommended)

**macOS/Linux:**

```bash
# Download and install from
# https://github.com/nvm-sh/nvm
```

**Windows:**

```bash
# Download and install nvm-windows
# https://github.com/coreybutler/nvm-windows/releases
```

### N (Unix/Linux/macOS only)

```bash
npm install -g n
```

## ⚙️ Configuration Options

You can configure the following options in VSCode settings:

| Configuration                         | Type    | Default | Description                                    |
| ------------------------------------- | ------- | ------- | ---------------------------------------------- |
| `node-env-pro.autoSwitch`                 | boolean | `true`  | Automatically switch Node.js version on open  |
| `node-env-pro.terminalIntegration`        | boolean | `true`  | Enable terminal integration functionality      |
| `node-env-pro.autoDetectVersion`          | boolean | `true`  | Auto-detect project Node.js version from files|
| `node-env-pro.showAutoSwitchNotification` | boolean | `false` | Show notification when auto-switching versions|

### Configuration Method

1. Open VSCode Settings (`Ctrl+,` or `Cmd+,`)
2. Search for "node-env-pro"
3. Adjust configuration items as needed

## 📁 Supported Configuration Files

The extension detects Node.js version configuration in projects with the following priority:

### 1. `.nvmrc` file

```
18.17.0
```

### 2. `.node-version` file

```
18.17.0
```

### 3. `.tool-versions` file (ASDF)

```
nodejs 18.17.0
```

### 4. `package.json` file

**Volta Configuration:**

```json
{
  "volta": {
    "node": "18.17.0"
  }
}
```

**Engines Configuration:**

```json
{
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## 🎯 Usage

### Automatic Mode (Recommended)

1. Create a configuration file (e.g., `.nvmrc`) in the project root directory
2. Open VSCode and load the project
3. The extension will automatically detect and switch to the specified Node.js version
4. New terminals will automatically apply the correct version

### Manual Configuration

If you need to disable automatic switching:

1. Open Settings
2. Set `node-env-pro.autoSwitch` to `false`
3. Set `node-env-pro.terminalIntegration` to `false`

## 🔍 Supported Version Managers

### NVM (Node Version Manager)

- **Platforms**: Windows, macOS, Linux
- **Features**: Most widely used Node.js version manager
- **Commands**: `nvm use <version>`, `nvm install <version>`

### N (Node.js Version Management)

- **Platforms**: macOS, Linux
- **Features**: Lightweight and easy to use
- **Commands**: `n <version>`, `n install <version>`

### Version Manager Comparison

| Feature          | NVM  | N      |
| ---------------- | ---- | ------ |
| Windows Support  | ✅   | ❌     |
| macOS Support    | ✅   | ✅     |
| Linux Support    | ✅   | ✅     |
| Installation     | Medium | Simple |
| Feature Richness | High | Medium |

## 🚨 Important Notes

### Important Reminders

1. **Version Manager Dependency**: This extension requires pre-installation of NVM or N version manager
2. **Terminal Restart**: You may need to restart the terminal after version switching to take effect
3. **Permission Requirements**: Some systems may require administrator privileges to switch Node.js versions
4. **Path Configuration**: Ensure the version manager is properly configured in the system PATH

### Best Practices

1. **Unified Configuration**: Team projects should use `.nvmrc` files to unify Node.js versions
2. **Fixed Versions**: Avoid using dynamic version identifiers like "latest" or "lts"
3. **Regular Updates**: Regularly check and update project Node.js version requirements
4. **Documentation**: Document the required Node.js version in the project README

### Performance Optimization

- **Smart Caching**: The extension uses intelligent caching mechanisms to reduce redundant detection
- **Lazy Loading**: Load and clean cache on demand to avoid memory waste
- **Concurrency Optimization**: Supports concurrent processing of multiple terminals

## 🐛 Troubleshooting

### Common Issues

#### 1. Extension Cannot Detect Version Manager

**Solutions:**

- Confirm NVM or N is properly installed
- Check environment variable configuration
- Restart VSCode

```bash
# Check NVM installation
nvm --version

# Check N installation
n --version
```

#### 2. Version Switching Not Taking Effect

**Solutions:**

- Restart terminal
- Check configuration file format
- Confirm target version is installed

```bash
# List installed versions
nvm list
# or
n ls
```

#### 3. Terminal Integration Not Working

**Solutions:**

- Check `node-env-pro.terminalIntegration` setting
- Confirm `node-env-pro.autoSwitch` is enabled
- Check VSCode Developer Console for error messages

#### 4. Configuration File Not Recognized

**Solutions:**

- Confirm correct file name (`.nvmrc`, `.node-version`, etc.)
- Check file content format
- Confirm file is in project root directory

## 🤝 Support and Feedback

### Issue Reporting

If you encounter problems or have feature suggestions, please:

1. **Check Common Issues**: Review the troubleshooting section above
2. **Search Known Issues**: Check project Issues
3. **Create New Issue**: Provide detailed problem description and environment information

### Environment Information Template

When reporting issues, please provide the following information:

```
- Operating System:
- VSCode Version:
- Extension Version:
- Node.js Version Manager:
- Project Configuration File Type:
- Error Message:
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Thanks to the following open source projects for their support:

- [NVM](https://github.com/nvm-sh/nvm) - Node Version Manager
- [NVM-Windows](https://github.com/coreybutler/nvm-windows) - Windows version of NVM
- [N](https://github.com/tj/n) - Node.js version manager
- [VSCode Extension API](https://code.visualstudio.com/api) - VSCode extension development interface

---

**Enjoy intelligent Node.js version management experience!** 🎉