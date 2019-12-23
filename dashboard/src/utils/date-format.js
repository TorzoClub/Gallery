import pad from 'pad-left'

export const toDateArray = (d, noFill) => {
  const arr = [
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate()
  ]

  if (noFill) {
    return arr
  }

  return arr.map(num =>
    pad(num, 2, '0')
  )
}

export const toTimeStringWithMinute = d => {
  const hour = pad(d.getHours(), 2, '0')
  const min = pad(d.getMinutes(), 2, '0')
  return `${hour}:${min}`
}

export const toDateTimeWithMinuteString = d => {
  return `${toDateArray(d).join('/')} ${toTimeStringWithMinute(d)}`
}
