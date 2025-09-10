import { window, workspace, Terminal, Disposable } from "vscode";
import { ProjectDetectorService } from "./projectDetector";
import { NodeManagerService } from "./nodeManager";
import { PlatformUtils } from "../utils/platformUtils";
import { showAutoSwitchNotification } from "../configs";
import { logger } from "../utils";
import { performanceAnalyzer } from "../utils/performanceAnalyzer";
import { cacheManager, CACHE_NAMESPACES } from "../utils/cacheManager";

/**
 * 终端服务
 * 负责监听终端创建事件并自动切换 Node 版本
 */
export class TerminalService {
  private static instance: TerminalService;
  private disposables: Disposable[] = [];
  private projectDetector: ProjectDetectorService;
  private nodeManager: NodeManagerService;
  private processedTerminals = new Set<string>(); // 跟踪已处理的终端
  private platformUtils: PlatformUtils;
  private autoSwitchEnabled: boolean = true;
  private terminalIdMap = new WeakMap<Terminal, string>(); // 终端对象到 ID 的映射
  private terminalCounter = 0; // 终端计数器

  private constructor() {
    this.projectDetector = ProjectDetectorService.getInstance();
    this.nodeManager = NodeManagerService.getInstance();
    this.platformUtils = PlatformUtils.getInstance();
    this.setupTerminalListeners();
  }

  public static getInstance(): TerminalService {
    if (!TerminalService.instance) {
      TerminalService.instance = new TerminalService();
    }
    return TerminalService.instance;
  }

  /**
   * 设置终端监听器
   */
  private setupTerminalListeners(): void {
    // 监听终端创建事件
    const onDidOpenTerminal = window.onDidOpenTerminal(
      async (terminal: Terminal) => {
        logger.info(`Terminal opened: ${terminal.name}`);
        logger.info(`Auto switch enabled: ${this.autoSwitchEnabled}`);
        logger.info(`Total terminals: ${window.terminals.length}`);

        if (this.autoSwitchEnabled) {
          // 延迟执行，确保终端完全初始化
          // setTimeout(async () => {
          await this.handleTerminalCreated(terminal);
          // }, 1000)
        } else {
          logger.info("Auto switch is disabled, skipping terminal processing");
        }
      }
    );

    // 监听终端关闭事件
    const onDidCloseTerminal = window.onDidCloseTerminal(
      (terminal: Terminal) => {
        logger.info(`Terminal closed: ${terminal.name}`);
        // 清理已处理终端的记录
        if (this.terminalIdMap.has(terminal)) {
          const terminalId = this.terminalIdMap.get(terminal)!;
          this.processedTerminals.delete(terminalId);
          logger.info(`Removed terminal ${terminalId} from processed list`);
          // WeakMap 会在终端对象被垃圾回收时自动清理映射
        }
      }
    );

    this.disposables.push(onDidOpenTerminal, onDidCloseTerminal);
  }

