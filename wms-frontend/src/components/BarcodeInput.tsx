import { useRef } from 'react'
import { Search } from 'lucide-react'

type Props = {
  placeholder?: string
  onScan: (raw: string) => Promise<void> | void
  autoFocus?: boolean
  disabled?: boolean
}

export default function BarcodeInput({
  placeholder = 'Scan or type barcode…',
  onScan,
  autoFocus = true,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const input = inputRef.current
    if (!input) return
    const raw = input.value.trim()
    if (!raw) return
    input.value = ''
    await onScan(raw)
    input.focus()
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-ink bg-surface focus:ring-2 focus:ring-blue/40 focus:border-blue outline-none placeholder:text-ink-muted/60 uppercase"
        />
      </div>
      <button
        type="submit"
        disabled={disabled}
        className="px-4 py-2 rounded-lg bg-blue text-white text-sm font-medium hover:bg-blue/90 disabled:opacity-50"
      >
        Scan
      </button>
    </form>
  )
}