import padLeft from 'pad-left'

export function dateDiffInDays(a: Date, b: Date) {
  // 将日期字符串转换为日期对象
  const dateA = new Date(a)
  const dateB = new Date(b)

  // 计算两个日期的差值
  const timeDiff = Math.abs(dateB.getTime() - dateA.getTime())

  // 将差值转换为天数
  const daysDifference = Math.ceil(timeDiff / (1000 * 60 * 60 * 24))

  return daysDifference
}

export function monthDiff(date1: Date, date2: Date) {
  const months = (date2.getFullYear() - date1.getFullYear()) * 12 + (date2.getMonth() - date1.getMonth())
  return months
}

const DATE_DAY_MAP = Object.freeze([
  '周日', '周一', '周二', '周三', '周四', '周五', '周六',
])

export function stringifyWeekDay(date_day: number) {
  const str = DATE_DAY_MAP[date_day] as undefined | string
  if (str === undefined) {
    throw RangeError('date_day can only accept integer numbers from 0 to 6')
  } else {
    return str
  }
}

export const isInvalidDate = (d: Date) => isNaN(Number(d))

function weekday(d: Date): number {
  const day = d.getDay()
  return (day === 0) ? 7 : day
}

const toYearMonthDayString = (d: Date): string => [
  `${d.getFullYear()}`,
  padLeft(`${d.getMonth() + 1}`, 2, '0'),
  padLeft(`${d.getDate()}`, 2, '0')
].join('/')

const equalYearMonthDay = (d1: Date, d2: Date) =>
  toYearMonthDayString(d1) === toYearMonthDayString(d2)

function setMonday(d: Date) {
  d.setDate(d.getDate()-(weekday(d) - 1))
  return d
}
function toMonday(input: Date) {
  return setMonday(new Date(input))
}
function toNextMonday(input: Date) {
  const d = new Date(input)
  d.setDate(d.getDate() + 7)
  return setMonday(d)
}

export function isNextWeek(current: Date, d: Date) {
  return equalYearMonthDay(
    toNextMonday(current),
    toMonday(d)
  )
}

function toNextMonthFirstDay(input: Date) {
  const d = new Date(input)
  setMonthFirstDay(d)
  d.setDate(32)
  setMonthFirstDay(d)
  return d
}

function setMonthFirstDay(d: Date) {
  d.setDate(1)
  return d
}
const toCurrentMonthFirstDay = (input: Date) => setMonthFirstDay(new Date(input))

export function isNextMonth(current_date: Date, d: Date) {
  return equalYearMonthDay(
    toNextMonthFirstDay(current_date),
    toCurrentMonthFirstDay(d)
  )
}
