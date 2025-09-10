/**
 * Node 版本信息
 */
export interface NodeVersion {
  /** 版本号，如 '18.17.0' */
  version: string;
  /** 是否为当前使用的版本 */
  current: boolean;
  /** 是否为 LTS 版本 */
  lts: boolean | string;
  /** 版本别名，如 'node', 'stable' */
  alias?: string;
  /** 安装路径 */
  path?: string;
}

/**
 * 版本管理器类型
 */
export type NodeManagerType = "nvm" | "n" | "unknown";

/**
 * 版本管理器检测结果
 */
export interface ManagerDetectionResult {
  /** 管理器类型 */
  type: NodeManagerType;
  /** 是否可用 */
  available: boolean;
  /** 版本信息 */
  version?: string;
  /** 安装路径 */
  path?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 命令执行结果
 */
export interface CommandResult {
  /** 退出码 */
  exitCode: number;
  /** 标准输出 */
  stdout: string;
  /** 错误输出 */
  stderr: string;
  /** 是否成功 */
  success: boolean;
}

/**
 * 插件配置
 */
export interface PluginConfig {
  /** 默认版本 */
  defaultVersion?: string;
  /** 是否自动切换 */
  autoSwitch: boolean;
  /** 是否在状态栏显示 */
  showInStatusBar: boolean;
  /** 首选的版本管理器 */
  preferredManager: NodeManagerType | "auto";
  /** 是否启用终端集成 */
  terminalIntegration: boolean;
  /** 是否自动检测项目版本 */
  autoDetectVersion: boolean;
  /** 是否监听配置文件变化 */
  // watchConfigFiles: boolean;
}
