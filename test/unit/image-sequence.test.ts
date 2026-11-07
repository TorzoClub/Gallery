import { describe, expect, it } from 'vitest'
import { CreateImageSequence } from '../../src/server/instance/image-sequence'

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('image processing sequence', () => {
  it('runs image tasks one at a time in FIFO order', async () => {
    const sequence = CreateImageSequence()
    const gate = deferred()
    const events: string[] = []
    let active = 0
    let max_active = 0

    const first = sequence(async () => {
      active += 1
      max_active = Math.max(max_active, active)
      events.push('first:start')
      await gate.promise
      events.push('first:end')
      active -= 1
    })
    const second = sequence(async () => {
      active += 1
      max_active = Math.max(max_active, active)
      events.push('second:start')
      events.push('second:end')
      active -= 1
    })

    await new Promise(resolve => setTimeout(resolve, 0))
    expect(events).toEqual(['first:start'])

    gate.resolve()
    await Promise.all([first, second])

    expect(max_active).toBe(1)
    expect(events).toEqual([
      'first:start',
      'first:end',
      'second:start',
      'second:end',
    ])
  })

  it('continues with the next image task after a failure', async () => {
    const sequence = CreateImageSequence()
    const failed = sequence(async () => {
      throw new Error('image failed')
    })

    await expect(failed).rejects.toThrow('image failed')
    await expect(sequence(async () => 'next')).resolves.toBe('next')
  })
})
