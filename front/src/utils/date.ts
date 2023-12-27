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

export const week_day_map = Object.freeze({
  0: '周日',
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
})

export function stringifyWeekDay(week_day: number) {
  if (week_day < 0) {
    throw Error('stringifyWeekDay failure: week_day less than 0')
  } else if (week_day > 6) {
    throw Error('stringifyWeekDay failure: week_day more than 6')
  } else {
    return week_day_map[week_day]
  }
}

export function isInvalidDate(d: Date) {
  return isNaN(d as any as number)
}

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

export function isNextWeek(current_date: Date, d: Date) {
  return equalYearMonthDay(
    toNextMonday(current_date),
    toMonday(d)
  )
}

function toNextMonthFirstDay(input: Date) {
  const d = new Date(input)
  setMoonthFirstDay(d)
  d.setDate(32)
  setMoonthFirstDay(d)
  return d
}

function setMoonthFirstDay(d: Date) {
  d.setDate(1)
  return d
}
const toCurrentMonthFirstDay = (input: Date) => setMoonthFirstDay(new Date(input))

export function isNextMonth(current_date: Date, d: Date) {
  return equalYearMonthDay(
    toNextMonthFirstDay(current_date),
    toCurrentMonthFirstDay(d)
  )
}
