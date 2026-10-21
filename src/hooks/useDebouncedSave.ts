import { useCallback, useEffect, useRef } from 'react'

export function useDebouncedSave<T>(
  onSave: (value: T) => void,
  delayMs = 1000,
): (next: T) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSaveRef = useRef(onSave)
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return useCallback(
    (next: T) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => onSaveRef.current(next), delayMs)
    },
    [delayMs],
  )
}