  /**
   * 处理终端创建事件
   */
  private async handleTerminalCreated(terminal: Terminal): Promise<void> {
    return performanceAnalyzer.measure(
      "terminalService.handleTerminalCreated",
      async () => {
        try {
          // 生成终端的唯一标识符
          const terminalId = performanceAnalyzer.measureSync(
            "terminalService.getTerminalId",
            () => this.getTerminalId(terminal)
          );

          logger.info(
            `Processing terminal: ${terminal.name}, ID: ${terminalId}`
          );
          logger.info(
            `Current processed terminals count: ${this.processedTerminals.size}`
          );
          logger.info(
            `Processed terminals: ${Array.from(this.processedTerminals).join(
              ", "
            )}`
          );

          // 检查是否已经处理过这个终端
          if (this.processedTerminals.has(terminalId)) {
            logger.info(
              `Terminal ${terminal.name} (ID: ${terminalId}) already processed, skipping`
            );
            return;
          }

          logger.info(
            `Handling terminal creation for auto Node version switch: ${terminal.name} (ID: ${terminalId})`
          );

          // 获取终端的工作目录
          const terminalWorkspaceRoot = performanceAnalyzer.measureSync(
            "terminalService.getTerminalWorkspaceRoot",
            () => this.getTerminalWorkspaceRoot(terminal)
          );
          logger.info(`Terminal workspace root: ${terminalWorkspaceRoot}`);

          // 检测项目版本配置（支持多工作区）
          const detection = await performanceAnalyzer.measure(
            "terminalService.detectProjectVersionForWorkspace",
            () => this.detectProjectVersionForWorkspace(terminalWorkspaceRoot)
          );

          if (!detection.hasConfig) {
            logger.info(
              "No project Node version configuration found, skipping auto switch"
            );
            // 标记为已处理，避免重复检查
            this.processedTerminals.add(terminalId);
            return;
          }

          if (!detection.needsSwitch) {
            logger.info(
              `Current Node version (${detection.currentVersion}) matches project requirement (${detection.requiredVersion}), no switch needed`
            );
            // 标记为已处理
            this.processedTerminals.add(terminalId);
            return;
          }

          // 优先使用 targetVersion（匹配到的具体版本），否则使用 requiredVersion
          const versionToSwitch =
            detection.targetVersion || detection.requiredVersion;
          logger.info(
            `Auto switching Node version from ${detection.currentVersion} to ${versionToSwitch} (source: ${detection.source})`
          );

          // 在终端中执行版本切换命令
          await performanceAnalyzer.measure(
            "terminalService.executeVersionSwitchInTerminal",
            () =>
              this.executeVersionSwitchInTerminal(terminal, versionToSwitch!)
          );

          // 标记为已处理
          this.processedTerminals.add(terminalId);
          logger.info(
            `Terminal ${terminal.name} (ID: ${terminalId}) marked as processed`
          );
          logger.info(
            `Updated processed terminals count: ${this.processedTerminals.size}`
          );
        } catch (error) {
          logger.error(
            `Error during auto terminal version switch for ${terminal.name}:`,
            error
          );
        }
      }
    );
  }

  /**
   * 生成终端的唯一标识符
   */
  private getTerminalId(terminal: Terminal): string {
    // VSCode 的 Terminal 对象本身就是唯一的引用
    // 我们可以使用 WeakMap 来存储终端对象到 ID 的映射
    if (!this.terminalIdMap.has(terminal)) {
      // 为新终端生成唯一 ID
      const id = `terminal_${this.terminalCounter++}_${
        terminal.name
      }_${Date.now()}`;
      this.terminalIdMap.set(terminal, id);
      logger.info(
        `Generated new terminal ID: ${id} for terminal: ${terminal.name}`
      );
    }
    return this.terminalIdMap.get(terminal)!;
  }

  /**
   * 在终端中执行版本切换命令
   */
  private async executeVersionSwitchInTerminal(
    terminal: Terminal,
    version: string
  ): Promise<void> {
    try {
      const manager = await this.nodeManager.getActiveManager();
      if (!manager) {
        logger.warn("No active Node manager found for terminal switch");
        return;
      }

      const managerName = manager.getManagerName();
      // const platformInfo = this.platformUtils.getPlatformInfo()
      let switchCommand: string;

      // 根据不同的版本管理器和平台生成切换命令
      switch (managerName) {
        case "nvm":
          // 直接使用 nvm use 命令，无需加载 nvm.sh(前提配置 nvm)
          switchCommand = `nvm use ${version}`;
          // if (platformInfo.type === 'windows') {
          //   // Windows nvm-windows 命令格式
          //   switchCommand = `nvm use ${version}`
          // } else {
          //   // Unix-like 系统需要先加载 nvm
          //   const initCommand = this.platformUtils.buildNVMInitCommand()
          //   if (initCommand) {
          //     // 发送初始化命令（如果需要）
          //     terminal.sendText(initCommand)
          //     // 稍等一下再发送切换命令
          //     setTimeout(() => {
          //       terminal.sendText(`nvm use ${version}`)
          //     }, 500)
          //     switchCommand = '' // 已经通过 setTimeout 发送
          //   } else {
          //     switchCommand = `nvm use ${version}`
          //   }
          // }
          break;
        case "n":
          switchCommand = `n ${version}`;
          break;
        default:
          logger.warn(
            `Unsupported manager for terminal switch: ${managerName}`
          );
          return;
      }

      // 在终端中发送命令（如果有的话）
      if (switchCommand) {
        terminal.sendText(switchCommand);
        logger.info(`Sent command to terminal: ${switchCommand}`);

        // 等待版本切换命令执行完毕后清屏
        setTimeout(() => {
          const clearCommand = this.getClearCommand();
          terminal.sendText(clearCommand);
          logger.info(`Sent clear command to terminal: ${clearCommand}`);
        }, 1500); // 1.5秒延迟确保版本切换命令完全执行
      }

      // 显示状态信息
      this.showAutoSwitchNotification(version, managerName);
    } catch (error) {
      logger.error("Error executing version switch in terminal:", error);
    }
  }

