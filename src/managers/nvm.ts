import { BaseNodeManager } from "./base";
import { ManagerDetectionResult } from "../types";
import { PlatformUtils } from "../utils/platformUtils";
import { ErrorHandler, ErrorType } from "../utils/errorHandler";
import {
  VersionCache,
  CacheKeyGenerator,
  withPerformanceMonitoring,
} from "../utils/versionCache";
import * as path from "path";
import * as os from "os";
import { performanceAnalyzer } from "../utils/performanceAnalyzer";

/**
 * NVM 版本管理器实现
 */
export class NVMManager extends BaseNodeManager {
  protected managerName = "nvm";
  protected command = "nvm";
  private nvmDir: string;
  private platformUtils: PlatformUtils;
  private errorHandler: ErrorHandler;
  private cache: VersionCache;

  constructor() {
    super();
    this.nvmDir = process.env.NVM_DIR || path.join(os.homedir(), ".nvm");
    this.platformUtils = PlatformUtils.getInstance();
    this.errorHandler = ErrorHandler.getInstance();
    this.cache = VersionCache.getInstance();
  }

  /**
   * 检测 NVM 是否可用
   */
  async detect(): Promise<ManagerDetectionResult> {
    const result: ManagerDetectionResult = {
      type: "nvm",
      available: false,
    };

    try {
      const platformInfo = this.platformUtils.getPlatformInfo();

      if (platformInfo.type === "windows") {
        // Windows nvm-windows: 使用 'nvm version' 而不是 'nvm --version'
        const directResult = await this.executeCommand(["version"]);

        if (directResult.success) {
          result.available = true;
          result.version = directResult.stdout.trim();
          // Windows 使用不同的路径配置
          result.path =
            process.env.NVM_HOME ||
            process.env.NVM_SYMLINK ||
            path.join(os.homedir(), "AppData", "Roaming", "nvm");
          return result;
        } else {
          result.error = "nvm-windows not found or not properly configured";
        }
      } else {
        // Unix-like: 尝试直接执行 nvm 命令
        const directResult = await this.executeCommand(["--version"]);

        if (directResult.success) {
          result.available = true;
          result.version = directResult.stdout.trim();
          result.path = this.nvmDir;
          return result;
        }

        // 如果直接执行失败，尝试通过 source 方式
        const sourceCommand = `source ${this.nvmDir}/nvm.sh && nvm --version`;
        const sourceResult = await this.executeShellCommand(sourceCommand);

        if (sourceResult.success) {
          result.available = true;
          result.version = sourceResult.stdout.trim();
          result.path = this.nvmDir;
        } else {
          result.error = "NVM not found or not properly configured";
        }
      }
    } catch (error) {
      await this.errorHandler.handleError(
        error as Error,
        ErrorType.MANAGER_NOT_FOUND,
        { manager: "nvm", platform: this.platformUtils.getPlatformInfo().type }
      );
      result.error = error instanceof Error ? error.message : "Unknown error";
    }

    return result;
  }

