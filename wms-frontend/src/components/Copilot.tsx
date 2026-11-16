import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Sparkles, Send, ImagePlus, X, Plus, Bot, Loader2, Maximize2, AlertTriangle } from 'lucide-react'
import { get, post, del } from '../services/apiClient'
import { errMsg } from '../lib/errors'
import Markdown from './Markdown'
import ActionCard, { parseAiContent } from './ActionCard'

export interface ChatMessage {
  id?: number
  role: 'user' | 'assistant'
  content: string
  image?: string
  error?: boolean
  action_state?: 'done' | 'dismissed' | null
  action_result?: string | null
}

interface AiStatus {
  configured: boolean
}

export interface ConversationSummary {
  id: number
  title: string
  updated_at: string
  messages_count?: number
}

interface CopilotCtx {
  open: boolean
  setOpen: (v: boolean) => void
  messages: ChatMessage[]
  sending: boolean
  status: AiStatus | null
  send: (text: string, image?: string | null) => Promise<void>
  newChat: () => void
  conversationId: number | null
  conversations: ConversationSummary[]
  refreshConversations: () => Promise<void>
  loadConversation: (id: number) => Promise<void>
  deleteConversation: (id: number) => Promise<void>
  applyActionState: (messageId: number, state: 'done' | 'dismissed', result?: string) => void
}

const Ctx = createContext<CopilotCtx | null>(null)

const PAGE_NAMES: Record<string, string> = {
  '/dashboard': 'Dashboard', '/inventory': 'Stock Overview', '/products': 'Products', '/transfers': 'Transfers',
  '/putaway': 'Putaway', '/returns': 'Returns', '/stock-counts': 'Stock Counts', '/warehouses': 'Warehouses',
  '/locations': 'Locations', '/suppliers': 'Suppliers', '/purchasing': 'Purchase Orders', '/receiving': 'Receiving',
  '/customers': 'Customers', '/sales': 'Sales Orders', '/picking': 'Picking', '/packing': 'Packing',
  '/shipping': 'Shipping', '/reports': 'Reports', '/assistant': 'AI Copilot',
}

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const location = useLocation()
  // Mirror of conversationId so send() always posts the current id even when
  // two messages are sent quickly after one another.
  const conversationIdRef = useRef<number | null>(null)

  const setConversation = useCallback((id: number | null) => {
    conversationIdRef.current = id
    setConversationId(id)
  }, [])

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await get<ConversationSummary[]>('/ai/conversations'))
    } catch { /* not signed in or endpoint unavailable */ }
  }, [])

  const loadConversation = useCallback(async (id: number) => {
    try {
      const conv = await get<{ id: number; title: string; messages: ChatMessage[] }>('/ai/conversations/' + id)
      setConversation(conv.id)
      setMessages(conv.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        image: m.image || undefined,
        action_state: m.action_state ?? null,
        action_result: m.action_result ?? null,
      })))
    } catch { /* conversation vanished */ }
  }, [setConversation])

  const newChat = useCallback(() => {
    setConversation(null)
    setMessages([])
  }, [setConversation])

  const deleteConversation = useCallback(async (id: number) => {
    try {
      await del<null>('/ai/conversations/' + id)
      setConversations((cs) => cs.filter((c) => c.id !== id))
      if (conversationIdRef.current === id) newChat()
    } catch { /* keep the list as is */ }
  }, [newChat])

  // Records the outcome of an AI action card in memory + on the server so an
  // executed card stays inert after a refresh.
  const applyActionState = useCallback((messageId: number, state: 'done' | 'dismissed', result?: string) => {
    setMessages((ms) => ms.map((m) => (m.id === messageId ? { ...m, action_state: state, action_result: result ?? null } : m)))
    post(`/ai/messages/${messageId}/result`, { state, result }).catch(() => { /* best effort */ })
  }, [])

  useEffect(() => {
    get<AiStatus>('/ai/status').then(setStatus).catch(() => setStatus({ configured: false }))
    // Restore the latest saved conversation so history survives refresh/login.
    ;(async () => {
      try {
        const list = await get<ConversationSummary[]>('/ai/conversations')
        setConversations(list)
        if (list[0]) await loadConversation(list[0].id)
      } catch { /* ignore */ }
    })()
  }, [refreshConversations, loadConversation])

  const send = useCallback(async (text: string, image?: string | null) => {
    const trimmed = text.trim()
    if (!trimmed && !image) return
    const content = trimmed || 'What do you see in this image?'
    setMessages((m) => [...m, { role: 'user', content, image: image || undefined }])
    setSending(true)
    try {
      const res = await post<{ reply: string; conversation_id: number; message_id: number }>('/ai/chat', {
        content,
        image: image || undefined,
        page: PAGE_NAMES[location.pathname] ?? undefined,
        conversation_id: conversationIdRef.current,
      })
      setConversation(res.conversation_id)
      setMessages((m) => [...m, { id: res.message_id, role: 'assistant', content: res.reply }])
      refreshConversations()
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: errMsg(e, 'The AI assistant is unavailable.'), error: true }])
    } finally {
      setSending(false)
    }
  }, [location.pathname, setConversation, refreshConversations])

  return (
    <Ctx.Provider value={{ open, setOpen, messages, sending, status, send, newChat, conversationId, conversations, refreshConversations, loadConversation, deleteConversation, applyActionState }}>
      {children}
    </Ctx.Provider>
  )
}

