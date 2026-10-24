export type Config = {
  storage_path: string

  avatar_thumb_size: number
  image_thumb_size: number
}

export function checkConfigObject(json_obj: any): Config {
  try {
    const read = ReadObjectProperty(json_obj)
    return {
      storage_path: read.nonEmptyString('storage_path'),
      avatar_thumb_size: read.number('avatar_thumb_size'),
      image_thumb_size: read.number('image_thumb_size'),
    }
  } catch (err: any) {
    throw new Error(`check config fail: ${err.message}`)
  }
}

function ReadObjectProperty<
  P extends string,
  V,
  O extends Record<P, V>
>(obj: O) {
  function string(prop: P): string {
    const val = obj[prop]
    if (typeof val !== 'string') {
      throw new Error(`'${prop}'并不是一个字符串`)
    } else {
      return val
    }
  }

  function nonEmptyString(prop: P): string {
    const val = string(prop)
    if (val.length === 0) {
      throw new Error(`'${prop}'并不是一个非空字符串`)
    } else {
      return val
    }
  }

  function number(prop: P): number {
    const val = obj[prop]
    if (typeof val !== 'number') {
      throw new Error(`'${prop}'并不是一个数字`)
    } else {
      return val
    }
  }

  return { string, nonEmptyString, number }
}