  /**
   * 获取跨平台清屏命令
   */
  private getClearCommand(): string {
    const platformInfo = this.platformUtils.getPlatformInfo();
    return platformInfo.type === "windows" ? "cls" : "clear";
  }

  /**
   * 显示自动切换通知
   */
  private showAutoSwitchNotification(
    version: string,
    managerName: string
  ): void {
    const message = `🔄 自动切换到 Node ${version} (${managerName})`;

    // 显示状态栏消息（短暂显示）
    window.setStatusBarMessage(message, 3000);

    // 根据配置决定是否显示信息通知
    if (showAutoSwitchNotification.value) {
      window.showInformationMessage(message);
    }
  }

  /**
   * 启用自动切换
   */
  public enableAutoSwitch(): void {
    this.autoSwitchEnabled = true;
    logger.info("Auto Node version switch enabled");
  }

  /**
   * 禁用自动切换
   */
  public disableAutoSwitch(): void {
    this.autoSwitchEnabled = false;
    logger.info("Auto Node version switch disabled");
  }

  /**
   * 获取自动切换状态
   */
  public isAutoSwitchEnabled(): boolean {
    return this.autoSwitchEnabled;
  }

  /**
   * 检查所有已存在的终端并进行版本切换
   */
  public async checkAllExistingTerminals(): Promise<void> {
    // 当前活跃的终端 window.activeTerminal
    return performanceAnalyzer.measure(
      "terminalService.checkAllExistingTerminals",
      async () => {
        try {
          const terminals = window.terminals;
          if (terminals.length === 0) {
            logger.info("No existing terminals found");
            return;
          }

          logger.info(
            `Found ${terminals.length} existing terminals, checking versions...`
          );

          // 并行处理所有终端，但限制并发数量以避免性能问题
          const concurrencyLimit = 3;
          const chunks = [];
          for (let i = 0; i < terminals.length; i += concurrencyLimit) {
            chunks.push(terminals.slice(i, i + concurrencyLimit));
          }

          for (const chunk of chunks) {
            await performanceAnalyzer.measure(
              `terminalService.processTerminalChunk_${chunks.indexOf(chunk)}`,
              () =>
                Promise.all(
                  chunk.map(async (terminal) => {
                    try {
                      await this.handleTerminalCreated(terminal);
                    } catch (error) {
                      logger.error(
                        `Failed to check terminal ${terminal.name}:`,
                        error
                      );
                    }
                  })
                )
            );
          }

          logger.info("Completed checking all existing terminals");
        } catch (error) {
          logger.error("Error checking existing terminals:", error);
        }
      }
    );
  }

  /**
   * 获取终端的工作目录
   */
  private getTerminalWorkspaceRoot(terminal: Terminal): string | null {
    // 尝试从终端的创建选项中获取工作目录
    // 如果无法获取，则使用当前工作区的根目录
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }

