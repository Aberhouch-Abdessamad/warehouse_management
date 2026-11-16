import { useState } from 'react'
import { History, Plus, Trash2 } from 'lucide-react'
import { Card } from '../components/ui'
import { ChatView, useCopilot } from '../components/Copilot'

function relTime(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = new Date(iso)
  if (d.getFullYear() === new Date().getFullYear()) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return d.toLocaleDateString()
}

export default function Assistant() {
  const { conversations, conversationId, loadConversation, newChat, deleteConversation } = useCopilot()
  const [pendingDelete, setPendingDelete] = useState<number | null>(null)

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col lg:flex-row gap-4">
      {/* Saved conversations (persisted server-side) */}
      <Card className="w-full lg:w-72 max-h-52 lg:max-h-none min-h-0 flex flex-col overflow-hidden shrink-0">
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-border shrink-0">
          <p className="text-sm font-semibold text-ink flex items-center gap-2">
            <History size={15} className="text-violet" /> Saved chats
          </p>
          <button onClick={newChat} title="New chat" aria-label="New chat"
            className="p-1.5 rounded-lg text-ink-muted hover:bg-surface-subtle hover:text-violet transition">
            <Plus size={15} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 && (
            <p className="text-xs text-ink-muted px-2 py-3 leading-relaxed">
              No saved chats yet. Start a conversation — it is saved here automatically, even after you log out.
            </p>
          )}
          {conversations.map((c) => {
            const active = c.id === conversationId
            return (
              <div key={c.id}
                className={`group flex items-center rounded-lg border transition ${active ? 'border-violet/40 bg-violet/5' : 'border-transparent hover:bg-surface-subtle/60'}`}>
                <button onClick={() => loadConversation(c.id)} className="flex-1 min-w-0 text-left px-2.5 py-2">
                  <p className={`text-xs font-medium truncate ${active ? 'text-violet' : 'text-ink'}`}>{c.title}</p>
                  <p className="text-[10px] text-ink-muted">{relTime(c.updated_at)}{c.messages_count ? ` · ${c.messages_count} msgs` : ''}</p>
                </button>
                <button
                  onClick={() => { if (pendingDelete === c.id) { setPendingDelete(null); deleteConversation(c.id) } else setPendingDelete(c.id) }}
                  onBlur={() => setPendingDelete((v) => (v === c.id ? null : v))}
                  title={pendingDelete === c.id ? 'Click again to delete' : 'Delete chat'}
                  aria-label="Delete chat"
                  className={`p-1.5 mx-1 rounded-md transition ${pendingDelete === c.id ? 'text-red bg-red/10' : 'text-ink-muted hover:text-red opacity-0 group-hover:opacity-100'}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
        </div>
      </Card>

      <Card className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
        <ChatView />
      </Card>
    </div>
  )
}
