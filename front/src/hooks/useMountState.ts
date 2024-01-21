import { useCallback, useEffect, useRef } from 'react'

export default function useMountState() {
  const mount_state = useRef(false)

  useEffect(() => {
    mount_state.current = true
    return () => { mount_state.current = false }
  }, [])

  return useCallback(() => mount_state.current, [])
}
