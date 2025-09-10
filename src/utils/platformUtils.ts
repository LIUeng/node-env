import * as os from 'os'
import * as path from 'path'

/**
 * 平台类型
 */
export type PlatformType = 'windows' | 'macos' | 'linux'

/**
 * Shell 类型
 */
export type ShellType = 'cmd' | 'powershell' | 'bash' | 'zsh' | 'fish' | 'sh' | 'git-bash'

/**
 * 平台信息
 */
export interface PlatformInfo {
  type: PlatformType
  shell: ShellType
  nvmDir: string
  homeDir: string
  pathSeparator: string
  envVarPrefix: string
}

/**
 * 跨平台工具类
 */
export class PlatformUtils {
  private static _instance: PlatformUtils
  private _platformInfo: PlatformInfo

  private constructor() {
    this._platformInfo = this.detectPlatform()
  }

  public static getInstance(): PlatformUtils {
    if (!PlatformUtils._instance) {
      PlatformUtils._instance = new PlatformUtils()
    }
    return PlatformUtils._instance
  }

  /**
   * 获取平台信息
   */
  public getPlatformInfo(): PlatformInfo {
    return this._platformInfo
  }

  /**
   * 检测当前平台
   */
  private detectPlatform(): PlatformInfo {
    const platform = os.platform()
    const homeDir = os.homedir()
    
    let type: PlatformType
    let shell: ShellType
    let nvmDir: string
    let pathSeparator: string
    let envVarPrefix: string

    if (platform === 'win32') {
      type = 'windows'
      pathSeparator = '\\'
      envVarPrefix = '%'
      
      // Windows 上的 shell 检测
      shell = this.detectWindowsShell()
      
      // Windows 上的 NVM 目录
      nvmDir = process.env.NVM_HOME || 
               process.env.NVM_SYMLINK || 
               path.join(homeDir, 'AppData', 'Roaming', 'nvm')
    } else {
      type = platform === 'darwin' ? 'macos' : 'linux'
      pathSeparator = '/'
      envVarPrefix = '$'
      
      // Unix-like 系统的 shell 检测
      shell = this.detectUnixShell()
      
      // Unix-like 系统的 NVM 目录
      nvmDir = process.env.NVM_DIR || path.join(homeDir, '.nvm')
    }

    return {
      type,
      shell,
      nvmDir,
      homeDir,
      pathSeparator,
      envVarPrefix
    }
  }

  /**
   * 检测 Windows 系统的 Shell
   */
  private detectWindowsShell(): ShellType {
    const shell = process.env.SHELL || process.env.ComSpec || ''
    
    if (shell.includes('powershell') || shell.includes('pwsh')) {
      return 'powershell'
    }
    
    if (shell.includes('bash') || process.env.MSYSTEM) {
      return 'git-bash'
    }
    
    return 'cmd'
  }

  /**
   * 检测 Unix-like 系统的 Shell
   */
  private detectUnixShell(): ShellType {
    const shell = process.env.SHELL || '/bin/sh'
    
    if (shell.includes('zsh')) {
      return 'zsh'
    }
    
    if (shell.includes('bash')) {
      return 'bash'
    }
    
    if (shell.includes('fish')) {
      return 'fish'
    }
    
    return 'sh'
  }

  /**
   * 是否为 Windows 平台
   */
  public isWindows(): boolean {
    return this._platformInfo.type === 'windows'
  }

  /**
   * 是否为 macOS 平台
   */
  public isMacOS(): boolean {
    return this._platformInfo.type === 'macos'
  }

  /**
   * 是否为 Linux 平台
   */
  public isLinux(): boolean {
    return this._platformInfo.type === 'linux'
  }

  /**
   * 获取 NVM 命令格式
   */
  public getNVMCommand(args: string[]): string {
    if (this.isWindows()) {
      // Windows nvm-windows 命令格式
      return `nvm ${args.join(' ')}`
    } else {
      // Unix-like 系统标准 nvm 命令格式
      return `nvm ${args.join(' ')}`
    }
  }

  /**
   * 获取 Shell 命令执行器
   */
  public getShellExecutor(): { command: string; args: string[] } {
    const { shell, type } = this._platformInfo

    if (type === 'windows') {
      switch (shell) {
        case 'powershell':
          return { command: 'powershell', args: ['-Command'] }
        case 'git-bash':
          return { command: 'bash', args: ['-c'] }
        case 'cmd':
        default:
          return { command: 'cmd', args: ['/c'] }
      }
    } else {
      // Unix-like 系统
      const shellPath = this.getShellPath(shell)
      return { command: shellPath, args: ['-c'] }
    }
  }

  /**
   * 获取交互式 Shell 命令执行器
   */
  public getInteractiveShellExecutor(): { command: string; args: string[] } {
    const { shell, type } = this._platformInfo

    if (type === 'windows') {
      // Windows 上通常不需要交互式 shell
      return this.getShellExecutor()
    } else {
      // Unix-like 系统使用交互式 shell
      const shellPath = this.getShellPath(shell)
      return { command: shellPath, args: ['-i', '-c'] }
    }
  }

  /**
   * 获取 Shell 命令配置（兼容旧接口）
   */
  public getShellCommand(): { shell: string; args: string[] } {
    const executor = this.getShellExecutor()
    return {
      shell: executor.command,
      args: executor.args
    }
  }

  /**
   * 获取 Shell 路径
   */
  private getShellPath(shell: ShellType): string {
    switch (shell) {
      case 'zsh':
        return '/bin/zsh'
      case 'bash':
        return '/bin/bash'
      case 'fish':
        return '/usr/bin/fish'
      case 'sh':
      default:
        return '/bin/sh'
    }
  }

