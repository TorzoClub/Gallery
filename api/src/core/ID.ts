// Distinct ID

type ID<T, DistinctName> = T & { __TYPE__: DistinctName }

export function Id<T, DistinctName>() {
  return (id: T) => id as ID<T, DistinctName>
}

export function maxId<
  ID extends number,
  Item extends Record<'id', ID>,
  Items extends Item[]
>(items: Items) {
  let max_id = 0
  for (let i = 0; i < items.length; ++i) {
    if (items[i].id > max_id) {
      max_id = items[i].id
    }
  }
  return max_id
}

export default ID