  /**
   * 获取当前使用的 Node 版本（带缓存优化）
   */
  async getCurrentVersion(): Promise<string | null> {
    return withPerformanceMonitoring("NVM.getCurrentVersion", async () => {
      const platformInfo = this.platformUtils.getPlatformInfo();
      const cacheKey = CacheKeyGenerator.currentVersion(
        "nvm",
        platformInfo.type
      );

      // 尝试从缓存获取
      const cached = this.cache.get<string | null>(cacheKey);
      if (cached !== null) {
        console.log("NVM getCurrentVersion: Using cached version:", cached);
        return cached;
      }

      // 这里直接执行 node --version 即可
      try {
        const nodeResult = await this.executeNodeCommand();
        if (nodeResult.success && nodeResult.stdout) {
          const parsedVersion = nodeResult.stdout.trim().replace(/^v/, "");
          console.log(
            "NVM getCurrentVersion: Got version from node --version:",
            parsedVersion
          );
          this.cache.set(cacheKey, parsedVersion, 5000);

          return parsedVersion;
        }
        // 如果命令失败，缓存 null 结果但使用更短的 TTL
        console.log("NVM getCurrentVersion: No version found");
        this.cache.set(cacheKey, null, 2000); // 2秒缓存

        return null;
      } catch (error) {
        console.error("Error getting current version:", error);
        // 不缓存错误结果
        return null;
      }
    })();
  }
  /**
   * 直接执行 node 命令
   */
  /**
   * 执行 node 命令（使用基类的通用方法）
   */
  private async executeNodeCommand(): Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    return this.executeGenericCommand("node", ["--version"], {
      timeout: 5000, // 5秒超时
    });
  }

  /**
   * 执行 NVM 命令
   */
  private async executeNVMCommand(
    args: string[],
    options: { timeout?: number } = {}
  ) {
    const platformInfo = this.platformUtils.getPlatformInfo();

    if (platformInfo.type === "windows") {
      // Windows: 直接执行 nvm 命令
      return performanceAnalyzer.measure("nvm.executeCommand", () =>
        this.executeCommand(args, options)
      );
    }

    // Unix-like 系统: 首先尝试直接执行
    const directResult = await performanceAnalyzer.measure(
      "nvm.executeCommand",
      () => this.executeCommand(args, options)
    );
    // const directResult = await this.executeCommand(args, options)
    if (directResult.success) {
      return directResult;
    }

    // 如果直接执行失败，通过 shell 执行，使用平台工具类构建命令
    const initCommand = this.platformUtils.buildNVMInitCommand();
    const nvmCommand = this.platformUtils.getNVMCommand(args);
    const fullCommand = `${initCommand} && ${nvmCommand}`;

    const shellResult = await performanceAnalyzer.measure(
      "nvm.executeShellCommand",
      () => this.executeShellCommand(fullCommand, options.timeout)
    );

    return shellResult;
  }

  /**
   * 执行 shell 命令（优化版本）
   */
  private async executeShellCommand(command: string, timeout = 15000) {
    const { spawn } = await import("child_process");
    const platformInfo = this.platformUtils.getPlatformInfo();

    return new Promise<{
      success: boolean;
      stdout: string;
      stderr: string;
      exitCode: number;
    }>((resolve) => {
      // 优化：缓存 shell 执行器和环境变量
      const shellExecutor = this.platformUtils.getInteractiveShellExecutor();
      const nvmEnv = this.platformUtils.buildNVMEnvironment();

      let fullCommand: string;
      if (platformInfo.type === "windows") {
        // Windows: 直接执行命令
        fullCommand = command;
      } else {
        // Unix-like: 优化初始化命令
        const initCommand = this.platformUtils.buildNVMInitCommand();
        fullCommand = `${initCommand} && ${command}`;
      }

      let resolved = false;
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      const child = spawn(
        shellExecutor.command,
        [...shellExecutor.args, fullCommand],
        {
          stdio: ["pipe", "pipe", "pipe"],
          env: nvmEnv,
        }
      );

      child.stdout?.on("data", (data: any) => {
        stdoutChunks.push(Buffer.from(data));
      });

      child.stderr?.on("data", (data: any) => {
        stderrChunks.push(Buffer.from(data));
      });

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill("SIGTERM");
          resolve({
            success: false,
            stdout: Buffer.concat(stdoutChunks).toString().trim(),
            stderr:
              Buffer.concat(stderrChunks).toString().trim() +
              "\nCommand timeout",
            exitCode: -1,
          });
        }
      }, timeout);

      child.on("close", (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve({
            success: (code || 0) === 0,
            stdout: Buffer.concat(stdoutChunks).toString().trim(),
            stderr: Buffer.concat(stderrChunks).toString().trim(),
            exitCode: code || 0,
          });
        }
      });

      child.on("error", (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve({
            success: false,
            stdout: Buffer.concat(stdoutChunks).toString().trim(),
            stderr:
              Buffer.concat(stderrChunks).toString().trim() +
              "\n" +
              error.message,
            exitCode: -1,
          });
        }
      });
    });
  }
}
