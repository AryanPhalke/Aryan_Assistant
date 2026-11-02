import { useEffect, useRef, useState } from 'react'
import api from '../../utils/axios'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ArtifactData } from './Artifact'
import { Button } from './ui/Button'
import { cn } from './ui/cn'
import streamChat from '../features/streamChat'

type Message = {
  _id?: string
  role: 'user' | 'assistant'
  content: string
}

type Props = {
  conversationId: string | null
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

// Agents the user can pick. `id` must match the node names in the agent
// service's graph.js; "auto" lets the router decide. `ready: false` marks
// agents that aren't built yet (they reply with a "not available" message).
const AGENTS = [
  { id: 'auto', label: 'Auto', ready: true },
  { id: 'chat', label: 'Chat', ready: true },
  { id: 'search', label: 'Search', ready: false },
  { id: 'coding', label: 'Coding', ready: true },
  { id: 'pdf', label: 'PDF', ready: true },
  { id: 'ppt', label: 'Slides', ready: false },
  { id: 'imageGen', label: 'Image', ready: true },
]

// Tailwind styles for each Markdown element in AI replies
// (code blocks are handled separately so they keep the "Open" button)
const markdownComponents: Components = {
  h1: ({ children }) => <h1 className='text-[20px] font-semibold text-slate-100 mt-4 mb-2'>{children}</h1>,
  h2: ({ children }) => <h2 className='text-[17px] font-semibold text-slate-100 mt-4 mb-2'>{children}</h2>,
  h3: ({ children }) => <h3 className='text-[15px] font-semibold text-slate-100 mt-3 mb-1.5'>{children}</h3>,
  p: ({ children }) => <p className='my-2'>{children}</p>,
  strong: ({ children }) => <strong className='font-semibold text-slate-100'>{children}</strong>,
  ul: ({ children }) => <ul className='list-disc pl-5 my-2 flex flex-col gap-1 marker:text-slate-500'>{children}</ul>,
  ol: ({ children }) => <ol className='list-decimal pl-5 my-2 flex flex-col gap-1 marker:text-slate-500'>{children}</ol>,
  // Generated PDFs are saved as "/api/agent/files/..." paths on the gateway, like images
  a: ({ href, children }) => (
    <a
      href={href?.startsWith('/api/') ? import.meta.env.VITE_SERVER_URL + href : href}
      target='_blank'
      rel='noreferrer'
      className='text-indigo-400 underline underline-offset-2 hover:text-indigo-300'
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => <blockquote className='border-l-2 border-white/15 pl-3 my-2 text-slate-400'>{children}</blockquote>,
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
          className='max-w-full sm:max-w-md rounded-xl border border-line bg-white/4 aspect-square object-cover'
        />
      </a>
    )
  },
  // Inline `code`
  code: ({ children }) => <code className='px-1.5 py-0.5 rounded bg-white/8 text-[13px] font-mono text-slate-100'>{children}</code>,
  table: ({ children }) => (
    <div className='my-3 overflow-x-auto rounded-xl border border-line'>
      <table className='w-full text-left text-[13px] border-collapse'>{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className='bg-white/4 text-slate-100'>{children}</thead>,
  th: ({ children }) => <th className='px-3 py-2 font-semibold border-b border-line'>{children}</th>,
  td: ({ children }) => <td className='px-3 py-2 border-t border-line-soft align-top'>{children}</td>,
}

// Main chat panel: message list + input box.
function ChatArea({ conversationId, ensureConversation, onOpenArtifact }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  // loading = a reply is in progress; waiting = no text has arrived yet
  // (shows the typing dots)
  const [loading, setLoading] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [agent, setAgent] = useState('auto')
  const bottomRef = useRef<HTMLDivElement>(null)
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
            // Coding replies open all their files in the artifact panel
            const artifact = event.agent === 'coding' ? toArtifact(event.aiResponse) : null
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

  return (
    <main className='flex-1 min-w-0 h-full flex flex-col'>
      <div className='flex-1 overflow-y-auto'>
        {messages.length === 0 && !loading ? (
          <div className='h-full flex flex-col items-center justify-center gap-2 px-6 text-center'>
            <h1 className='text-[26px] font-semibold tracking-tight text-slate-100'>How can I help you today?</h1>
            <p className='text-[14px] text-slate-500'>Ask a question, write some code, or search the web.</p>
          </div>
        ) : (
          <div className='max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6'>
            {messages.map((m, i) => (
              <div key={m._id ?? i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                {m.role === 'user' ? (
                  <div className='max-w-[80%] px-4 py-2.5 rounded-2xl bg-indigo-500/20 text-[14px] text-slate-100 whitespace-pre-wrap'>
                    {m.content}
                  </div>
                ) : (
                  <div className='w-full text-[14px] leading-relaxed text-slate-300 flex flex-col gap-1'>
                    {splitCodeBlocks(m.content ?? '').map((part, j) =>
                      part.type === 'text' ? (
                        <ReactMarkdown key={j} remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {part.content}
                        </ReactMarkdown>
                      ) : (
                        <div key={j} className='my-2 rounded-xl border border-line bg-panel overflow-hidden'>
                          <div className='flex items-center justify-between px-3 h-8 border-b border-line-soft'>
                            <span className='text-[11px] font-mono text-slate-500'>{part.fileName || part.language || 'code'}</span>
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
                          <pre className='p-3 overflow-x-auto text-[13px] font-mono'><code>{part.content}</code></pre>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator until the first words of the reply arrive */}
            {waiting && (
              <div className='flex gap-1.5 py-2'>
                <span className='w-2 h-2 rounded-full bg-slate-500 animate-bounce' />
                <span className='w-2 h-2 rounded-full bg-slate-500 animate-bounce [animation-delay:150ms]' />
                <span className='w-2 h-2 rounded-full bg-slate-500 animate-bounce [animation-delay:300ms]' />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input box */}
      <div className='px-6 pb-6'>
        <div className='max-w-3xl mx-auto flex flex-col gap-1 p-2 rounded-2xl bg-panel border border-line focus-within:border-white/16 transition-colors'>
          {/* Agent picker */}
          <div className='flex flex-wrap gap-1.5 px-1 pt-1'>
            {AGENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAgent(a.id)}
                title={a.ready ? undefined : 'This agent is not built yet'}
                className={cn(
                  'h-7 px-3 flex items-center gap-1.5 rounded-full text-[12px] border transition-colors cursor-pointer',
                  agent === a.id
                    ? 'bg-white text-slate-900 border-white'
                    : 'border-line text-slate-400 hover:bg-white/5 hover:text-slate-200',
                )}
              >
                {a.label}
                {!a.ready && (
                  <span className={cn('text-[10px]', agent === a.id ? 'text-slate-500' : 'text-slate-600')}>Soon</span>
                )}
              </button>
            ))}
          </div>

          <div className='flex items-end gap-2'>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder='Message Aryan’s Assistant...'
              className='flex-1 max-h-40 resize-none bg-transparent px-2 py-2 text-[14px] text-slate-100 placeholder:text-slate-600 outline-none'
            />
            {/* While a reply is streaming, Send becomes Stop */}
            {loading ? (
              <Button variant='outline' onClick={stop} className='h-9 px-4'>
                Stop
              </Button>
            ) : (
              <Button onClick={send} disabled={!input.trim()}>
                Send
              </Button>
            )}
          </div>
        </div>
        <p className='mt-2 text-center text-[11px] text-slate-600'>AI can make mistakes. Check important info.</p>
      </div>
    </main>
  )
}

export default ChatArea
