import { useEffect, useRef, useState } from 'react'
import api from '../../utils/axios'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ArtifactData } from './Artifact'

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
  { id: 'pdf', label: 'PDF', ready: false },
  { id: 'ppt', label: 'Slides', ready: false },
  { id: 'imageGen', label: 'Image', ready: false },
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
  a: ({ href, children }) => (
    <a href={href} target='_blank' rel='noreferrer' className='text-indigo-400 underline underline-offset-2 hover:text-indigo-300'>
      {children}
    </a>
  ),
  blockquote: ({ children }) => <blockquote className='border-l-2 border-white/[0.15] pl-3 my-2 text-slate-400'>{children}</blockquote>,
  hr: () => <hr className='my-4 border-white/[0.08]' />,
  // Inline `code`
  code: ({ children }) => <code className='px-1.5 py-0.5 rounded bg-white/[0.08] text-[13px] font-mono text-slate-100'>{children}</code>,
  table: ({ children }) => (
    <div className='my-3 overflow-x-auto rounded-xl border border-white/[0.08]'>
      <table className='w-full text-left text-[13px] border-collapse'>{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className='bg-white/[0.04] text-slate-100'>{children}</thead>,
  th: ({ children }) => <th className='px-3 py-2 font-semibold border-b border-white/[0.08]'>{children}</th>,
  td: ({ children }) => <td className='px-3 py-2 border-t border-white/[0.06] align-top'>{children}</td>,
}

// Main chat panel: message list + input box.
function ChatArea({ conversationId, ensureConversation, onOpenArtifact }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [agent, setAgent] = useState('auto')
  const bottomRef = useRef<HTMLDivElement>(null)
  // Set while we create a conversation mid-send, so the effect below doesn't
  // wipe the message we just added
  const skipNextLoad = useRef(false)

  // Load the history whenever the selected conversation changes
  useEffect(() => {
    if (skipNextLoad.current) {
      skipNextLoad.current = false
      return
    }
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

    try {
      let id = conversationId
      if (!id) {
        skipNextLoad.current = true
        id = await ensureConversation(prompt)
      }
      // Only send `agent` when the user picked one; otherwise the router decides
      const { data } = await api.post('/api/agent/chat', {
        prompt,
        conversationId: id,
        ...(agent !== 'auto' && { agent }),
      })
      const reply: string = data.aiResponse ?? ''
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])

      // Coding replies open all their files in the artifact panel automatically
      const artifact = data.agent === 'coding' ? toArtifact(reply) : null
      if (artifact) onOpenArtifact(artifact)
    } catch (error) {
      console.error('[ChatArea] Agent request failed:', error)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

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
                        <div key={j} className='my-2 rounded-xl border border-white/[0.08] bg-[#13151c] overflow-hidden'>
                          <div className='flex items-center justify-between px-3 h-8 border-b border-white/[0.06]'>
                            <span className='text-[11px] font-mono text-slate-500'>{part.fileName || part.language || 'code'}</span>
                            <button
                              onClick={() => {
                                const artifact = toArtifact(m.content ?? '', j)
                                if (artifact) onOpenArtifact(artifact)
                              }}
                              className='text-[11px] text-slate-400 hover:text-slate-100 transition-colors cursor-pointer'
                            >
                              Open
                            </button>
                          </div>
                          <pre className='p-3 overflow-x-auto text-[13px] font-mono'><code>{part.content}</code></pre>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator while the agent works */}
            {loading && (
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
        <div className='max-w-3xl mx-auto flex flex-col gap-1 p-2 rounded-2xl bg-[#13151c] border border-white/[0.08] focus-within:border-white/[0.16] transition-colors'>
          {/* Agent picker */}
          <div className='flex flex-wrap gap-1.5 px-1 pt-1'>
            {AGENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAgent(a.id)}
                title={a.ready ? undefined : 'This agent is not built yet'}
                className={`h-7 px-3 flex items-center gap-1.5 rounded-full text-[12px] border transition-colors cursor-pointer ${
                  agent === a.id
                    ? 'bg-white text-slate-900 border-white'
                    : 'border-white/[0.08] text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
                }`}
              >
                {a.label}
                {!a.ready && (
                  <span className={`text-[10px] ${agent === a.id ? 'text-slate-500' : 'text-slate-600'}`}>Soon</span>
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
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className='h-9 px-4 rounded-xl bg-white text-[13px] font-medium text-slate-900 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer'
            >
              Send
            </button>
          </div>
        </div>
        <p className='mt-2 text-center text-[11px] text-slate-600'>AI can make mistakes. Check important info.</p>
      </div>
    </main>
  )
}

export default ChatArea
