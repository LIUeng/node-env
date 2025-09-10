import { workspace, FileSystemWatcher, Uri, RelativePattern } from 'vscode'
import { logger } from '../utils'
import * as path from 'path'

/**
 * 配置文件监听服务
 * 监听 Node 版本配置文件的变化并自动检测
 */
export class FileWatcherService {
  private static instance: FileWatcherService
  private watchers: FileSystemWatcher[] = []
  // private projectDetector: ProjectDetectorService

  private constructor() {
    // this.projectDetector = ProjectDetectorService.getInstance()
  }

  public static getInstance(): FileWatcherService {
    if (!FileWatcherService.instance) {
      FileWatcherService.instance = new FileWatcherService()
    }
    return FileWatcherService.instance
  }

  /**
   * 开始监听配置文件变化
   */
  public startWatching(): void {
    const workspaceFolders = workspace.workspaceFolders
    if (!workspaceFolders || workspaceFolders.length === 0) {
      logger.info('No workspace folders to watch')
      return
    }

    // 监听的配置文件列表
    const configFiles = [
      '.nvmrc',
      '.node-version',
      '.tool-versions',
      'package.json'
    ]

    for (const workspaceFolder of workspaceFolders) {
      for (const configFile of configFiles) {
        const pattern = new RelativePattern(workspaceFolder, configFile)
        const watcher = workspace.createFileSystemWatcher(pattern)

        // 监听文件创建
        watcher.onDidCreate((uri) => {
          logger.info(`Config file created: ${uri.fsPath}`)
          this.handleConfigChange(uri)
        })

        // 监听文件修改
        watcher.onDidChange((uri) => {
          logger.info(`Config file changed: ${uri.fsPath}`)
          this.handleConfigChange(uri)
        })

        // 监听文件删除
        watcher.onDidDelete((uri) => {
          logger.info(`Config file deleted: ${uri.fsPath}`)
          // 文件删除时也可能需要重新检测
          this.handleConfigChange(uri)
        })

        this.watchers.push(watcher)
      }
    }

    logger.info(`Started watching ${this.watchers.length} config file patterns`)
  }

  /**
   * 停止监听
   */
  public stopWatching(): void {
    for (const watcher of this.watchers) {
      watcher.dispose()
    }
    this.watchers = []
    logger.info('Stopped watching config files')
  }

  /**
   * 处理配置文件变化
   */
  private async handleConfigChange(uri: Uri): Promise<void> {
    try {
      // 延迟一点时间，确保文件写入完成
      setTimeout(async () => {
        try {
          const fileName = path.basename(uri.fsPath)
          logger.info(`Processing config file change: ${fileName}`)
        } catch (error) {
          logger.error('Error handling config file change:', error)
        }
      }, 500)
    } catch (error) {
      logger.error('Error in handleConfigChange:', error)
    }
  }

  /**
   * 重新启动监听（用于工作区变化时）
   */
  public restartWatching(): void {
    this.stopWatching()
    this.startWatching()
  }
}