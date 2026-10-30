import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { avatarThumbFilename } from '../../src/server/common/image-name'
import { createStorage } from '../../src/server/storage'
import { createLogger } from '../../src/server/logger'
import { updateStorage } from '../../src/server/storage/update'

const dirs: string[] = []

afterEach(async () => {
  for (const dir of dirs.splice(0)) {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

async function makeV1Storage(options: { collision?: boolean } = {}): Promise<{
  dir: string
  old_source: string
  old_thumb: string
}> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'torzo-update-'))
  dirs.push(dir)
  await fs.mkdir(path.join(dir, 'galleries'), { recursive: true })
  await fs.mkdir(path.join(dir, 'stored-images', 'source'), { recursive: true })
  await fs.mkdir(path.join(dir, 'stored-images', 'thumb'), { recursive: true })
  await fs.mkdir(path.join(dir, 'stored-images', 'temp'), { recursive: true })

  const old_source = 'avatar-123456-abcdef12.png'
  const old_thumb = avatarThumbFilename(old_source)
  const new_source = 'avatar-1-abcdef12.png'
  const new_thumb = avatarThumbFilename(new_source)
  await fs.writeFile(path.join(dir, 'stored-images', 'source', old_source), 'avatar')
  await fs.writeFile(path.join(dir, 'stored-images', 'thumb', old_thumb), 'thumb')
  if (options.collision === true) {
    await fs.writeFile(path.join(dir, 'stored-images', 'source', new_source), 'collision')
  }

  await fs.writeFile(path.join(dir, 'pool.json'), JSON.stringify({
    schema_version: 1,
    next_id: 2,
  }))
  await fs.writeFile(path.join(dir, 'members.json'), JSON.stringify([{
    id: 1,
    qq_num: 123456,
    name: 'A',
    avatar_src: old_source,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }]))

  return { dir, old_source, old_thumb }
}

describe('storage updater', () => {
  it('updates v1 storage and renames QQ-based avatars to member id', async () => {
    const fixture = await makeV1Storage()
    const result = await updateStorage(fixture.dir)

    expect(result.from).toBe(1)
    expect(result.to).toBe(2)
    expect(result.changed).toBe(true)
    expect(result.renamed_avatars).toBe(2)

    const pool = JSON.parse(await fs.readFile(path.join(fixture.dir, 'pool.json'), 'utf8'))
    expect(pool.schema_version).toBe(2)
    const members = JSON.parse(await fs.readFile(path.join(fixture.dir, 'members.json'), 'utf8'))
    expect(members[0].avatar_src).toBe('avatar-1-abcdef12.png')
    await expect(fs.readFile(path.join(fixture.dir, 'stored-images', 'source', 'avatar-1-abcdef12.png'), 'utf8'))
      .resolves.toBe('avatar')
    await expect(fs.readFile(path.join(fixture.dir, 'stored-images', 'thumb', avatarThumbFilename('avatar-1-abcdef12.png')), 'utf8'))
      .resolves.toBe('thumb')

    const second = await updateStorage(fixture.dir)
    expect(second.changed).toBe(false)
    expect(second.to).toBe(2)
  })

  it("handles a target name that is another member's old avatar name", async () => {
    const fixture = await makeV1Storage()
    const a_old = 'avatar-100-aaaa1111.png'
    const b_old = 'avatar-2-aaaa1111.png'
    const a_new = 'avatar-1-aaaa1111.png'
    const b_new = 'avatar-100-aaaa1111.png'
    await fs.writeFile(path.join(fixture.dir, 'stored-images', 'source', a_old), 'A')
    await fs.writeFile(path.join(fixture.dir, 'stored-images', 'thumb', avatarThumbFilename(a_old)), 'A-thumb')
    await fs.writeFile(path.join(fixture.dir, 'stored-images', 'source', b_old), 'B')
    await fs.writeFile(path.join(fixture.dir, 'stored-images', 'thumb', avatarThumbFilename(b_old)), 'B-thumb')
    await fs.writeFile(path.join(fixture.dir, 'members.json'), JSON.stringify([
      {
        id: 1,
        qq_num: 100,
        name: 'A',
        avatar_src: a_old,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 100,
        qq_num: 2,
        name: 'B',
        avatar_src: b_old,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]))
    await fs.writeFile(path.join(fixture.dir, 'pool.json'), JSON.stringify({
      schema_version: 1,
      next_id: 101,
    }))

    await updateStorage(fixture.dir)

    const members = JSON.parse(await fs.readFile(path.join(fixture.dir, 'members.json'), 'utf8'))
    expect(members[0].avatar_src).toBe(a_new)
    expect(members[1].avatar_src).toBe(b_new)
    await expect(fs.readFile(path.join(fixture.dir, 'stored-images', 'source', a_new), 'utf8'))
      .resolves.toBe('A')
    await expect(fs.readFile(path.join(fixture.dir, 'stored-images', 'source', b_new), 'utf8'))
      .resolves.toBe('B')
  })

  it('refuses to load v1 storage until it is updated', async () => {
    const fixture = await makeV1Storage()
    const storage = await createStorage({
      storage_path: fixture.dir,
      allow_empty_data: false,
      logger: createLogger({ level: 'error', pretty: true }),
    })
    try {
      await expect(storage.load()).rejects.toThrowError(/update-storage/)
    } finally {
      await storage.close()
    }
  })

  it('fails without changing the version when a target avatar exists', async () => {
    const fixture = await makeV1Storage({ collision: true })
    await expect(updateStorage(fixture.dir)).rejects.toThrowError(/新头像文件已存在/)

    const pool = JSON.parse(await fs.readFile(path.join(fixture.dir, 'pool.json'), 'utf8'))
    expect(pool.schema_version).toBe(1)
    const members = JSON.parse(await fs.readFile(path.join(fixture.dir, 'members.json'), 'utf8'))
    expect(members[0].avatar_src).toBe(fixture.old_source)
  })
})