export function useCopilot() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCopilot must be used within CopilotProvider')
  return c
}

/** Downscale an image file to a JPEG data URL (max 1280px) to keep requests small. */
async function fileToDataUrl(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = reject
    r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = raw
  })
  const scale = Math.min(1, 1280 / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}

const SUGGESTIONS = [
  'Which products should I reorder this week, and how many?',
  'Summarise today’s fulfilment backlog by stage.',
  'Which SKUs are slow-moving and tying up cash?',
  'Where is SKU-1001 stored and how much is available?',
]

/** Assistant bubble body: markdown text plus confirmation cards for AI-proposed records. */
function AssistantMessage({ message }: { message: ChatMessage }) {
  const { applyActionState } = useCopilot()
  const parts = parseAiContent(message.content)
  return (
    <>
      {parts.map((p, i) =>
        p.type === 'action' ? (
          <ActionCard
            key={i}
            action={p.action}
            state={message.action_state ?? null}
            result={message.action_result ?? null}
            onResolved={(state, result) => { if (message.id) applyActionState(message.id, state, result) }}
          />
        ) : (
          <Markdown key={i} text={p.text} />
        ),
      )}
    </>
  )
}

export function ChatView({ compact = false, onExpand, onClose }: { compact?: boolean; onExpand?: () => void; onClose?: () => void }) {
  const { messages, sending, status, send, newChat } = useCopilot()
  const [text, setText] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [imgErr, setImgErr] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  const attach = async (file?: File | null) => {
    setImgErr(null)
    if (!file) return
    if (!file.type.startsWith('image/')) return setImgErr('Only images can be attached.')
    if (file.size > 15 * 1024 * 1024) return setImgErr('Image is too large (max 15 MB).')
    try {
      setImage(await fileToDataUrl(file))
    } catch {
      setImgErr('Could not read that image.')
    }
  }

  const submit = async () => {
    if (sending) return
    const t = text
    const im = image
    setText('')
    setImage(null)
    await send(t, im)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet to-blue text-white flex items-center justify-center">
          <Sparkles size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink leading-tight">WMS Copilot</p>
          <p className="text-[11px] text-ink-muted leading-tight flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${status?.configured ? 'bg-mint' : 'bg-amber'}`} />
            {status?.configured ? 'AI · live warehouse data' : 'AI not configured on the server'}
          </p>
        </div>
        {messages.length > 0 && (
          <button onClick={newChat} className="p-1.5 rounded-lg text-ink-muted hover:bg-surface-subtle hover:text-ink" title="New chat" aria-label="New chat">
            <Plus size={15} />
          </button>
        )}
        {onExpand && (
          <button onClick={onExpand} className="p-1.5 rounded-lg text-ink-muted hover:bg-surface-subtle hover:text-ink" title="Open full screen" aria-label="Open full screen">
            <Maximize2 size={15} />
          </button>
        )}
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg text-ink-muted hover:bg-surface-subtle hover:text-ink" title="Close" aria-label="Close Copilot">
            <X size={16} />
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 bg-canvas/60">
        {messages.length === 0 && (
          <div className={compact ? 'pt-2' : 'max-w-xl mx-auto pt-10'}>
            <div className="flex items-center gap-2 text-ink mb-1">
              <Bot size={18} className="text-violet" />
              <p className="font-semibold text-sm">Ask anything about your warehouse</p>
            </div>
            <p className="text-xs text-ink-muted mb-4">
              Copilot reads live stock, orders, bins and movements. Attach a photo of a shelf, label, delivery note or damaged goods for visual analysis.
            </p>
            <div className={`grid gap-2 ${compact ? '' : 'sm:grid-cols-2'}`}>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} disabled={sending}
                  className="text-left text-xs text-ink bg-surface border border-border rounded-lg px-3 py-2.5 hover:border-violet/40 hover:bg-violet/5 transition">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] ${
              m.role === 'user'
                ? 'bg-blue text-white rounded-br-md'
                : m.error
                  ? 'bg-red-soft text-red border border-red/20 rounded-bl-md'
                  : 'bg-surface text-ink border border-border rounded-bl-md shadow-panel'
            }`}>
              {m.image && <img src={m.image} alt="Attached" className="rounded-lg mb-2 max-h-48 object-cover" />}
              {m.role === 'assistant' && !m.error ? <AssistantMessage message={m} /> : (
                <p className="whitespace-pre-wrap flex gap-1.5">{m.error && <AlertTriangle size={14} className="mt-0.5 shrink-0" />}{m.content}</p>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <Loader2 size={14} className="animate-spin text-violet" /> Analysing warehouse data…
          </div>
        )}
      </div>

      <div className="border-t border-border p-3 bg-surface shrink-0">
        {image && (
          <div className="relative inline-block mb-2">
            <img src={image} alt="To send" className="h-16 rounded-lg border border-border" />
            <button onClick={() => setImage(null)} className="absolute -top-2 -right-2 bg-ink text-white rounded-full p-0.5" aria-label="Remove image">
              <X size={12} />
            </button>
          </div>
        )}
        {imgErr && <p className="text-xs text-red mb-1">{imgErr}</p>}
        <div className="flex items-end gap-2">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { attach(e.target.files?.[0]); e.target.value = '' }} />
          <button onClick={() => fileRef.current?.click()} className="p-2.5 rounded-lg border border-border text-ink-muted hover:text-violet hover:border-violet/40 transition" title="Attach photo" aria-label="Attach photo">
            <ImagePlus size={16} />
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const f = Array.from(e.clipboardData.files).find((x) => x.type.startsWith('image/'))
              if (f) { e.preventDefault(); attach(f) }
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
            rows={1}
            placeholder="Ask Copilot… (Shift+Enter for new line)"
            className="flex-1 resize-none max-h-32 border border-border rounded-lg px-3 py-2.5 text-sm text-ink bg-surface focus:ring-2 focus:ring-violet/30 focus:border-violet outline-none"
          />
          <button onClick={submit} disabled={sending || (!text.trim() && !image)}
            className="p-2.5 rounded-lg bg-gradient-to-br from-violet to-blue text-white disabled:opacity-40 transition" aria-label="Send">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

/** Slide-over panel available on every page. */
export function CopilotPanel({ onExpand }: { onExpand: () => void }) {
  const { open, setOpen } = useCopilot()
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 bg-ink/20 z-40 lg:hidden" onClick={() => setOpen(false)} />
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[420px] bg-surface border-l border-border shadow-popover flex flex-col animate-slide-right">
        <ChatView compact onClose={() => setOpen(false)} onExpand={() => { setOpen(false); onExpand() }} />
      </aside>
    </>
  )
}
