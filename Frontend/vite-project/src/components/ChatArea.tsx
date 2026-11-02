import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import api from '../../utils/axios'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ArtifactData, ArtifactDocument } from './Artifact'
import { Button } from './ui/Button'
import { ArrowUpIcon, CheckIcon, ChevronDownIcon, StopIcon } from './ui/icons'
import streamChat from '../features/streamChat'

type Message = {
  _id?: string
  role: 'user' | 'assistant'
  content: string
}

type Props = {
  conversationId: string | null
  // Title of the open chat, shown in the header
  title?: string
  // Shown in the greeting of an empty chat
  userName?: string
  // Creates a conversation when the user sends their first message, returns its id
  ensureConversation: (firstPrompt: string) => Promise<string>
  onOpenArtifact: (artifact: ArtifactData) => void
}

type Part = { type: 'text' | 'code'; content: string; language: string; fileName?: string }

// Splits a reply into plain text and ```fenced``` code blocks.
// The coding agent labels blocks as ```language:fileName (e.g. ```html:index.html)
const splitCodeBlocks = (text: string) => {
  const parts: Part[] = []
  const fence = /```([^\n`]*)\n?([\s\S]*?)```/g
  let last = 0
  let match
  while ((match = fence.exec(text)) !== null) {
    if (match.index > last) parts.push({ type: 'text', content: text.slice(last, match.index), language: '' })
    const [language, fileName] = match[1].trim().split(':')
    parts.push({ type: 'code', content: match[2].trimEnd(), language: language ?? '', fileName: fileName?.trim() || undefined })
    last = fence.lastIndex
  }
  if (last < text.length) parts.push({ type: 'text', content: text.slice(last), language: '' })
  return parts
}

// Turns every code block in a reply into an artifact (one tab per file).
// `partIndex` is the clicked block's index in splitCodeBlocks(), so that file
// is selected; returns null when the reply has no code
const toArtifact = (text: string, partIndex?: number): ArtifactData | null => {
  const parts = splitCodeBlocks(text)
  const files = parts
    .filter((p) => p.type === 'code')
    .map((p) => ({ language: p.language, code: p.content, fileName: p.fileName }))
  if (files.length === 0) return null
  const active = partIndex === undefined ? 0 : parts.slice(0, partIndex).filter((p) => p.type === 'code').length
  return { files, active }
}

const FILE_PATH = '/api/agent/files/'

// Reads a link to a generated PDF or PowerPoint; null for any other link. The
// PPT agent puts the path of a deck's PDF copy in the link's title.
const toDocument = (href?: string, title?: string): ArtifactDocument | null => {
  if (!href?.startsWith(FILE_PATH) || !/\.(pdf|pptx)$/i.test(href)) return null
  const preview = title?.startsWith(`preview:${FILE_PATH}`) ? title.slice('preview:'.length) : undefined
  return {
    // "1730000000000-notes.pdf" -> "notes.pdf"
    fileName: href.split('/').pop()!.replace(/^\d+-/, ''),
    path: href,
    previewPath: /\.pdf$/i.test(href) ? href : preview,
  }
}

// Finds the file link in a reply from the pdf or ppt agent
const documentInReply = (text: string): ArtifactData | null => {
  const link = text.match(/\]\((\/api\/agent\/files\/[^\s)]+)(?: "([^"]+)")?\)/)
  const document = link && toDocument(link[1], link[2])
  return document ? { document } : null
}

// Lets links inside Markdown replies open the artifact panel
const OpenArtifactContext = createContext<Props['onOpenArtifact'] | null>(null)

// Generated PDFs and decks open in the artifact panel (Ctrl/Cmd+click still
// opens a new tab); every other link opens in a new tab
function MarkdownLink({ href, title, children }: React.ComponentProps<'a'>) {
  const onOpenArtifact = useContext(OpenArtifactContext)
  const document = toDocument(href, title)
  return (
    <a
      href={href?.startsWith('/api/') ? import.meta.env.VITE_SERVER_URL + href : href}
      target='_blank'
      rel='noreferrer'
      onClick={(e) => {
        if (!document || !onOpenArtifact || e.ctrlKey || e.metaKey) return
        e.preventDefault()
        onOpenArtifact({ document })
      }}
      className='text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent'
    >
      {children}
    </a>
  )
}

// Agents the user can pick. `id` must match the node names in the agent
// service's graph.js; "auto" lets the router decide. `ready: false` marks
// agents that aren't built yet (they reply with a "not available" message).
const AGENTS = [
  { id: 'auto', label: 'Auto', hint: 'Picks the agent for each message', ready: true },
  { id: 'chat', label: 'Chat', hint: 'Questions and conversation', ready: true },
  { id: 'search', label: 'Search', hint: 'Looks things up on the web', ready: true },
  { id: 'coding', label: 'Coding', hint: 'Writes code with a live preview', ready: true },
  { id: 'pdf', label: 'PDF', hint: 'Creates a PDF document', ready: true },
  { id: 'ppt', label: 'Slides', hint: 'Builds a PowerPoint deck', ready: true },
  { id: 'imageGen', label: 'Image', hint: 'Generates an image', ready: true },
]

// Dropdown above the input box for choosing an agent
function AgentPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = AGENTS.find((a) => a.id === value)

  // Clicking elsewhere or pressing Esc closes the menu
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className='relative'>
      <button
        type='button'
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title='Choose an agent'
        className='h-8 pl-2.5 pr-2 flex items-center gap-1.5 rounded-md text-[13px] text-ink-soft hover:bg-raised hover:text-ink transition-colors cursor-pointer'
      >
        {current?.label}
        <ChevronDownIcon size={14} className='text-muted' />
      </button>

      {open && (
        <div className='absolute bottom-full left-0 mb-2 z-30 w-64 p-1 rounded-lg border border-line bg-panel shadow-lg shadow-black/40'>
          {AGENTS.map((a) => (
            <button
              key={a.id}
              type='button'
              onClick={() => {
                onChange(a.id)
                setOpen(false)
              }}
              aria-current={a.id === value}
              title={a.ready ? undefined : 'This agent is not built yet'}
              className='w-full px-2.5 py-1.5 flex items-center justify-between gap-3 rounded-md text-left hover:bg-raised transition-colors cursor-pointer'
            >
              <span className='min-w-0'>
                <span className='block text-[13px] text-ink'>
                  {a.label}
                  {!a.ready && <span className='ml-1.5 text-[11px] text-muted'>Soon</span>}
                </span>
                <span className='block text-[12px] text-muted truncate'>{a.hint}</span>
              </span>
              {a.id === value && <CheckIcon size={14} className='shrink-0 text-accent' />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Copies a code block from the chat
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <Button variant='link' className='text-[11px]' onClick={copy}>
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

const timeOfDay = () => {
  const hour = new Date().getHours()
  if (hour < 5 || hour >= 18) return 'Good evening'
  return hour < 12 ? 'Good morning' : 'Good afternoon'
}

// Tailwind styles for each Markdown element in AI replies
// (code blocks are handled separately so they keep the "Open" button)
const markdownComponents: Components = {
  h1: ({ children }) => <h1 className='text-[22px] font-semibold tracking-tight text-ink mt-6 mb-2'>{children}</h1>,
  h2: ({ children }) => <h2 className='text-[18px] font-semibold tracking-tight text-ink mt-5 mb-2'>{children}</h2>,
  h3: ({ children }) => <h3 className='text-[15px] font-semibold text-ink mt-4 mb-1.5'>{children}</h3>,
  p: ({ children }) => <p className='my-2.5'>{children}</p>,
  strong: ({ children }) => <strong className='font-semibold text-ink'>{children}</strong>,
  ul: ({ children }) => <ul className='list-disc pl-5 my-2.5 flex flex-col gap-1 marker:text-muted'>{children}</ul>,
  ol: ({ children }) => <ol className='list-decimal pl-5 my-2.5 flex flex-col gap-1 marker:text-muted'>{children}</ol>,
  a: ({ href, title, children }) => (
    <MarkdownLink href={href} title={title}>
      {children}
    </MarkdownLink>
  ),
  blockquote: ({ children }) => <blockquote className='border-l-2 border-line-strong pl-3 my-2.5 text-muted'>{children}</blockquote>,
  hr: () => <hr className='my-4 border-line' />,
  // Generated images (imageGen agent); click opens the full size in a new tab.
  // Images in S3 are saved as "/api/agent/files/..." paths on the gateway.
  img: ({ src, alt }) => {
    const url = typeof src === 'string' && src.startsWith('/api/') ? import.meta.env.VITE_SERVER_URL + src : src
    return (
      <a href={url} target='_blank' rel='noreferrer' className='block my-2 w-fit'>
        <img
          src={url}
          alt={alt}
          loading='lazy'
          className='max-w-full sm:max-w-md rounded-lg border border-line bg-panel aspect-square object-cover'
        />
      </a>
    )
  },
  // Inline `code`
  code: ({ children }) => <code className='px-1 py-0.5 rounded bg-raised text-[13px] font-mono text-ink'>{children}</code>,
  table: ({ children }) => (
    <div className='my-3 overflow-x-auto rounded-lg border border-line'>
      <table className='w-full text-left text-[13px] border-collapse'>{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className='bg-panel text-ink'>{children}</thead>,
  th: ({ children }) => <th className='px-3 py-2 font-medium border-b border-line'>{children}</th>,
  td: ({ children }) => <td className='px-3 py-2 border-t border-line-soft align-top'>{children}</td>,
}

// Main chat panel: message list + input box.
function ChatArea({ conversationId, title, userName, ensureConversation, onOpenArtifact }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  // loading = a reply is in progress; waiting = no text has arrived yet
  // (shows the typing dots)
  const [loading, setLoading] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [agent, setAgent] = useState('auto')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Lets the Stop button (or switching chats) cancel the stream
  const abortRef = useRef<AbortController | null>(null)
  // Set while we create a conversation mid-send, so the effect below doesn't
  // wipe the message we just added
  const skipNextLoad = useRef(false)

  // Load the history whenever the selected conversation changes
  useEffect(() => {
    if (skipNextLoad.current) {
      skipNextLoad.current = false
      return
    }
    // Switched to another chat: stop any reply still streaming
    abortRef.current?.abort()
    const load = async () => {
      // "New chat": start with an empty message list
      if (!conversationId) {
        setMessages([])
        return
      }
      try {
        const { data } = await api.get(`/api/chat/get-messages/${conversationId}`)
        // The chat service returns newest first; show oldest at the top
        setMessages([...data].reverse())
      } catch (error) {
        console.error('[ChatArea] Failed to load messages:', error)
      }
    }
    load()
  }, [conversationId])

  // Keep the newest message in view
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Grow the input box with its text (up to its max height)
  useLayoutEffect(() => {
    const box = inputRef.current
    if (!box) return
    box.style.height = 'auto'
    box.style.height = `${box.scrollHeight}px`
  }, [input])

  const send = async () => {
    const prompt = input.trim()
    if (!prompt || loading) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: prompt }])
    setLoading(true)
    setWaiting(true)

    const abort = new AbortController()
    abortRef.current = abort

    // The reply so far. The first piece adds a new assistant message; later
    // pieces replace that last message with the longer text.
    let reply = ''
    let started = false
    const showReply = (content: string) => {
      // Decide now (not inside the updater, which React may run later)
      const isFirst = !started
      started = true
      const message: Message = { role: 'assistant', content }
      setMessages((prev) => (isFirst ? [...prev, message] : [...prev.slice(0, -1), message]))
      setWaiting(false)
    }

    try {
      let id = conversationId
      if (!id) {
        skipNextLoad.current = true
        id = await ensureConversation(prompt)
      }

      // Only send `agent` when the user picked one; otherwise the router decides
      await streamChat(
        { prompt, conversationId: id, ...(agent !== 'auto' && { agent }) },
        (event) => {
          if (event.type === 'token') {
            reply += event.content
            showReply(reply)
          } else if (event.type === 'error') {
            showReply(event.message)
          } else if (event.type === 'done') {
            // Coding replies open all their files in the artifact panel, and
            // pdf and ppt replies open the file they made
            let artifact = null
            if (event.agent === 'coding') artifact = toArtifact(event.aiResponse)
            if (event.agent === 'pdf' || event.agent === 'ppt') artifact = documentInReply(event.aiResponse)
            if (artifact) onOpenArtifact(artifact)
          }
        },
        abort.signal,
      )
    } catch (error) {
      // Stopped by the user: keep whatever text already arrived
      if (abort.signal.aborted) return
      console.error('[ChatArea] Agent request failed:', error)
      showReply('Something went wrong. Please try again.')
    } finally {
      // Only reset if this is still the current stream
      if (abortRef.current === abort) {
        abortRef.current = null
        setLoading(false)
        setWaiting(false)
      }
    }
  }

  const stop = () => abortRef.current?.abort()

  // Enter sends, Shift+Enter adds a new line
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const isEmpty = messages.length === 0 && !loading

  return (
    <main className='flex-1 min-w-0 h-full flex flex-col'>
      <header className='shrink-0 h-12 flex items-center px-6 border-b border-line-soft'>
        <h1 className='text-[13px] font-medium text-ink-soft truncate'>{title || 'New chat'}</h1>
      </header>

      <div className='flex-1 overflow-y-auto'>
        {isEmpty ? (
          <div className='h-full max-w-3xl mx-auto px-6 pb-6 flex flex-col justify-end gap-1.5'>
            <h2 className='text-[30px] font-semibold tracking-tight text-ink'>
              {timeOfDay()}{userName ? `, ${userName.split(' ')[0]}` : ''}
            </h2>
            <p className='text-[15px] text-muted'>Ask a question, write some code, or search the web.</p>
          </div>
        ) : (
          <div className='max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6'>
            {messages.map((m, i) => (
              <div key={m._id ?? i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                {m.role === 'user' ? (
                  <div className='max-w-[80%] px-3.5 py-2 rounded-xl bg-raised text-[15px] leading-[1.6] text-ink whitespace-pre-wrap'>
                    {m.content}
                  </div>
                ) : (
                  <div className='w-full text-[15px] leading-[1.7] text-ink-soft flex flex-col gap-1'>
                    {splitCodeBlocks(m.content ?? '').map((part, j) =>
                      part.type === 'text' ? (
                        <OpenArtifactContext.Provider key={j} value={onOpenArtifact}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                            {part.content}
                          </ReactMarkdown>
                        </OpenArtifactContext.Provider>
                      ) : (
                        <div key={j} className='my-2.5 rounded-lg border border-line bg-sidebar overflow-hidden'>
                          <div className='flex items-center justify-between gap-3 pl-3 pr-3 h-8 border-b border-line-soft'>
                            <span className='min-w-0 truncate text-[11px] font-mono text-muted'>{part.fileName || part.language || 'code'}</span>
                            <div className='flex items-center gap-3 shrink-0'>
                              <CopyButton text={part.content} />
                              <Button
                                variant='link'
                                className='text-[11px]'
                                onClick={() => {
                                  const artifact = toArtifact(m.content ?? '', j)
                                  if (artifact) onOpenArtifact(artifact)
                                }}
                              >
                                Open
                              </Button>
                            </div>
                          </div>
                          <pre className='p-3 overflow-x-auto text-[13px] leading-relaxed font-mono'><code>{part.content}</code></pre>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator until the first words of the reply arrive */}
            {waiting && (
              <span role='status' aria-label='Writing a reply' className='block w-2 h-4 bg-accent animate-pulse motion-reduce:animate-none' />
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input box */}
      <div className='w-full max-w-3xl mx-auto px-6 pb-3'>
        <div className='flex flex-col rounded-xl bg-panel border border-line focus-within:border-line-strong transition-colors'>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            aria-label='Message'
            placeholder='Message Aryan’s Assistant...'
            className='w-full max-h-40 resize-none bg-transparent px-3.5 pt-3 pb-1 text-[15px] text-ink placeholder:text-faint outline-none'
          />

          <div className='flex items-center justify-between p-1.5'>
            <AgentPicker value={agent} onChange={setAgent} />
            {/* While a reply is streaming, Send becomes Stop */}
            {loading ? (
              <Button variant='outline' onClick={stop} title='Stop' aria-label='Stop' className='w-8 h-8 p-0'>
                <StopIcon size={14} />
              </Button>
            ) : (
              <Button onClick={send} disabled={!input.trim()} title='Send' aria-label='Send' className='w-8 h-8 p-0'>
                <ArrowUpIcon />
              </Button>
            )}
          </div>
        </div>
        <p className='mt-2 text-center text-[11px] text-muted'>AI can make mistakes. Check important info.</p>
      </div>

      {/* Empty chat: this spacer lifts the greeting and input box to mid-screen */}
      {isEmpty && <div className='flex-1' />}
    </main>
  )
}

export default ChatArea
