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
          className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-ink bg-surface focus:ring-2 focus:ring-brand/40 focus:border-brand outline-none placeholder:text-ink-muted/60 uppercase"
        />
      </div>
      <button
        type="submit"
        disabled={disabled}
        className="px-4 py-2 rounded-xl bg-gradient-to-b from-[#8E7CF0] to-[#6A55CF] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_3px_0_#4B39A8,0_8px_16px_-8px_rgba(106,85,207,.6)] hover:brightness-105 active:translate-y-[3px] active:shadow-none text-sm font-semibold transition-all duration-100 disabled:opacity-50"
      >
        Scan
      </button>
    </form>
  )
}