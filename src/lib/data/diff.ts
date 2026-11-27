/** Rows added or changed between two immutable lists (compared by reference, keyed by id). */
export function diffById<T extends { id: string }>(prev: readonly T[], next: readonly T[]) {
  const before = new Map(prev.map((x) => [x.id, x]))
  const added: T[] = []
  const changed: Array<{ prev: T; next: T }> = []
  for (const item of next) {
    const old = before.get(item.id)
    if (!old) added.push(item)
    else if (old !== item) changed.push({ prev: old, next: item })
  }
  return { added, changed }
}

/** Shallow field comparison; true when any listed key differs. */
export function fieldsChanged<T>(a: T, b: T, keys: readonly (keyof T)[]): boolean {
  return keys.some((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
}
