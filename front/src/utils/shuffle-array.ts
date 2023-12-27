export default shuffleArray

export function shuffleArray<T>(arr: T[]): T[] {
  return (arr.length < 2) ? arr: shuffleArrayUnpure([...arr])
}

export function shuffleArrayUnpure<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    exchangePos(arr, i, randomNum(i))
  }
  return arr
}

const randomNum = (range: number) => Math.floor(Math.random() * (range + 1))

const exchangePos = <T>(arr: T[], idxA: number, idxB: number) => {
  [arr[idxA], arr[idxB]] = [arr[idxB], arr[idxA]]
}
