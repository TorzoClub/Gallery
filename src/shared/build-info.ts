declare const __BUILD_DATE__: string | undefined
declare const __GIT_HASH__: string | undefined

export const BUILD_DATE = typeof __BUILD_DATE__ === 'string'
  ? __BUILD_DATE__
  : 'N/A'

export const GIT_HASH = typeof __GIT_HASH__ === 'string'
  ? __GIT_HASH__
  : 'N/A'
