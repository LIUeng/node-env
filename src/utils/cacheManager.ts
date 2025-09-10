/**
 * 缓存管理器
 * 用于缓存各种检测结果，减少重复的文件读取和命令执行
 */
export class CacheManager {
  private static instance: CacheManager
  private caches = new Map<string, Map<string, CacheEntry>>()
  private defaultTTL = 5 * 60 * 1000 // 5分钟默认缓存时间

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager()
    }
    return CacheManager.instance
  }

  /**
   * 设置缓存
   */
  set<T>(namespace: string, key: string, value: T, ttl?: number): void {
    if (!this.caches.has(namespace)) {
      this.caches.set(namespace, new Map())
    }

    const cache = this.caches.get(namespace)!
    const entry: CacheEntry = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    }

    cache.set(key, entry)
    console.log(`🗄️ [Cache] Set ${namespace}:${key} (TTL: ${entry.ttl}ms)`)
  }

  /**
   * 获取缓存
   */
  get<T>(namespace: string, key: string): T | null {
    const cache = this.caches.get(namespace)
    if (!cache) {
      return null
    }

    const entry = cache.get(key)
    if (!entry) {
      return null
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      cache.delete(key)
      console.log(`⏰ [Cache] Expired ${namespace}:${key}`)
      return null
    }

    console.log(`✅ [Cache] Hit ${namespace}:${key}`)
    return entry.value as T
  }

  /**
   * 检查缓存是否存在且未过期
   */
  has(namespace: string, key: string): boolean {
    return this.get(namespace, key) !== null
  }

  /**
   * 删除特定缓存
   */
  delete(namespace: string, key?: string): void {
    if (!key) {
      // 删除整个命名空间
      this.caches.delete(namespace)
      console.log(`🗑️ [Cache] Cleared namespace ${namespace}`)
      return
    }

    const cache = this.caches.get(namespace)
    if (cache) {
      cache.delete(key)
      console.log(`🗑️ [Cache] Deleted ${namespace}:${key}`)
    }
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.caches.clear()
    console.log('🗑️ [Cache] Cleared all caches')
  }

  /**
   * 清除过期缓存
   */
  cleanup(): void {
    const now = Date.now()
    let cleanedCount = 0

    for (const [namespace, cache] of Array.from(this.caches.entries())) {
      const keysToDelete: string[] = []
      
      for (const [key, entry] of Array.from(cache.entries())) {
        if (now - entry.timestamp > entry.ttl) {
          keysToDelete.push(key)
        }
      }

      keysToDelete.forEach(key => {
        cache.delete(key)
        cleanedCount++
      })

      // 如果命名空间为空，删除它
      if (cache.size === 0) {
        this.caches.delete(namespace)
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 [Cache] Cleaned up ${cleanedCount} expired entries`)
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    let totalEntries = 0
    let expiredEntries = 0
    const now = Date.now()
    const namespaces: string[] = []

    for (const [namespace, cache] of Array.from(this.caches.entries())) {
      namespaces.push(namespace)
      
      for (const [, entry] of Array.from(cache.entries())) {
        totalEntries++
        if (now - entry.timestamp > entry.ttl) {
          expiredEntries++
        }
      }
    }

    return {
      totalEntries,
      expiredEntries,
      activeEntries: totalEntries - expiredEntries,
      namespaces: namespaces.length,
      namespacesDetail: namespaces
    }
  }

  /**
   * 缓存装饰器 - 用于方法级别的缓存
   */
  async cached<T>(
    namespace: string,
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // 尝试从缓存获取
    const cached = this.get<T>(namespace, key)
    if (cached !== null) {
      return cached
    }

    // 执行函数并缓存结果
    const result = await fn()
    this.set(namespace, key, result, ttl)
    return result
  }

  /**
   * 同步版本的缓存装饰器
   */
  cachedSync<T>(
    namespace: string,
    key: string,
    fn: () => T,
    ttl?: number
  ): T {
    // 尝试从缓存获取
    const cached = this.get<T>(namespace, key)
    if (cached !== null) {
      return cached
    }

    // 执行函数并缓存结果
    const result = fn()
    this.set(namespace, key, result, ttl)
    return result
  }

  /**
   * 启动定期清理任务
   */
  startCleanupTimer(intervalMs: number = 60000): void {
    setInterval(() => {
      this.cleanup()
    }, intervalMs)
    console.log(`🕐 [Cache] Started cleanup timer (${intervalMs}ms interval)`)
  }

  /**
   * 打印缓存状态
   */
  printStats(): void {
    const stats = this.getStats()
    console.log('\n📊 Cache Statistics:')
    console.log(`   Total Entries: ${stats.totalEntries}`)
    console.log(`   Active Entries: ${stats.activeEntries}`)
    console.log(`   Expired Entries: ${stats.expiredEntries}`)
    console.log(`   Namespaces: ${stats.namespaces}`)
    console.log(`   Namespace Details: ${stats.namespacesDetail.join(', ')}`)
  }
}

// 缓存条目接口
interface CacheEntry {
  value: any
  timestamp: number
  ttl: number
}

// 缓存统计接口
interface CacheStats {
  totalEntries: number
  expiredEntries: number
  activeEntries: number
  namespaces: number
  namespacesDetail: string[]
}

// 导出单例实例
export const cacheManager = CacheManager.getInstance()

// 缓存命名空间常量
export const CACHE_NAMESPACES = {
  ENVIRONMENT_DETECTION: 'env_detection',
  CONFIG_FILES: 'config_files',
  NODE_VERSIONS: 'node_versions',
  TERMINAL_PROCESSING: 'terminal_processing',
  MANAGER_DETECTION: 'manager_detection'
} as const