import { CommandResult, ManagerDetectionResult } from "../types";
import { ChildProcess } from "child_process";

/**
 * Node 版本管理器基础抽象类
 */
export abstract class BaseNodeManager {
  protected abstract managerName: string;
  protected abstract command: string;

  /**
   * 检测管理器是否可用
   */
  abstract detect(): Promise<ManagerDetectionResult>;

  /**
   * 获取当前使用的 Node 版本
   */
  abstract getCurrentVersion(): Promise<string | null>;

  /**
   * 通用命令执行方法（提取公共逻辑）
   * @param command 命令名称
   * @param args 命令参数
   * @param options 执行选项
   */
  protected async executeGenericCommand(
    command: string,
    args: string[],
    options: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
    } = {}
  ): Promise<CommandResult> {
    const { spawn } = await import("child_process");

    return new Promise((resolve) => {
      // 优化：减少对象创建和合并操作
      const spawnOptions = {
        cwd: options.cwd || process.cwd(),
        env: options.env ? { ...process.env, ...options.env } : process.env,
        stdio: ["pipe", "pipe", "pipe"] as ["pipe", "pipe", "pipe"],
        shell: true,
      };

      const child: ChildProcess = spawn(command, args, spawnOptions);

      let resolved = false;

      // 优化：使用更高效的数据处理
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      child.stdout?.on("data", (data: any) => {
        stdoutChunks.push(Buffer.from(data));
      });

      child.stderr?.on("data", (data: any) => {
        stderrChunks.push(Buffer.from(data));
      });

      const timeout = options.timeout || 15000; // 减少默认超时时间
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill("SIGTERM");
          resolve({
            exitCode: -1,
            stdout: Buffer.concat(stdoutChunks).toString().trim(),
            stderr:
              Buffer.concat(stderrChunks).toString().trim() +
              "\nCommand timeout",
            success: false,
          });
        }
      }, timeout);

      child.on("close", (code: number | null) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve({
            exitCode: code || 0,
            stdout: Buffer.concat(stdoutChunks).toString().trim(),
            stderr: Buffer.concat(stderrChunks).toString().trim(),
            success: (code || 0) === 0,
          });
        }
      });

      child.on("error", (error: Error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve({
            exitCode: -1,
            stdout: Buffer.concat(stdoutChunks).toString().trim(),
            stderr:
              Buffer.concat(stderrChunks).toString().trim() +
              "\n" +
              error.message,
            success: false,
          });
        }
      });
    });
  }

  /**
   * 执行命令（优化版本）
   * @param args 命令参数
   * @param options 执行选项
   */
  protected async executeCommand(
    args: string[],
    options: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
    } = {}
  ): Promise<CommandResult> {
    return this.executeGenericCommand(this.command, args, options);
  }

  /**
   * 解析版本字符串
   * @param versionStr 版本字符串
   */
  protected parseVersion(versionStr: string): string {
    // 移除 'v' 前缀和其他非数字字符
    const match = versionStr.match(/v?(\d+\.\d+\.\d+)/);
    return match ? match[1] : versionStr.trim();
  }

  /**
   * 检查版本是否为 LTS
   * @param version 版本号
   */
  protected isLTSVersion(version: string): boolean {
    // 简单的 LTS 版本检测，实际应该查询 Node.js 官方数据
    const majorVersion = parseInt(version.split(".")[0]);
    // Node.js LTS 版本通常是偶数主版本号
    return majorVersion % 2 === 0 && majorVersion >= 12;
  }

  /**
   * 验证版本格式
   * @param version 版本字符串
   */
  protected isValidVersion(version: string): boolean {
    const versionRegex = /^v?\d+\.\d+\.\d+$/;
    return versionRegex.test(version);
  }

  /**
   * 获取管理器名称
   */
  getManagerName(): string {
    return this.managerName;
  }

  /**
   * 获取命令名称
   */
  getCommand(): string {
    return this.command;
  }
}
