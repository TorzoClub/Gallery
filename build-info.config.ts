import { execFileSync } from 'node:child_process'

export type BuildInfo = {
  build_date: string
  git_hash: string
}

export function getBuildInfo(): BuildInfo {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const build_date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

  let git_hash = 'N/A'
  try {
    const value = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (value.length > 0) {
      git_hash = value
    }
  } catch {
    // No git metadata (for example a source archive).
  }

  return { build_date, git_hash }
}
