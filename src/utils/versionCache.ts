/**
 * 版本信息缓存管理器
 * 用于缓存 Node 版本信息，减少重复的 shell 命令执行
 */
export interface CacheEntry<T> {
  value: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

export class VersionCache {
  private static instance: VersionCache
  private cache = new Map<string, CacheEntry<any>>()
  private readonly DEFAULT_TTL = 30000 // 30 seconds default TTL
  private readonly CURRENT_VERSION_TTL = 5000 // 5 seconds for current version (changes frequently)
  private readonly INSTALLED_VERSIONS_TTL = 60000 // 1 minute for installed versions
  private readonly AVAILABLE_VERSIONS_TTL = 300000 // 5 minutes for available versions

  private constructor() {}

  static getInstance(): VersionCache {
    if (!VersionCache.instance) {
      VersionCache.instance = new VersionCache()
    }
    return VersionCache.instance
  }

  /**
   * 获取缓存值
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) {
      return null
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.value
  }

  /**
   * 设置缓存值
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const actualTtl = ttl || this.getTTLForKey(key)
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: actualTtl
    })
  }

  /**
   * 删除缓存项
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * 获取或设置缓存（如果不存在则执行 factory 函数）
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const value = await factory()
    this.set(key, value, ttl)
    return value
  }

  /**
   * 根据 key 获取合适的 TTL
   */
  private getTTLForKey(key: string): number {
    if (key.includes('current-version')) {
      return this.CURRENT_VERSION_TTL
    }
    if (key.includes('installed-versions')) {
      return this.INSTALLED_VERSIONS_TTL
    }
    if (key.includes('available-versions')) {
      return this.AVAILABLE_VERSIONS_TTL
    }
    return this.DEFAULT_TTL
  }

  /**
   * 清理过期的缓存项
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    size: number
    keys: string[]
    hitRate?: number
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }

  /**
   * 使缓存失效（当版本切换时调用）
   */
  invalidateVersionCaches(manager: string): void {
    const keysToDelete: string[] = []
    for (const key of this.cache.keys()) {
      if (key.includes(manager) && (key.includes('current-version') || key.includes('installed-versions'))) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key))
  }
}

/**
 * 性能监控装饰器
 */
export function withPerformanceMonitoring<T extends any[], R>(
  name: string,
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now()
    try {
      const result = await fn(...args)
      const duration = Date.now() - startTime
      console.log(`[Performance] ${name}: ${duration}ms`)
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`[Performance] ${name} failed after ${duration}ms:`, error)
      throw error
    }
  }
}

/**
 * 缓存键生成器
 */
export class CacheKeyGenerator {
  static currentVersion(manager: string, platform: string): string {
    return `${manager}-${platform}-current-version`
  }

  static installedVersions(manager: string, platform: string): string {
    return `${manager}-${platform}-installed-versions`
  }

  static availableVersions(manager: string, platform: string): string {
    return `${manager}-${platform}-available-versions`
  }

  static commandResult(manager: string, command: string, args: string[]): string {
    return `${manager}-command-${command}-${args.join('-')}`
  }
}