    // 对于多工作区，可以根据终端名称或其他信息来判断
    // 这里简化处理，使用第一个工作区
    // 在实际使用中，可以根据终端的 cwd 或其他属性来确定
    return workspaceFolders[0].uri.fsPath;
  }

  /**
   * 检测特定工作区的项目版本配置
   */
  private async detectProjectVersionForWorkspace(
    workspaceRoot: string | null
  ): Promise<{
    hasConfig: boolean;
    requiredVersion?: string;
    source?: string;
    currentVersion?: string;
    needsSwitch?: boolean;
    targetVersion?: string;
  }> {
    if (!workspaceRoot) {
      return { hasConfig: false };
    }

    const cacheKey = `workspace_version_${workspaceRoot}`;

    return cacheManager.cached(
      CACHE_NAMESPACES.TERMINAL_PROCESSING,
      cacheKey,
      async () => {
        try {
          // 并行执行配置读取和当前版本获取
          const [projectConfig, currentVersion] = await Promise.all([
            performanceAnalyzer.measure(
              "terminalService.getProjectConfig",
              () => {
                const configReader = (this.projectDetector as any).configReader;
                return configReader.getProjectNodeVersion(
                  workspaceRoot
                ) as Promise<{
                  version: string;
                  source: string;
                } | null>;
              }
            ),
            performanceAnalyzer.measure(
              "terminalService.getCurrentVersion",
              () => this.getCurrentNodeVersion()
            ),
          ]);

          if (!projectConfig) {
            return { hasConfig: false };
          }

          if (!currentVersion) {
            return {
              hasConfig: true,
              requiredVersion: projectConfig.version,
              source: projectConfig.source,
            };
          }

          // 比较版本
          const versionMatch = await performanceAnalyzer.measure(
            "terminalService.isVersionMatch",
            () => this.isVersionMatch(currentVersion, projectConfig.version)
          );

          return {
            hasConfig: true,
            requiredVersion: projectConfig.version,
            source: projectConfig.source,
            currentVersion,
            needsSwitch: !versionMatch.matches,
            targetVersion: versionMatch.targetVersion,
          };
        } catch (error) {
          logger.error("Error detecting project version for workspace:", error);
          return { hasConfig: false };
        }
      },
      30 * 1000 // 30秒缓存，工作区版本检测结果相对稳定
    );
  }

  /**
   * 获取当前 Node 版本
   */
  private async getCurrentNodeVersion(): Promise<string | null> {
    return cacheManager.cached(
      CACHE_NAMESPACES.NODE_VERSIONS,
      "current_version",
      async () => {
        try {
          const manager = await this.nodeManager.getActiveManager();
          if (!manager) {
            return null;
          }
          return await manager.getCurrentVersion();
        } catch (error) {
          logger.error("Failed to get current Node version:", error);
          return null;
        }
      },
      10 * 1000 // 10秒缓存，当前版本变化不频繁
    );
  }

  /**
   * 检查版本是否匹配，并返回匹配的版本号
   */
  private async isVersionMatch(
    current: string,
    required: string
  ): Promise<{
    matches: boolean;
    targetVersion?: string;
  }> {
    // 创建缓存键，基于当前版本和要求版本
    const cacheKey = `version_match_${current}_${required}`;
    return cacheManager.cached(
      CACHE_NAMESPACES.NODE_VERSIONS,
      cacheKey,
      async () => {
        // 标准化版本号（移除 'v' 前缀）
        const normalizeCurrent = current.replace(/^v/, "");
        let normalizeRequired = required.replace(/^v/, "");

        logger.info(
          `Version matching: current=${normalizeCurrent}, required=${normalizeRequired}`
        );

        // 精确匹配 - 最常见的情况，优先处理
        if (normalizeCurrent === normalizeRequired) {
          return {
            matches: true,
            targetVersion: normalizeCurrent,
          };
        }

        // 处理比较符号
        if (this.hasComparisonOperator(normalizeRequired)) {
          const matches = this.compareVersionWithOperator(
            normalizeCurrent,
            normalizeRequired
          );
          return {
            matches,
            targetVersion: matches ? normalizeCurrent : undefined,
          };
        }

        // 处理语义化版本（^、~）
        if (
          normalizeRequired.startsWith("^") ||
          normalizeRequired.startsWith("~")
        ) {
          const matches = this.matchSemverRange(
            normalizeCurrent,
            normalizeRequired
          );
          return {
            matches,
            targetVersion: matches ? normalizeCurrent : undefined,
          };
        }

        // 不完整版本号匹配（如 '18' 或 '18.2'）
        const requiredParts = normalizeRequired.split(".");

        // 如果要求的版本号不完整（少于3个部分），进行部分匹配
        if (requiredParts.length < 3) {
          // 这里直接借助 nvm 判断切换即可
          const matches = this.isPartialVersionMatch(
            normalizeCurrent,
            normalizeRequired
          );
          return {
            matches,
            targetVersion: normalizeRequired,
          };
        }

        return {
          matches: false,
        };
      },
      2 * 60 * 1000 // 2分钟缓存，版本匹配结果相对稳定
    );
  }

  /**
   * 检查是否包含比较操作符
   */
  private hasComparisonOperator(version: string): boolean {
    return /^(>=|<=|>|<|=)/.test(version);
  }

  /**
   * 使用比较操作符比较版本
   */
  private compareVersionWithOperator(
    current: string,
    required: string
  ): boolean {
    const operatorMatch = required.match(/^(>=|<=|>|<|=)(.+)$/);
    if (!operatorMatch) return false;

    const [, operator, targetVersion] = operatorMatch;
    const currentParsed = this.parseVersion(current);
    const targetParsed = this.parseVersion(targetVersion);

    const comparison = this.compareVersions(currentParsed, targetParsed);

    switch (operator) {
      case ">=":
        return comparison >= 0;
      case "<=":
        return comparison <= 0;
      case ">":
        return comparison > 0;
      case "<":
        return comparison < 0;
      case "=":
        return comparison === 0;
      default:
        return false;
    }
  }

  /**
   * 匹配语义化版本范围（^、~）
   */
  private matchSemverRange(current: string, range: string): boolean {
    const currentParsed = this.parseVersion(current);

    if (range.startsWith("^")) {
      // ^ 允许兼容的版本更新（不改变主版本号）
      const targetVersion = range.substring(1);
      const targetParsed = this.parseVersion(targetVersion);

      return (
        currentParsed.major === targetParsed.major &&
        this.compareVersions(currentParsed, targetParsed) >= 0
      );
    }

    if (range.startsWith("~")) {
      // ~ 允许补丁级别的更新（不改变主版本号和次版本号）
      const targetVersion = range.substring(1);
      const targetParsed = this.parseVersion(targetVersion);

      return (
        currentParsed.major === targetParsed.major &&
        currentParsed.minor === targetParsed.minor &&
        currentParsed.patch >= targetParsed.patch
      );
    }

    return false;
  }

  /**
   * 检查版本是否匹配部分版本号
   * @param fullVersion 完整版本号（如 '18.17.0'）
   * @param partialVersion 部分版本号（如 '18' 或 '18.2'）
   */
  private isPartialVersionMatch(
    fullVersion: string,
    partialVersion: string
  ): boolean {
    const fullParts = this.parseVersion(fullVersion);
    const partialParts = partialVersion.split(".");

    // 标准化部分版本号
    const normalizedPartial = {
      major: partialParts[0] || "0",
      minor: partialParts[1] || "0",
      patch: partialParts[2] || "0",
    };

    // 根据部分版本号的长度进行匹配
    if (partialParts.length === 1) {
      // 只有主版本号（如 '18'）
      return fullParts.major === normalizedPartial.major;
    } else if (partialParts.length === 2) {
      // 主版本号 + 次版本号（如 '18.2'）
      return (
        fullParts.major === normalizedPartial.major &&
        fullParts.minor === normalizedPartial.minor
      );
    } else {
      // 完整版本号
      return (
        fullParts.major === normalizedPartial.major &&
        fullParts.minor === normalizedPartial.minor &&
        fullParts.patch === normalizedPartial.patch
      );
    }
  }

  /**
   * 解析版本号为对象
   */
  private parseVersion(version: string): {
    major: string;
    minor: string;
    patch: string;
  } {
    const normalized = version.replace(/^v/, "");
    const parts = normalized.split(".");

    return {
      major: parts[0] || "0",
      minor: parts[1] || "0",
      patch: parts[2] || "0",
    };
  }

  /**
   * 比较两个版本号
   * @returns 0 if equal, > 0 if v1 > v2, < 0 if v1 < v2
   */
  private compareVersions(
    v1: { major: string; minor: string; patch: string },
    v2: { major: string; minor: string; patch: string }
  ): number {
    const major1 = parseInt(v1.major, 10);
    const major2 = parseInt(v2.major, 10);
    if (major1 !== major2) return major1 - major2;

    const minor1 = parseInt(v1.minor, 10);
    const minor2 = parseInt(v2.minor, 10);
    if (minor1 !== minor2) return minor1 - minor2;

    const patch1 = parseInt(v1.patch, 10);
    const patch2 = parseInt(v2.patch, 10);
    return patch1 - patch2;
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables = [];
  }
}
