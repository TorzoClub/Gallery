import { useCallback, useEffect, useState } from 'react'
import type { ClientMemberView } from '@shared/client-pool'
import { fetchMemberView } from '../api/client-pool'

export type MemberViewState = {
  view: ClientMemberView | null
  loading: boolean
  error: Error | null
}

export function useMemberView(qq_num: number | null): MemberViewState & {
  reload(): Promise<void>
} {
  const [state, setState] = useState<MemberViewState>({
    view: null,
    loading: false,
    error: null,
  })

  const reload = useCallback(async () => {
    if (qq_num === null) {
      setState({ view: null, loading: false, error: null })
      return
    }

    setState(current => ({ ...current, loading: true, error: null }))
    try {
      const view = await fetchMemberView(qq_num)
      setState({ view, loading: false, error: null })
    } catch (error) {
      setState({
        view: null,
        loading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      })
    }
  }, [qq_num])

  useEffect(() => {
    void reload()
  }, [reload])

  return { ...state, reload }
}
