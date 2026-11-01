import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { avatarThumbFilename } from '../../common/image-name'
import { fileExists } from '../fs'
import { readJsonFile, writeJsonAtomic } from '../fs'
import {
  MembersFileSchema,
  parsePoolFile,
  type MemberJson,
} from '../codec'
import type { StoragePaths } from '../index'

type Move = {
  from: string
  to: string
}

function avatarMoves(member: MemberJson): { next: string; moves: Move[] } | null {
  const prefix = `avatar-${member.qq_num}-`
  if (!member.avatar_src.startsWith(prefix)) {
    return null
  }

  const next = `avatar-${member.id}-${member.avatar_src.slice(prefix.length)}`
  if (next === member.avatar_src) {
    return null
  }

  return {
    next,
    moves: [
      {
        from: path.join('source', member.avatar_src),
        to: path.join('source', next),
      },
      {
        from: path.join('thumb', avatarThumbFilename(member.avatar_src)),
        to: path.join('thumb', avatarThumbFilename(next)),
      },
    ],
  }
}

function absolute(paths: StoragePaths, relative: string): string {
  const [kind, filename] = relative.split(path.sep)
  if ((kind !== 'source' && kind !== 'thumb') || filename === undefined) {
    throw new Error(`非法的头像路径: ${relative}`)
  }
  return path.join(kind === 'source' ? paths.source : paths.thumb, filename)
}

async function restoreFiles(
  staged: Array<{ move: { from: string; to: string }; temp: string }>,
  applied: number,
): Promise<void> {
  for (const item of staged.slice(0, applied).reverse()) {
    try {
      await fs.rename(item.move.to, item.temp)
    } catch {
      // Best effort; the storage backup is the final recovery path.
    }
  }
  for (const item of staged.reverse()) {
    try {
      await fs.rename(item.temp, item.move.from)
    } catch {
      // Best effort; the storage backup is the final recovery path.
    }
  }
}

export async function updateV1ToV2(paths: StoragePaths): Promise<{ renamed_avatars: number }> {
  const pool_raw = parsePoolFile(await readJsonFile(paths.pool_file))
  if (pool_raw.schema_version !== 1) {
    throw new Error(`v1-to-v2 updater 收到 schema_version=${pool_raw.schema_version}`)
  }

  const members_raw = await readJsonFile(paths.members_file)
  const members = MembersFileSchema.parse(members_raw)
  const pool_snapshot = await fs.readFile(paths.pool_file)
  const members_snapshot = await fs.readFile(paths.members_file)

  const moves: Move[] = []
  const move_keys = new Set<string>()

  for (const member of members) {
    const avatar = avatarMoves(member)
    if (avatar === null) {
      continue
    }
    for (const move of avatar.moves) {
      const key = `${move.from}\u0000${move.to}`
      if (move_keys.has(key)) {
        continue
      }
      move_keys.add(key)
      moves.push({
        from: absolute(paths, move.from),
        to: absolute(paths, move.to),
      })
    }
    member.avatar_src = avatar.next
  }

  const sources = new Set(moves.map(move => move.from))
  const targets = new Set<string>()
  for (const move of moves) {
    if (!(await fileExists(move.from))) {
      throw new Error(`旧头像文件不存在: ${path.basename(move.from)}`)
    }
    if (targets.has(move.to)) {
      throw new Error(`多个头像指向同一目标: ${path.basename(move.to)}`)
    }
    if (await fileExists(move.to)) {
      // A target may be another v1 avatar that is itself being moved away.
      if (!sources.has(move.to)) {
        throw new Error(`新头像文件已存在: ${path.basename(move.to)}`)
      }
    }
    targets.add(move.to)
  }

  const staged: Array<{ move: Move; temp: string }> = []
  let applied = 0

  try {
    for (const move of moves) {
      const temp = path.join(path.dirname(move.from), `.update-${randomUUID()}.tmp`)
      await fs.rename(move.from, temp)
      staged.push({ move, temp })
    }

    for (const item of staged) {
      await fs.rename(item.temp, item.move.to)
      applied += 1
    }

    await writeJsonAtomic(paths.members_file, members)
    await writeJsonAtomic(paths.pool_file, {
      ...pool_raw,
      schema_version: 2,
    })

    return { renamed_avatars: moves.length }
  } catch (error) {
    await restoreFiles(staged, applied)
    await fs.writeFile(paths.members_file, members_snapshot)
    await fs.writeFile(paths.pool_file, pool_snapshot)
    throw error
  }
}
