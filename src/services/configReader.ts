import * as fs from "fs";
import * as path from "path";
import { logger } from "../utils";
import { performanceAnalyzer } from "../utils/performanceAnalyzer";
import { cacheManager, CACHE_NAMESPACES } from "../utils/cacheManager";

/**
 * 配置文件读取服务
 * 负责读取和解析各种 Node 版本配置文件
 */
export class ConfigReaderService {
  private static instance: ConfigReaderService;

  public static getInstance(): ConfigReaderService {
    if (!ConfigReaderService.instance) {
      ConfigReaderService.instance = new ConfigReaderService();
    }
    return ConfigReaderService.instance;
  }

  /**
   * 读取 .nvmrc 文件
   */
  public async readNvmrc(workspaceRoot: string): Promise<string | null> {
    const nvmrcPath = path.join(workspaceRoot, ".nvmrc");
    return this.readVersionFile(nvmrcPath, ".nvmrc");
  }

  /**
   * 读取 .node-version 文件
   */
  public async readNodeVersion(workspaceRoot: string): Promise<string | null> {
    const nodeVersionPath = path.join(workspaceRoot, ".node-version");
    return this.readVersionFile(nodeVersionPath, ".node-version");
  }

  /**
   * 读取 package.json 中的 Node 版本配置
   */
  public async readPackageJson(workspaceRoot: string): Promise<{
    engines?: string;
    volta?: string;
  } | null> {
    const packageJsonPath = path.join(workspaceRoot, "package.json");
    const cacheKey = `package_json_${packageJsonPath}`;

    return cacheManager.cached(
      CACHE_NAMESPACES.CONFIG_FILES,
      cacheKey,
      async () => {
        try {
          if (!fs.existsSync(packageJsonPath)) {
            return null;
          }

          const content = fs.readFileSync(packageJsonPath, "utf8");
          const packageJson = JSON.parse(content);

          const result: { engines?: string; volta?: string } = {};

          // 检查 engines.node 字段
          if (packageJson.engines?.node) {
            result.engines = packageJson.engines.node;
          }

          // 检查 volta.node 字段
          if (packageJson.volta?.node) {
            result.volta = packageJson.volta.node;
          }

          return Object.keys(result).length > 0 ? result : null;
        } catch (error) {
          logger.error(`Failed to read package.json: ${error}`);
          return null;
        }
      },
      30 * 1000 // 30秒缓存，package.json 可能会更频繁地变化
    );
  }

  /**
   * 读取 .tool-versions 文件（ASDF 版本管理器）
   */
  public async readToolVersions(workspaceRoot: string): Promise<string | null> {
    const toolVersionsPath = path.join(workspaceRoot, ".tool-versions");

    try {
      if (!fs.existsSync(toolVersionsPath)) {
        return null;
      }

      const content = fs.readFileSync(toolVersionsPath, "utf8");
      const lines = content.split("\n");

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith("nodejs ")) {
          const version = trimmedLine.replace("nodejs ", "").trim();
          logger.info(`Found Node version in .tool-versions: ${version}`);
          return version;
        }
      }

      return null;
    } catch (error) {
      logger.error(`Failed to read .tool-versions: ${error}`);
      return null;
    }
  }

  /**
   * 获取项目配置的 Node 版本（按优先级）
   */
  public async getProjectNodeVersion(workspaceRoot: string): Promise<{
    version: string;
    source: string;
  } | null> {
    const cacheKey = `project_version_${workspaceRoot}`;

    return cacheManager.cached(
      CACHE_NAMESPACES.CONFIG_FILES,
      cacheKey,
      () =>
        performanceAnalyzer.measure(
          "configReader.getProjectNodeVersion",
          async () => {
            // 按优先级检查配置文件
            const checks = [
              {
                method: () =>
                  performanceAnalyzer.measure("configReader.readNvmrc", () =>
                    this.readNvmrc(workspaceRoot)
                  ),
                source: ".nvmrc",
              },
              {
                method: () =>
                  performanceAnalyzer.measure(
                    "configReader.readNodeVersion",
                    () => this.readNodeVersion(workspaceRoot)
                  ),
                source: ".node-version",
              },
              {
                method: () =>
                  performanceAnalyzer.measure(
                    "configReader.readToolVersions",
                    () => this.readToolVersions(workspaceRoot)
                  ),
                source: ".tool-versions",
              },
            ];

            for (const check of checks) {
              const version = await check.method();
              if (version) {
                return {
                  version: this.normalizeVersion(version),
                  source: check.source,
                };
              }
            }

            // 检查 package.json
            const packageConfig = await performanceAnalyzer.measure(
              "configReader.readPackageJson",
              () => this.readPackageJson(workspaceRoot)
            );
            if (packageConfig) {
              if (packageConfig.volta) {
                return {
                  version: this.normalizeVersion(packageConfig.volta),
                  source: "package.json (volta.node)",
                };
              }
              if (packageConfig.engines) {
                return {
                  version: this.normalizeVersion(packageConfig.engines),
                  source: "package.json (engines.node)",
                };
              }
            }

            return null;
          }
        ),
      2 * 60 * 1000 // 2分钟缓存，配置文件变化相对较少
    );
  }

  /**
   * 读取版本文件的通用方法
   */
  private async readVersionFile(
    filePath: string,
    fileName: string
  ): Promise<string | null> {
    const cacheKey = `file_${filePath}_${fileName}`;

    return cacheManager.cached(
      CACHE_NAMESPACES.CONFIG_FILES,
      cacheKey,
      () =>
        performanceAnalyzer.measure(
          `configReader.readVersionFile_${fileName}`,
          async () => {
            try {
              performanceAnalyzer.start(`configReader.fileExists_${fileName}`);
              if (!fs.existsSync(filePath)) {
                performanceAnalyzer.end(`configReader.fileExists_${fileName}`);
                return null;
              }
              performanceAnalyzer.end(`configReader.fileExists_${fileName}`);

              const content = performanceAnalyzer.measureSync(
                `configReader.readFileSync_${fileName}`,
                () => fs.readFileSync(filePath, "utf8").trim()
              );

              if (content) {
                logger.info(`Found Node version in ${fileName}: ${content}`);
                return content;
              }

              return null;
            } catch (error) {
              logger.error(`Failed to read ${fileName}: ${error}`);
              return null;
            }
          }
        ),
      60 * 1000 // 1分钟缓存，版本文件变化较少
    );
  }

  /**
   * 标准化版本号格式
   */
  private normalizeVersion(version: string): string {
    // 移除 'v' 前缀
    let normalized = version.replace(/^v/, "");

    // 处理范围版本（如 >=18.0.0, ^18.17.0）
    // 这里简化处理，实际使用时可能需要更复杂的版本解析
    if (
      normalized.includes(">=") ||
      normalized.includes("^") ||
      normalized.includes("~")
    ) {
      // 对于范围版本，提取基础版本号
      const match = normalized.match(/([0-9]+\.[0-9]+\.[0-9]+)/);
      if (match) {
        normalized = match[1];
      }
    }

    return normalized;
  }

  /**
   * 检查配置文件是否存在
   */
  public hasConfigFiles(workspaceRoot: string): boolean {
    const configFiles = [
      ".nvmrc",
      ".node-version",
      ".tool-versions",
      "package.json",
    ];

    return configFiles.some((file) => {
      const filePath = path.join(workspaceRoot, file);
      return fs.existsSync(filePath);
    });
  }
}
