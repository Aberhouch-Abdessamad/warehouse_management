/** Extract a readable message from an axios/unknown error. */
export function errMsg(e: unknown, fallback = 'Something went wrong'): string {
  const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } }; message?: string }
  const data = err?.response?.data
  if (data?.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors).flat()[0]
    if (first && data.message === 'Validation failed.') return String(first)
  }
  return data?.message || err?.message || fallback
}

export const fmtNum = (n: number | string | null | undefined, digits = 0) =>
  Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 })

export const fmtMoney = (n: number | string | null | undefined) =>
  Number(n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export const fmtCompact = (n: number) =>
  Math.abs(n) >= 10000 ? Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n) : fmtNum(n)
