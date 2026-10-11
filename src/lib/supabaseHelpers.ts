export function throwIfError(error: { message: string } | null): void {
  if (error) throw error
}

export function unwrap<T>(data: T | null, error: { message: string } | null): T {
  throwIfError(error)
  if (data === null) throw new Error('데이터가 없습니다')
  return data
}
