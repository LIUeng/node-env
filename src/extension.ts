import { defineExtension } from "reactive-vscode";
import { window, workspace } from "vscode";
import { terminalIntegration, autoSwitch } from "./configs";
import { logger } from "./utils";
import { NodeManagerService } from "./services/nodeManager";
// import { FileWatcherService } from './services/fileWatcher'
import { TerminalService } from "./services/terminalService";
import { cacheManager } from "./utils/cacheManager";
import { performanceAnalyzer } from "./utils/performanceAnalyzer";

export = defineExtension(() => {
  logger.info("Node Env Extension Activated");

  // 缓存管理器使用懒加载清理策略，无需定时器
  // 过期缓存在访问时自动清理，避免不必要的后台任务

  // 初始化服务
  const nodeManager = NodeManagerService.getInstance();
  // const fileWatcher = FileWatcherService.getInstance()
  const terminalService = TerminalService.getInstance();

  // 初始化版本管理器并启动服务
  initializeExtension(nodeManager, terminalService)
    .then(() => {
      logger.info("Node Env Extension initialized successfully");

      // 输出性能报告（开发模式下）
      if (process.env.NODE_ENV === "development") {
        setTimeout(() => {
          performanceAnalyzer.printReport();
          cacheManager.printStats();
        }, 5000); // 5秒后输出报告
      }
    })
    .catch((error) => {
      logger.error("Failed to initialize Node Env Extension:", error);
    });

  /**
   * 初始化扩展的主要逻辑
   */
  async function initializeExtension(
    nodeManager: NodeManagerService,
    terminalService: TerminalService
  ): Promise<void> {
    try {
      // 1. 检测并设置活跃的版本管理器
      const manager = await nodeManager.detectAndSetActiveManager();
      if (!manager) {
        logger.warn("No Node version manager detected");
        return;
      }

      logger.info(`Active Node manager: ${manager.getManagerName()}`);

      // 2. 等待 VSCode 服务完全加载
      await waitForVSCodeServices();

      // 3. 根据配置启用终端集成
      if (terminalIntegration.value && autoSwitch.value) {
        // 启用自动切换
        terminalService.enableAutoSwitch();
        logger.info("Terminal auto-switch enabled");

        // 4. 等待终端服务就绪后检查已存在的终端
        await waitForTerminalServiceReady(terminalService);

        // 5. 检查所有已存在的终端并进行版本切换
        await terminalService.checkAllExistingTerminals();
        logger.info("Existing terminals checked and processed");
      }
    } catch (error) {
      logger.error("Error during extension initialization:", error);
      throw error;
    }
  }

  /**
   * 等待 VSCode 服务完全加载
   */
  async function waitForVSCodeServices(): Promise<void> {
    return new Promise<void>((resolve) => {
      // 检查工作区是否已加载
      if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
        // 工作区已加载，立即解析
        resolve();
        return;
      }

      // 监听工作区变化事件
      const disposable = workspace.onDidChangeWorkspaceFolders(() => {
        if (
          workspace.workspaceFolders &&
          workspace.workspaceFolders.length > 0
        ) {
          disposable.dispose();
          resolve();
        }
      });

      // 设置超时，避免无限等待
      setTimeout(() => {
        disposable.dispose();
        resolve(); // 即使没有工作区也继续执行
      }, 2000);
    });
  }

  /**
   * 等待终端服务就绪
   */
  async function waitForTerminalServiceReady(
    terminalService: TerminalService
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      // 检查是否已有终端存在
      if (window.terminals.length > 0) {
        // 已有终端，立即解析
        resolve();
        return;
      }

      // 监听终端创建事件
      const disposable = window.onDidOpenTerminal(() => {
        disposable.dispose();
        // 给终端一点时间完成初始化
        setTimeout(() => resolve(), 100);
      });

      // 设置超时，避免无限等待
      setTimeout(() => {
        disposable.dispose();
        resolve(); // 即使没有终端也继续执行
      }, 1000);
    });
  }

  // 插件已完全初始化，专注于自动切换功能
  logger.info("Node Env Extension commands registered successfully");

  // 返回清理函数，在插件卸载时执行
  return () => {
    logger.info("Node Env Extension Deactivating");
    
    // 清理缓存
    cacheManager.clear();
    logger.info("Cache cleared on extension deactivation");
    
    // 清理终端服务
    terminalService.dispose();
    logger.info("Terminal service disposed");
  };
});
