import { useCallback, useState } from 'react'

export function reverseList<T>(input_list: T[]) {
  return input_list.slice().reverse()
}

export function excludeByProperty<
  P extends string,
  V,
  T extends Record<P, V> & Record<string, unknown>
>(
  property: P,
  value: V,
  list: T[],
) {
  return list.filter(
    item => item[property] !== value
  )
}

const __NO_FOUND__ = Symbol()
export function sortByIdList<ID, T extends Record<'id', ID>>(
  list: T[],
  sorted_id_list: ID[]
): T[] {
  const sorted_list = sorted_id_list.map(sorted_id => {
    const find_idx = findListByProperty(list, 'id', sorted_id)
    if (find_idx === -1) {
      return __NO_FOUND__
    } else {
      return list[find_idx]
    }
  }).filter(item => item !== __NO_FOUND__) as T[]

  const remain = list.filter(item => {
    sorted_id_list.indexOf(item.id) === -1
  })

  return [
    ...sorted_list,
    ...remain,
  ]
}

export function updateListItem<
  P extends string,
  PV,
  Item extends Record<P, PV> & Record<string, unknown>
>(
  list: Item[],
  findFn: (item: Item) => boolean,
  updateFn: (item: Readonly<Item>) => { [k in keyof Item]?: Item[k] }
) {
  return list.map((item) => {
    return findFn(item) ? { ...item, ...updateFn({ ...item }) } : item
  })
}

export function updateListItemByProperty<
  P extends string,
  PV,
  Item extends Record<P, PV> & Record<string, unknown>
>(list: Item[], findProperty: P, propertyValue: PV, updateData: Partial<Item>) {
  return updateListItem(
    list,
    (item) => item[findProperty] === propertyValue,
    () => updateData
  )
}

export function updateListItemById<
  IDV,
  Item extends Record<'id', IDV> & Record<string, unknown>
>(list: Item[], id: IDV, updateData: { [k in keyof Item]?: Item[k] }) {
  return updateListItemByProperty(list, 'id', id, updateData)
}

export function findList<
  P extends string,
  PV,
  Item extends Record<P, PV> & Record<string, unknown>
>(
  list: Item[],
  findFn: (item: Item) => boolean
): number {
  return list.findIndex((item) => {
    return findFn(item)
  })
}

export function findListByProperty<
  P extends string,
  PV,
  Item extends Record<P, PV> & Record<string, unknown>
>(list: Item[], findProperty: P, propertyValue: PV) {
  return findList(
    list,
    (item) => item[findProperty] === propertyValue
  )
}

export function removeListItemByIdx<T>(list: T[], willRemoveIdx: number) {
  return list.filter((item, idx) => {
    return idx !== willRemoveIdx
  })
}

type Optional<O> = { [k in keyof O]?: O[k] }

export function useAssignState<S>(initObj: S) {
  const [state, setState] = useState<S>(initObj)

  const setAssign = useCallback((updateState: Optional<S>) => {
    return setState((oldState) => ({ ...oldState, ...updateState }))
  }, [])

  return [state, setAssign] as const
}
