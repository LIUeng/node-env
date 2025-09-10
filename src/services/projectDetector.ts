import { workspace } from "vscode";
import { ConfigReaderService } from "./configReader";
import { NodeManagerService } from "./nodeManager";
import { logger } from "../utils";

/**
 * 项目版本检测服务
 * 负责检测项目配置的 Node 版本并与当前版本进行比较
 */
export class ProjectDetectorService {
  private static instance: ProjectDetectorService;
  private configReader: ConfigReaderService;
  private nodeManager: NodeManagerService;

  private constructor() {
    this.configReader = ConfigReaderService.getInstance();
    this.nodeManager = NodeManagerService.getInstance();
  }

  public static getInstance(): ProjectDetectorService {
    if (!ProjectDetectorService.instance) {
      ProjectDetectorService.instance = new ProjectDetectorService();
    }
    return ProjectDetectorService.instance;
  }

  /**
   * 检测当前工作区的 Node 版本配置
   */
  public async detectProjectVersion(): Promise<{
    hasConfig: boolean;
    requiredVersion?: string;
    source?: string;
    currentVersion?: string;
    needsSwitch?: boolean;
  }> {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      logger.info("No workspace folder found");
      return { hasConfig: false };
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    logger.info(`Detecting project version in: ${workspaceRoot}`);

    // 检查是否有配置文件
    if (!this.configReader.hasConfigFiles(workspaceRoot)) {
      logger.info("No Node version config files found");
      return { hasConfig: false };
    }

    // 获取项目配置的版本
    const projectConfig = await this.configReader.getProjectNodeVersion(
      workspaceRoot
    );
    if (!projectConfig) {
      logger.info("No valid Node version found in config files");
      return { hasConfig: false };
    }

    logger.info(
      `Found project Node version: ${projectConfig.version} (from ${projectConfig.source})`
    );

    // 获取当前 Node 版本
    const currentVersion = await this.getCurrentNodeVersion();
    if (!currentVersion) {
      logger.warn("Could not determine current Node version");
      return {
        hasConfig: true,
        requiredVersion: projectConfig.version,
        source: projectConfig.source,
      };
    }

    // 比较版本
    const needsSwitch = !this.isVersionMatch(
      currentVersion,
      projectConfig.version
    );

    return {
      hasConfig: true,
      requiredVersion: projectConfig.version,
      source: projectConfig.source,
      currentVersion,
      needsSwitch,
    };
  }

  /**
   * 获取当前 Node 版本
   */
  private async getCurrentNodeVersion(): Promise<string | null> {
    try {
      const manager = await this.nodeManager.getActiveManager();
      if (!manager) {
        logger.warn("No active Node manager found");
        return null;
      }

      const currentVersion = await manager.getCurrentVersion();
      logger.info(`getCurrentVersion returned: ${currentVersion}`);
      return currentVersion || null;
    } catch (error) {
      logger.error("Failed to get current Node version:", error);
      return null;
    }
  }

  /**
   * 检查版本是否匹配
   */
  private isVersionMatch(current: string, required: string): boolean {
    // 标准化版本号（移除 'v' 前缀）
    const normalizeCurrent = current.replace(/^v/, "");
    const normalizeRequired = required.replace(/^v/, "");

    // 精确匹配
    if (normalizeCurrent === normalizeRequired) {
      return true;
    }

    // 主版本匹配（如果要求的是主版本号）
    const currentMajor = normalizeCurrent.split(".")[0];
    const requiredMajor = normalizeRequired.split(".")[0];

    // 如果要求的版本只有主版本号，则只比较主版本
    if (!normalizeRequired.includes(".") && currentMajor === requiredMajor) {
      return true;
    }

    // 处理别名版本
    if (required === "lts" || required === "stable" || required === "latest") {
      // 这里需要更复杂的逻辑来判断 LTS 版本
      // 暂时返回 false，让用户手动处理
      return false;
    }

    return false;
  }

  /**
   * 获取工作区根目录
   */
  public getWorkspaceRoot(): string | null {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }
    return workspaceFolders[0].uri.fsPath;
  }
}
