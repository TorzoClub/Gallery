import { Config } from './config'
import { Pool, createPool, diffGalleriesMap, poolAddMember, poolRemoveMember, poolSetSubmission, poolCancelSubmission, poolUpdateMember, poolVotePhoto } from './core/Pool'
import Storage from './storage'

const __admin_list: Function[] = []

export const __mutation_list = Object.freeze({
  poolAddMember, poolRemoveMember, poolSetSubmission, poolCancelSubmission, poolUpdateMember, poolVotePhoto
})
export type __mutation_name = keyof typeof __mutation_list

export const __queries_list = Object.freeze({})
export type __queries_name = keyof typeof __queries_list

function Mutation(
  getPool: () => Pool,
  setPool: (pool: Pool) => void,
  effectCallback: (prev_pool: Pool) => void
) {
  return function mutate<O extends __mutation_name>(
    mutate_name: O,
    args: Parameters<typeof __mutation_list[O]>
  ) {
    const [, ...reset_args] = args
    const mutationFn = __mutation_list[mutate_name] as Function
    const prev_pool = getPool()
    setPool(mutationFn(prev_pool, ...reset_args))
    effectCallback(prev_pool)
  }
}

function Queries(getPool: () => Pool) {
  return function query<O extends __queries_name>(
    mutate_name: O,
    args: Parameters<typeof __queries_list[O]>
  ) {
    const [, ...reset_args] = args
    const queriesFn = __queries_list[mutate_name] as Function
    return queriesFn(...reset_args)
  }
}

type InstanceOptions = {
  storage_path: string
}

export default async function Instance(opts: InstanceOptions) {
  const storage = await Storage({
    ...opts,
  })

  let __pool = await storage.init()
  const getPool = () => __pool
  const setPool = (new_pool: Pool) => { __pool = new_pool  }

  return {
    query: Queries(getPool),
    mutate: Mutation(getPool, setPool, (prev_pool) => {
      console.log('Pool changed:', prev_pool, '->', __pool)
      storage.storeByDiff(getPool(), prev_pool)
    }),
    async destroy() {
      await storage.free()
    }
  }
}
