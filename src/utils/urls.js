export function normalizeHttpUrl(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''

  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : ''
  } catch {
    return ''
  }
}

export function hasHttpUrl(value) {
  return Boolean(normalizeHttpUrl(value))
}
