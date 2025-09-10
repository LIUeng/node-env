import { PlatformUtils } from './platformUtils'
import { logger } from '../utils'
import * as vscode from 'vscode'

/**
 * 错误类型
 */
export enum ErrorType {
  MANAGER_NOT_FOUND = 'MANAGER_NOT_FOUND',
  VERSION_NOT_FOUND = 'VERSION_NOT_FOUND',
  SWITCH_FAILED = 'SWITCH_FAILED',
  INSTALL_FAILED = 'INSTALL_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PLATFORM_NOT_SUPPORTED = 'PLATFORM_NOT_SUPPORTED',
  COMMAND_TIMEOUT = 'COMMAND_TIMEOUT',
  SHELL_ERROR = 'SHELL_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR'
}

/**
 * 错误信息接口
 */
export interface ErrorInfo {
  type: ErrorType
  message: string
  originalError?: Error | string
  platform?: string
  suggestions?: string[]
  recoveryActions?: (() => Promise<void>)[]
}

/**
 * 跨平台错误处理工具类
 */
export class ErrorHandler {
  private static instance: ErrorHandler
  private platformUtils: PlatformUtils

  private constructor() {
    this.platformUtils = PlatformUtils.getInstance()
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  /**
   * 处理错误并提供平台特定的解决方案
   */
  public async handleError(error: Error | string, type: ErrorType, context?: any): Promise<ErrorInfo> {
    const platformInfo = this.platformUtils.getPlatformInfo()
    const errorMessage = typeof error === 'string' ? error : error.message
    
    logger.error(`[${type}] ${errorMessage}`, { platform: platformInfo.type, context })

    const errorInfo: ErrorInfo = {
      type,
      message: errorMessage,
      originalError: error,
      platform: platformInfo.type,
      suggestions: [],
      recoveryActions: []
    }

    // 根据错误类型和平台提供特定的处理
    switch (type) {
      case ErrorType.MANAGER_NOT_FOUND:
        this.handleManagerNotFound(errorInfo)
        break
      case ErrorType.VERSION_NOT_FOUND:
        this.handleVersionNotFound(errorInfo, context)
        break
      case ErrorType.SWITCH_FAILED:
        this.handleSwitchFailed(errorInfo, context)
        break
      case ErrorType.INSTALL_FAILED:
        this.handleInstallFailed(errorInfo, context)
        break
      case ErrorType.PERMISSION_DENIED:
        this.handlePermissionDenied(errorInfo)
        break
      case ErrorType.NETWORK_ERROR:
        this.handleNetworkError(errorInfo)
        break
      case ErrorType.PLATFORM_NOT_SUPPORTED:
        this.handlePlatformNotSupported(errorInfo)
        break
      case ErrorType.COMMAND_TIMEOUT:
        this.handleCommandTimeout(errorInfo, context)
        break
      case ErrorType.SHELL_ERROR:
        this.handleShellError(errorInfo, context)
        break
      case ErrorType.CONFIG_ERROR:
        this.handleConfigError(errorInfo, context)
        break
    }

    return errorInfo
  }

  /**
   * 处理版本管理器未找到错误
   */
  private handleManagerNotFound(errorInfo: ErrorInfo): void {
    const platformInfo = this.platformUtils.getPlatformInfo()
    
    if (platformInfo.type === 'windows') {
      errorInfo.suggestions = [
        '安装 nvm-windows: https://github.com/coreybutler/nvm-windows',
        '确保 nvm-windows 已添加到系统 PATH 环境变量',
        '重启 VSCode 和终端以刷新环境变量',
        '检查是否以管理员权限运行'
      ]
    } else {
      errorInfo.suggestions = [
        '安装 nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash',
        '或安装 n: npm install -g n',
        '重新加载 shell 配置: source ~/.bashrc 或 source ~/.zshrc',
        '检查 NVM_DIR 环境变量是否正确设置'
      ]
    }
  }

  /**
   * 处理版本未找到错误
   */
  private handleVersionNotFound(errorInfo: ErrorInfo, context?: any): void {
    const version = context?.version || 'unknown'
    const platformInfo = this.platformUtils.getPlatformInfo()
    
    if (platformInfo.type === 'windows') {
      errorInfo.suggestions = [
        `尝试安装版本: nvm install ${version}`,
        '查看可用版本: nvm list available',
        '检查版本号格式是否正确（如 18.17.0）',
        '确保网络连接正常'
      ]
    } else {
      errorInfo.suggestions = [
        `尝试安装版本: nvm install ${version}`,
        '查看可用版本: nvm ls-remote',
        '检查版本号格式是否正确',
        '尝试使用 LTS 版本: nvm install --lts'
      ]
    }
  }

  /**
   * 处理版本切换失败错误
   */
  private handleSwitchFailed(errorInfo: ErrorInfo, context?: any): void {
    const version = context?.version || 'unknown'
    const platformInfo = this.platformUtils.getPlatformInfo()
    
    if (platformInfo.type === 'windows') {
      errorInfo.suggestions = [
        '确保以管理员权限运行终端',
        `检查版本是否已安装: nvm list`,
        `尝试重新安装版本: nvm uninstall ${version} && nvm install ${version}`,
        '重启终端或 VSCode'
      ]
    } else {
      errorInfo.suggestions = [
        '检查 nvm 是否正确加载: type nvm',
        `确认版本已安装: nvm ls`,
        '重新加载 shell: source ~/.bashrc 或 source ~/.zshrc',
        '检查文件权限和磁盘空间'
      ]
    }
  }

  /**
   * 处理安装失败错误
   */
  private handleInstallFailed(errorInfo: ErrorInfo, context?: any): void {
    const version = context?.version || 'unknown'
    const platformInfo = this.platformUtils.getPlatformInfo()
    
    errorInfo.suggestions = [
      '检查网络连接是否正常',
      '尝试使用代理或更换网络',
      '检查磁盘空间是否充足',
      '清理临时文件后重试'
    ]
    
    if (platformInfo.type === 'windows') {
      errorInfo.suggestions.push(
        '确保以管理员权限运行',
        '检查防火墙和杀毒软件设置',
        '尝试手动下载并安装'
      )
    } else {
      errorInfo.suggestions.push(
        '检查编译工具是否安装: build-essential (Ubuntu) 或 xcode-tools (macOS)',
        '尝试清理 nvm 缓存: rm -rf ~/.nvm/.cache',
        '检查系统依赖是否完整'
      )
    }
  }

  /**
   * 处理权限拒绝错误
   */
  private handlePermissionDenied(errorInfo: ErrorInfo): void {
    const platformInfo = this.platformUtils.getPlatformInfo()
    
    if (platformInfo.type === 'windows') {
      errorInfo.suggestions = [
        '以管理员身份运行 VSCode 或终端',
        '检查用户账户控制 (UAC) 设置',
        '确保对 nvm 安装目录有写权限',
        '检查防病毒软件是否阻止操作'
      ]
    } else {
      errorInfo.suggestions = [
        '检查文件和目录权限: ls -la ~/.nvm',
        '修复权限: chmod -R 755 ~/.nvm',
        '避免使用 sudo 安装 nvm',
        '检查 SELinux 或 AppArmor 设置'
      ]
    }
  }

  /**
   * 处理网络错误
   */
  private handleNetworkError(errorInfo: ErrorInfo): void {
    errorInfo.suggestions = [
      '检查网络连接是否正常',
      '尝试使用代理服务器',
      '更换 DNS 服务器',
      '稍后重试',
      '检查防火墙设置'
    ]
  }

  /**
   * 处理平台不支持错误
   */
  private handlePlatformNotSupported(errorInfo: ErrorInfo): void {
    const platformInfo = this.platformUtils.getPlatformInfo()
    
    errorInfo.suggestions = [
      `当前平台 ${platformInfo.type} 可能不完全支持此功能`,
      '尝试使用系统自带的 Node.js 版本管理',
      '考虑使用 Docker 容器',
      '查看官方文档获取平台特定的解决方案'
    ]
  }

  /**
   * 处理命令超时错误
   */
  private handleCommandTimeout(errorInfo: ErrorInfo, context?: any): void {
    const timeout = context?.timeout || 'unknown'
    
    errorInfo.suggestions = [
      '检查网络连接速度',
      '增加超时时间设置',
      '尝试在网络较好的环境下重试',
      '检查系统资源使用情况',
      '关闭其他占用网络的应用程序'
    ]
  }

  /**
   * 处理 Shell 错误
   */
  private handleShellError(errorInfo: ErrorInfo, context?: any): void {
    const platformInfo = this.platformUtils.getPlatformInfo()
    const shell = context?.shell || platformInfo.shell
    
    if (platformInfo.type === 'windows') {
      errorInfo.suggestions = [
        '尝试使用不同的终端 (PowerShell, CMD, Git Bash)',
        '检查 Windows 版本兼容性',
        '更新 Windows Terminal 或终端应用',
        '检查系统环境变量设置'
      ]
    } else {
      errorInfo.suggestions = [
        `检查 ${shell} 配置文件: ~/.${shell}rc`,
        '尝试使用不同的 shell (bash, zsh, fish)',
        '重新加载 shell 配置',
        '检查 shell 版本兼容性'
      ]
    }
  }

  /**
   * 处理配置错误
   */
  private handleConfigError(errorInfo: ErrorInfo, context?: any): void {
    const configFile = context?.configFile || 'unknown'
    
    errorInfo.suggestions = [
      `检查配置文件格式: ${configFile}`,
      '验证 JSON 语法是否正确',
      '检查文件权限',
      '尝试重新创建配置文件',
      '查看示例配置文件'
    ]
  }

  /**
   * 显示错误信息给用户
   */
  public async showErrorToUser(errorInfo: ErrorInfo, showSuggestions: boolean = true): Promise<void> {
    const message = `${errorInfo.message}`
    
    if (showSuggestions && errorInfo.suggestions && errorInfo.suggestions.length > 0) {
      const action = await vscode.window.showErrorMessage(
        message,
        '查看解决方案',
        '忽略'
      )
      
      if (action === '查看解决方案') {
        this.showSuggestions(errorInfo)
      }
    } else {
      vscode.window.showErrorMessage(message)
    }
  }

  /**
   * 显示解决方案
   */
  private async showSuggestions(errorInfo: ErrorInfo): Promise<void> {
    if (!errorInfo.suggestions || errorInfo.suggestions.length === 0) {
      return
    }
    
    const suggestions = errorInfo.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')
    const message = `解决方案:\n\n${suggestions}`
    
    await vscode.window.showInformationMessage(message, { modal: true })
  }

  /**
   * 优雅降级到系统默认 Node 版本
   */
  public async gracefulFallback(reason: string): Promise<void> {
    logger.warn(`Falling back to system Node.js: ${reason}`)
    
    const message = `无法切换 Node 版本，将使用系统默认版本。原因: ${reason}`
    vscode.window.showWarningMessage(message)
  }

  /**
   * 检查并报告系统兼容性
   */
  public async checkSystemCompatibility(): Promise<boolean> {
    const platformInfo = this.platformUtils.getPlatformInfo()
    
    try {
      // 检查基本的系统要求
      const issues: string[] = []
      
      // 检查 Node.js 是否可用
      try {
        const { spawn } = await import('child_process')
        await new Promise<void>((resolve, reject) => {
          const child = spawn('node', ['--version'], { stdio: 'pipe' })
          child.on('close', (code) => {
            if (code === 0) {
              resolve()
            } else {
              reject(new Error('Node.js not found'))
            }
          })
          child.on('error', reject)
        })
      } catch {
        issues.push('Node.js 未安装或不在 PATH 中')
      }
      
      // 检查平台特定要求
      if (platformInfo.type === 'windows') {
        // Windows 特定检查
        if (!process.env.USERPROFILE) {
          issues.push('USERPROFILE 环境变量未设置')
        }
      } else {
        // Unix-like 特定检查
        if (!process.env.HOME) {
          issues.push('HOME 环境变量未设置')
        }
      }
      
      if (issues.length > 0) {
        const message = `系统兼容性检查发现问题:\n${issues.join('\n')}`
        vscode.window.showWarningMessage(message)
        return false
      }
      
      return true
    } catch (error) {
      logger.error('System compatibility check failed:', error)
      return false
    }
  }
}