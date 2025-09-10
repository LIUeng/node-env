import { BaseNodeManager } from "../managers/base";
import { NVMManager } from "../managers/nvm";
import { NManager } from "../managers/n";
import { EnvironmentDetector } from "./environmentDetector";
import { PlatformUtils } from "../utils/platformUtils";
import { performanceAnalyzer } from "../utils/performanceAnalyzer";
import {
  NodeManagerType,
  ManagerDetectionResult,
  PluginConfig,
} from "../types";

/**
 * Node 版本管理服务
 * 统一管理不同的版本管理器
 */
export class NodeManagerService {
  private static instance: NodeManagerService;
  private managers: Map<NodeManagerType, BaseNodeManager> = new Map();
  private environmentDetector: EnvironmentDetector;
  private platformUtils: PlatformUtils;
  private activeManager: BaseNodeManager | null = null;
  private config: PluginConfig;

  private constructor() {
    this.environmentDetector = EnvironmentDetector.getInstance();
    this.platformUtils = PlatformUtils.getInstance();
    this.config = {
      autoSwitch: true,
      showInStatusBar: true,
      preferredManager: "auto",
      terminalIntegration: true,
      autoDetectVersion: true,
      // watchConfigFiles: true,
    };
    this.initializeManagers();
  }

  static getInstance(): NodeManagerService {
    if (!NodeManagerService.instance) {
      NodeManagerService.instance = new NodeManagerService();
    }
    return NodeManagerService.instance;
  }

  /**
   * 初始化版本管理器
   */
  private initializeManagers(): void {
    const platformInfo = this.platformUtils.getPlatformInfo();

    // 统一使用 NVMManager，内部自动处理平台差异
    this.managers.set("nvm", new NVMManager());

    // N 管理器主要用于 Unix-like 系统
    if (platformInfo.type !== "windows") {
      this.managers.set("n", new NManager());
    }
  }

  /**
   * 检测并设置活跃的版本管理器
   */
  async detectAndSetActiveManager(): Promise<BaseNodeManager | null> {
    return performanceAnalyzer.measure(
      "nodeManager.detectAndSetActiveManager",
      async () => {
        try {
          const detectionResults = await performanceAnalyzer.measure(
            "environmentDetector.detectAllManagers",
            () => this.environmentDetector.detectAllManagers()
          );

          const availableManagers = detectionResults.filter(
            (result) => result.available
          );

          if (availableManagers.length === 0) {
            console.warn("No Node version managers found");
            return null;
          }

          // 根据配置选择管理器
          let selectedManager: ManagerDetectionResult | null = null;

          performanceAnalyzer.start("nodeManager.selectManager");
          if (this.config.preferredManager === "auto") {
            // 自动选择：优先 nvm，然后 n
            selectedManager =
              availableManagers.find((m) => m.type === "nvm") ||
              availableManagers.find((m) => m.type === "n") ||
              availableManagers[0];
          } else if (this.config.preferredManager !== "unknown") {
            // 使用指定的管理器
            selectedManager =
              availableManagers.find(
                (m) => m.type === this.config.preferredManager
              ) || null;

            // 如果指定的管理器不可用，回退到自动选择
            if (!selectedManager) {
              console.warn(
                `Preferred manager ${this.config.preferredManager} not available, falling back to auto selection`
              );
              selectedManager = availableManagers[0] || null;
            }
          }
          performanceAnalyzer.end("nodeManager.selectManager");

          if (selectedManager) {
            this.activeManager =
              this.managers.get(selectedManager.type) || null;
            console.log(`Active Node manager set to: ${selectedManager.type}`);
          }

          return this.activeManager;
        } catch (error) {
          console.error("Error detecting Node managers:", error);
          return null;
        }
      }
    );
  }

  /**
   * 获取当前活跃的管理器
   */
  async getActiveManager(): Promise<BaseNodeManager | null> {
    return performanceAnalyzer.measure(
      "nodeManager.getActiveManager",
      async () => {
        if (!this.activeManager) {
          await this.detectAndSetActiveManager();
        }
        return this.activeManager;
      }
    );
  }
}
