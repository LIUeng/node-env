import { ManagerDetectionResult, NodeManagerType } from "../types";
import { spawn } from "child_process";
import * as path from "path";
import * as os from "os";
import { PlatformUtils } from "../utils/platformUtils";
import { performanceAnalyzer } from "../utils/performanceAnalyzer";
import { cacheManager, CACHE_NAMESPACES } from "../utils/cacheManager";

/**
 * 环境检测服务
 */
export class EnvironmentDetector {
  private static instance: EnvironmentDetector;
  private platformUtils = PlatformUtils.getInstance();
  private cacheExpiry = 5 * 60 * 1000; // 5分钟缓存

  static getInstance(): EnvironmentDetector {
    if (!EnvironmentDetector.instance) {
      EnvironmentDetector.instance = new EnvironmentDetector();
    }
    return EnvironmentDetector.instance;
  }

  /**
   * 检测所有可用的版本管理器
   * 使用短路检测策略：优先检测 NVM，成功后立即返回，避免检测其他管理器
   */
  async detectAllManagers(): Promise<ManagerDetectionResult[]> {
    const cacheKey = "all_managers";

    // 检查缓存
    const cached = cacheManager.get<ManagerDetectionResult[]>(
      CACHE_NAMESPACES.ENVIRONMENT_DETECTION,
      cacheKey
    );

    if (cached) {
      console.log("🚀 Using cached detection results");
      return cached;
    }

    const results: ManagerDetectionResult[] = [];

    // 第一优先级：检测 NVM（统一使用 detectNVM，内部处理平台差异）
    console.log("🔍 Detecting NVM with priority...");
    const nvmResult = await performanceAnalyzer.measure(
      "environmentDetector.detectNVM",
      () => this.detectNVM()
    );

    results.push(nvmResult);

    // 短路检测：如果 NVM 可用，立即返回，不再检测其他管理器
    if (nvmResult.available) {
      console.log("✅ NVM detected successfully, skipping other managers");

      // 缓存结果
      cacheManager.set(
        CACHE_NAMESPACES.ENVIRONMENT_DETECTION,
        cacheKey,
        results,
        this.cacheExpiry
      );

      return results;
    }

    // 第二优先级：只有在 NVM 不可用时才检测 N 版本管理器
    console.log("⚠️ NVM not available, detecting N version manager...");
    const nResult = await performanceAnalyzer.measure(
      "environmentDetector.detectN",
      () => this.detectN()
    );

    results.push(nResult);

    // 缓存结果
    cacheManager.set(
      CACHE_NAMESPACES.ENVIRONMENT_DETECTION,
      cacheKey,
      results,
      this.cacheExpiry
    );

    return results;
  }

  /**
   * 检测 NVM (跨平台统一方法)
   */
  async detectNVM(): Promise<ManagerDetectionResult> {
    const platformType = this.platformUtils.isWindows() ? "windows" : "unix";
    return cacheManager.cached(
      CACHE_NAMESPACES.MANAGER_DETECTION,
      `nvm_${platformType}`,
      async () => {
        const result: ManagerDetectionResult = {
          type: "nvm",
          available: false,
        };

        try {
          const platformInfo = this.platformUtils.getPlatformInfo();
          const nvmDir = platformInfo.nvmDir;

          if (this.platformUtils.isWindows()) {
            // Windows nvm-windows 检测逻辑
            const nvmCommand = await performanceAnalyzer.measure(
              "environmentDetector.executeNVMCommand",
              () => this.executeCommand("nvm", ["version"]) // Windows 使用 'version' 而不是 '--version'
            );

            if (nvmCommand.success) {
              result.available = true;
              result.version = nvmCommand.stdout.trim();
              // Windows 使用不同的路径配置
              result.path =
                process.env.NVM_HOME ||
                process.env.NVM_SYMLINK ||
                path.join(os.homedir(), "AppData", "Roaming", "nvm") ||
                nvmDir;
            } else {
              result.error = "nvm-windows not found or not properly configured";
            }
          } else {
            // Unix-like 系统检测逻辑
            const nvmCommand = await performanceAnalyzer.measure(
              "environmentDetector.executeNVMCommand",
              () => this.executeCommand("nvm", ["--version"])
            );

            if (nvmCommand.success) {
              result.available = true;
              result.version = nvmCommand.stdout.trim();
              result.path = nvmDir;
            } else {
              // 尝试通过 source 方式检测
              const sourceResult = await performanceAnalyzer.measure(
                "environmentDetector.executeNVMSourceCommand",
                () =>
                  this.executeShellCommand(
                    `source ${nvmDir}/nvm.sh && nvm --version`
                  )
              );

              if (sourceResult.success) {
                result.available = true;
                result.version = sourceResult.stdout.trim();
                result.path = nvmDir;
              } else {
                result.error = "NVM not found or not properly configured";
              }
            }
          }
        } catch (error) {
          result.error =
            error instanceof Error ? error.message : "Unknown error";
        }

        return result;
      },
      this.cacheExpiry
    );
  }

