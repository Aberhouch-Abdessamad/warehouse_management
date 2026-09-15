import { useState } from 'react'
import { Button } from './ui'
import { AlertTriangle, Info } from 'lucide-react'

type Props = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  onConfirm: () => Promise<void> | void
  onCancel: () => void
}

export default function ConfirmationDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
}: Props) {
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      await onConfirm()
      onCancel()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
      <div className="bg-surface rounded-xl shadow-popover w-full max-w-md overflow-hidden">
        <div className={`flex items-start gap-3 px-6 pt-6 pb-4 ${variant === 'danger' ? 'bg-red-soft/50' : ''}`}>
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              variant === 'danger' ? 'bg-red-soft text-red' : 'bg-blue-soft text-blue'
            }`}
          >
            {variant === 'danger' ? <AlertTriangle size={20} /> : <Info size={20} />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-ink leading-tight">{title}</h3>
            <p className="text-sm text-ink-muted mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 bg-surface-subtle/50 border-t border-border">
          <Button variant="secondary" size="md" onClick={onCancel} disabled={submitting}>
            {cancelLabel}
          </Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} size="md" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Processing…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}