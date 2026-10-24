import { QueuePool } from 'vait'

export type StorageObject<ID> = Record<'id', ID> & Record<string, unknown>

export interface Driver<ID, Obj extends StorageObject<ID>> {
  create(v: Obj): Promise<void>
  delete(id: ID): Promise<void>
  update(obj: Obj): Promise<void>

  readRaw(id: ID): Promise<string>
}

export type StorageQueueType<ID, Obj extends StorageObject<ID>> =
  (keyof StorageQueueAction<ID, Obj>) | 'other'

interface StorageQueueAction<ID, Obj extends StorageObject<ID>> {
  create(v: Obj): void
  delete(id: ID): void
  update(obj: Obj): void
}

export type StorageQueue<ID, Obj extends StorageObject<ID>> =
  StorageQueueAction<ID, Obj> & {
    queuePool: QueuePool<ID, StorageQueueType<ID, Obj>>
    driver: Driver<ID, Obj>
  }

export function MapStorageQueue<ID, Obj extends StorageObject<ID>>(
  driver: Driver<ID, Obj>
): StorageQueue<ID, Obj> {
  const queuePool = QueuePool<ID, StorageQueueType<ID, Obj>>()

  return {
    queuePool,

    driver,

    create(obj) {
      queuePool.addTask(obj.id, 'create', async () => {
        await driver.create(obj)
      })
    },

    delete(id) {
      queuePool.addTask(id, 'delete', async () => {
        await driver.delete(id)
      })
    },

    update(new_obj) {
      queuePool.addTask(new_obj.id, 'update', async () => {
        await driver.update(new_obj)
      })
    },
  }
}
