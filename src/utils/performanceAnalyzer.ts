/**
 * 性能分析工具
 * 用于测量和分析插件各个操作的耗时
 */
export class PerformanceAnalyzer {
  private static instance: PerformanceAnalyzer
  private measurements = new Map<string, number[]>()
  private startTimes = new Map<string, number>()
  private enabled = true

  static getInstance(): PerformanceAnalyzer {
    if (!PerformanceAnalyzer.instance) {
      PerformanceAnalyzer.instance = new PerformanceAnalyzer()
    }
    return PerformanceAnalyzer.instance
  }

  /**
   * 开始测量
   */
  start(operation: string): void {
    if (!this.enabled) return
    this.startTimes.set(operation, performance.now())
  }

  /**
   * 结束测量并记录耗时
   */
  end(operation: string): number {
    if (!this.enabled) return 0
    
    const startTime = this.startTimes.get(operation)
    if (!startTime) {
      console.warn(`Performance measurement not started for: ${operation}`)
      return 0
    }

    const duration = performance.now() - startTime
    this.startTimes.delete(operation)

    // 记录测量结果
    if (!this.measurements.has(operation)) {
      this.measurements.set(operation, [])
    }
    this.measurements.get(operation)!.push(duration)

    console.log(`⏱️ [Performance] ${operation}: ${duration.toFixed(2)}ms`)
    return duration
  }

  /**
   * 测量异步操作
   */
  async measure<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    this.start(operation)
    try {
      const result = await fn()
      this.end(operation)
      return result
    } catch (error) {
      this.end(operation)
      throw error
    }
  }

  /**
   * 测量同步操作
   */
  measureSync<T>(operation: string, fn: () => T): T {
    this.start(operation)
    try {
      const result = fn()
      this.end(operation)
      return result
    } catch (error) {
      this.end(operation)
      throw error
    }
  }

  /**
   * 获取操作的统计信息
   */
  getStats(operation: string): {
    count: number
    total: number
    average: number
    min: number
    max: number
  } | null {
    const measurements = this.measurements.get(operation)
    if (!measurements || measurements.length === 0) {
      return null
    }

    const total = measurements.reduce((sum, time) => sum + time, 0)
    const average = total / measurements.length
    const min = Math.min(...measurements)
    const max = Math.max(...measurements)

    return {
      count: measurements.length,
      total,
      average,
      min,
      max
    }
  }

  /**
   * 获取所有操作的统计报告
   */
  getReport(): string {
    const operations = Array.from(this.measurements.keys())
    if (operations.length === 0) {
      return 'No performance measurements recorded.'
    }

    let report = '\n📊 Performance Analysis Report\n'
    report += '================================\n\n'

    operations.forEach(operation => {
      const stats = this.getStats(operation)
      if (stats) {
        report += `🔍 ${operation}:\n`
        report += `   Count: ${stats.count}\n`
        report += `   Total: ${stats.total.toFixed(2)}ms\n`
        report += `   Average: ${stats.average.toFixed(2)}ms\n`
        report += `   Min: ${stats.min.toFixed(2)}ms\n`
        report += `   Max: ${stats.max.toFixed(2)}ms\n\n`
      }
    })

    // 找出最耗时的操作
    const slowestOperations = operations
      .map(op => ({ operation: op, stats: this.getStats(op)! }))
      .filter(item => item.stats)
      .sort((a, b) => b.stats.average - a.stats.average)
      .slice(0, 5)

    if (slowestOperations.length > 0) {
      report += '🐌 Top 5 Slowest Operations (by average):\n'
      slowestOperations.forEach((item, index) => {
        report += `   ${index + 1}. ${item.operation}: ${item.stats.average.toFixed(2)}ms\n`
      })
      report += '\n'
    }

    return report
  }

  /**
   * 清除所有测量数据
   */
  clear(): void {
    this.measurements.clear()
    this.startTimes.clear()
  }

  /**
   * 启用/禁用性能测量
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * 输出性能报告到控制台
   */
  printReport(): void {
    console.log(this.getReport())
  }
}

// 导出单例实例
export const performanceAnalyzer = PerformanceAnalyzer.getInstance()