  /**
   * 检测 N
   */
  async detectN(): Promise<ManagerDetectionResult> {
    return cacheManager.cached(
      CACHE_NAMESPACES.MANAGER_DETECTION,
      "n_manager",
      () =>
        performanceAnalyzer.measure("environmentDetector.detectN", async () => {
          const result: ManagerDetectionResult = {
            type: "n",
            available: false,
          };

          try {
            const nCommand = await performanceAnalyzer.measure(
              "environmentDetector.executeNCommand",
              () => this.executeCommand("n", ["--version"])
            );

            if (nCommand.success) {
              result.available = true;
              result.version = nCommand.stdout.trim();

              // 尝试获取 n 的安装路径
              const whichCommand = this.platformUtils.isWindows()
                ? "where"
                : "which";
              const whichResult = await performanceAnalyzer.measure(
                "environmentDetector.executeWhichCommand",
                () => this.executeCommand(whichCommand, ["n"])
              );
              if (whichResult.success) {
                result.path = whichResult.stdout.trim();
              }
            } else {
              result.error = "N version manager not found";
            }
          } catch (error) {
            result.error =
              error instanceof Error ? error.message : "Unknown error";
          }

          return result;
        }),
      this.cacheExpiry
    );
  }

  /**
   * 获取首选的版本管理器
   */
  async getPreferredManager(): Promise<ManagerDetectionResult | null> {
    const managers = await this.detectAllManagers();

    // 优先选择可用的管理器
    const availableManagers = managers.filter((m) => m.available);

    if (availableManagers.length === 0) {
      return null;
    }

    // 如果只有一个可用，直接返回
    if (availableManagers.length === 1) {
      return availableManagers[0];
    }

    // 如果多个可用，优先选择 nvm
    const nvmManager = availableManagers.find((m) => m.type === "nvm");
    if (nvmManager) {
      return nvmManager;
    }

    // 否则返回第一个可用的
    return availableManagers[0];
  }

  /**
   * 检查特定管理器是否可用
   */
  async isManagerAvailable(type: NodeManagerType): Promise<boolean> {
    if (type === "unknown") return false;

    const managers = await this.detectAllManagers();
    const manager = managers.find((m) => m.type === type);
    return manager?.available || false;
  }

  /**
   * 执行命令
   */
  private async executeCommand(
    command: string,
    args: string[]
  ): Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        resolve({
          success: (code || 0) === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code || 0,
        });
      });

      child.on("error", (error) => {
        resolve({
          success: false,
          stdout,
          stderr: stderr + "\n" + error.message,
          exitCode: -1,
        });
      });
    });
  }

  /**
   * 执行 shell 命令（支持 source 等）
   */
  private async executeShellCommand(command: string): Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    return new Promise((resolve) => {
      // 根据平台选择合适的 shell
      const shellConfig = this.platformUtils.getShellCommand();

      const child = spawn(shellConfig.shell, [...shellConfig.args, command], {
        stdio: ["pipe", "pipe", "pipe"],
        env: process.env,
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        resolve({
          success: (code || 0) === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code || 0,
        });
      });

      child.on("error", (error) => {
        resolve({
          success: false,
          stdout,
          stderr: stderr + "\n" + error.message,
          exitCode: -1,
        });
      });
    });
  }

  /**
   * 清除检测缓存
   */
  clearCache(): void {
    cacheManager.delete(CACHE_NAMESPACES.ENVIRONMENT_DETECTION);
    cacheManager.delete(CACHE_NAMESPACES.MANAGER_DETECTION);
  }
}
