import ID from './ID'
export type QQNumber = ID<number, 'QQNumber'>

export type Member = {
  qq_num: QQNumber
  name: string
  avatar_src: string
}
