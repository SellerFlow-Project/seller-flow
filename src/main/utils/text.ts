export function cleanText(text: unknown = ''): string {
  return String(text).replace(/\s+/g, ' ').trim()
}
