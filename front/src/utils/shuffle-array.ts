import { pipe } from 'ramda'

const randomNum = (range: number) => Math.floor(Math.random() * (range + 1))
const exchangePos = <T>(arr: T[], idxA: number, idxB: number) => {
  [arr[idxA], arr[idxB]] = [arr[idxB], arr[idxA]]
}

const shuffle = <T>(arr: T[]) => {
  if (arr.length > 1) {
    for (let i = arr.length - 1; i > 0; --i) {
      exchangePos(arr, i, randomNum(i))
    }
  }
  return arr
}

const getType = (v: unknown) => v === null ? 'null' : typeof v
const throwTypeError = <T>(arr: T[]) => {
  throw new TypeError(`Expected an array, but got ${getType(arr)}`)
}

export const shuffleArrayMutable = <T>(arr: T[]) =>
  (Array.isArray(arr) ? shuffle : throwTypeError)(arr)

const copyArray = <T>(arr: T[]) => [...arr]
const shuffleArrayImmutable = pipe( copyArray, shuffleArrayMutable )
export default shuffleArrayImmutable

// test code:
// console.clear()
// let count = {};
// const test_array = 'abcd'.split('');
// for (let i = 0; i < 1000000; i++) {
//   const result = shuffleArrayImmutable(test_array);
//   if (count[result.join('')] === undefined) {
//       count[result.join('')] = 0
//   }
//   count[result.join('')] += 1;
// }
// const totals = []
// for (let key in count) {
//   totals.push(count[key])
// }
// const total = totals.reduce((a, b) => a + b, 0)
// const average = total / totals.length
// for (let key in count) {
//   const per = (average - count[key]) / total
//   console.log(`${key}: ${count[key]}`, `${(per * 100).toFixed(2)}%`);
// }
