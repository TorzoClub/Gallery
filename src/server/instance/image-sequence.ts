import { Sequence } from 'vait'

/**
 * 图片转换只允许一个任务占用大块内存。这里直接复用 vait 的单并发队列：
 * - FIFO
 * - 一个任务失败不会阻塞后续任务
 */
export function CreateImageSequence(): <T>(task: () => Promise<T>) => Promise<T> {
  return Sequence()
}
