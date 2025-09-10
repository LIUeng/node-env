import { BaseNodeManager } from "./base";
import { NodeVersion, ManagerDetectionResult } from "../types";

/**
 * N 版本管理器实现
 */
export class NManager extends BaseNodeManager {
  protected managerName = "n";
  protected command = "n";

  /**
   * 检测 N 是否可用
   */
  async detect(): Promise<ManagerDetectionResult> {
    const result: ManagerDetectionResult = {
      type: "n",
      available: false,
    };

    try {
      const versionResult = await this.executeCommand(["--version"]);

      if (versionResult.success) {
        result.available = true;
        result.version = versionResult.stdout.trim();

        // 尝试获取 n 的安装路径
        const whichResult = await this.executeCommand(["which", "n"]);
        if (whichResult.success) {
          result.path = whichResult.stdout.trim();
        }
      } else {
        result.error = "N version manager not found";
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Unknown error";
    }

    return result;
  }

  /**
   * 获取当前使用的 Node 版本
   */
  async getCurrentVersion(): Promise<string | null> {
    try {
      // 使用 node --version 获取当前版本
      const nodeResult = await this.executeCommand(["node", "--version"]);

      if (nodeResult.success && nodeResult.stdout) {
        return this.parseVersion(nodeResult.stdout);
      }

      // 如果 node 命令失败，尝试通过 n 获取
      const nResult = await this.executeCommand(["which"]);
      if (nResult.success) {
        const versionMatch = nResult.stdout.match(/node\/(v?\d+\.\d+\.\d+)/);
        if (versionMatch) {
          return this.parseVersion(versionMatch[1]);
        }
      }

      return null;
    } catch (error) {
      console.error("Error getting current version:", error);
      return null;
    }
  }

  /**
   * 重写 executeCommand 以处理 n 的特殊情况
   */
  protected async executeCommand(
    args: string[],
    options: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
    } = {}
  ) {
    // 对于 n 命令，我们需要确保使用正确的环境
    const env = {
      ...process.env,
      ...options.env,
      // 确保 PATH 包含 n 的安装路径
      PATH: process.env.PATH || "",
    };

    return super.executeCommand(args, {
      ...options,
      env,
    });
  }
}