  /**
   * 构建 NVM 环境变量
   */
  public buildNVMEnvironment(): Record<string, string> {
    const { nvmDir, type } = this._platformInfo
    const env: Record<string, string> = {}
    
    // 复制现有环境变量，过滤掉 undefined 值
    Object.entries(process.env).forEach(([key, value]) => {
      if (value !== undefined) {
        env[key] = value
      }
    })

    if (type === 'windows') {
      // Windows nvm-windows 环境变量
      env.NVM_HOME = this.expandPath(nvmDir)
      env.NVM_SYMLINK = process.env.NVM_SYMLINK || this.joinPath(nvmDir, 'nodejs')
      
      // Windows 路径处理
      if (env.PATH) {
        const nvmPath = this.joinPath(nvmDir, 'nodejs')
        env.PATH = `${nvmPath};${env.PATH}`
      }
    } else {
      // Unix-like 系统标准 nvm 环境变量
      env.NVM_DIR = this.expandPath(nvmDir)
      
      // Unix 路径处理
      if (env.PATH) {
        const nvmVersionsPath = this.joinPath(nvmDir, 'versions', 'node')
        env.PATH = `${nvmVersionsPath}:${env.PATH}`
      }
    }

    return env
  }

  /**
   * 构建 NVM 初始化命令
   */
  public buildNVMInitCommand(): string {
    const { nvmDir, type, shell } = this._platformInfo

    if (type === 'windows') {
      // Windows nvm-windows 不需要初始化命令
      return ''
    } else {
      // Unix-like 系统需要 source nvm.sh
      const nvmScript = path.join(nvmDir, 'nvm.sh')
      const bashCompletion = path.join(nvmDir, 'bash_completion')
      
      return `export NVM_DIR="${nvmDir}"; [ -s "${nvmScript}" ] && \. "${nvmScript}"; [ -s "${bashCompletion}" ] && \. "${bashCompletion}"`
    }
  }

  /**
   * 标准化路径
   */
  public normalizePath(filePath: string): string {
    if (this.isWindows()) {
      return filePath.replace(/\//g, '\\')
    } else {
      return filePath.replace(/\\/g, '/')
    }
  }

  /**
   * 获取环境变量引用格式
   */
  public formatEnvVar(varName: string): string {
    if (this.isWindows()) {
      return `%${varName}%`
    } else {
      return `$${varName}`
    }
  }

  /**
   * 跨平台路径连接
   */
  public joinPath(...paths: string[]): string {
    return path.join(...paths)
  }

  /**
   * 展开路径中的环境变量
   */
  public expandPath(filePath: string): string {
    const { type, homeDir } = this._platformInfo
    
    if (type === 'windows') {
      // Windows 环境变量展开
      return filePath
        .replace(/%USERPROFILE%/gi, homeDir)
        .replace(/%HOME%/gi, homeDir)
        .replace(/%APPDATA%/gi, path.join(homeDir, 'AppData', 'Roaming'))
        .replace(/%LOCALAPPDATA%/gi, path.join(homeDir, 'AppData', 'Local'))
    } else {
      // Unix-like 环境变量展开
      return filePath
        .replace(/\$HOME/g, homeDir)
        .replace(/~/g, homeDir)
    }
  }

  /**
   * 获取用户配置目录
   */
  public getUserConfigDir(): string {
    const { type, homeDir } = this._platformInfo
    
    if (type === 'windows') {
      return path.join(homeDir, 'AppData', 'Roaming')
    } else if (type === 'macos') {
      return path.join(homeDir, 'Library', 'Application Support')
    } else {
      // Linux
      return process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config')
    }
  }

  /**
   * 获取临时目录
   */
  public getTempDir(): string {
    const { type } = this._platformInfo
    
    if (type === 'windows') {
      return process.env.TEMP || process.env.TMP || path.join(this._platformInfo.homeDir, 'AppData', 'Local', 'Temp')
    } else {
      return process.env.TMPDIR || '/tmp'
    }
  }

  /**
   * 检查路径是否为绝对路径
   */
  public isAbsolutePath(filePath: string): boolean {
    return path.isAbsolute(filePath)
  }

  /**
   * 将相对路径转换为绝对路径
   */
  public resolveAbsolutePath(filePath: string, basePath?: string): string {
    if (this.isAbsolutePath(filePath)) {
      return filePath
    }
    
    const base = basePath || process.cwd()
    return path.resolve(base, filePath)
  }

  /**
   * 获取可执行文件的扩展名
   */
  public getExecutableExtension(): string {
    return this.isWindows() ? '.exe' : ''
  }

  /**
   * 构建可执行文件路径
   */
  public buildExecutablePath(basePath: string, executableName: string): string {
    const extension = this.getExecutableExtension()
    const fullName = executableName + extension
    return this.joinPath(basePath, fullName)
  }

  /**
   * 获取系统 PATH 分隔符
   */
  public getPathSeparator(): string {
    return this.isWindows() ? ';' : ':'
  }

  /**
   * 分割 PATH 环境变量
   */
  public splitPath(pathString: string): string[] {
    const separator = this.getPathSeparator()
    return pathString.split(separator).filter(p => p.trim().length > 0)
  }

  /**
   * 连接 PATH 环境变量
   */
  public joinPathEnv(paths: string[]): string {
    const separator = this.getPathSeparator()
    return paths.join(separator)
  }

  /**
   * 添加路径到 PATH 环境变量
   */
  public addToPath(newPath: string, existingPath?: string): string {
    const currentPath = existingPath || process.env.PATH || ''
    const paths = this.splitPath(currentPath)
    
    // 避免重复添加
    if (!paths.includes(newPath)) {
      paths.unshift(newPath) // 添加到开头，优先级更高
    }
    
    return this.joinPathEnv(paths)
  }
}