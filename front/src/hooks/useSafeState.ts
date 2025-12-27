import { Dispatch, SetStateAction, useCallback, useState } from 'react'
import useMountState from './useMountState'

export default function useSafeState<S>(init: S | (() => S)) {
  const isMounted = useMountState()
  const [ state, setState ] = useState(init)
  return [
    state,
    useCallback<Dispatch<SetStateAction<S>>>((new_state) => {
      if (isMounted()) {
        setState(new_state)
      }
    }, [isMounted])
  ] as const
}
