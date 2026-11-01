// Events sent by the agent service's /chat/stream route (Server-Sent Events)
export type StreamEvent =
  | { type: 'agent'; agent: string }
  | { type: 'token'; content: string }
  | { type: 'done'; agent: string; aiResponse: string }
  | { type: 'error'; message: string }

type ChatRequest = { prompt: string; conversationId: string; agent?: string }

// Sends a prompt and calls onEvent for every event as it arrives, so the
// reply can be shown while it's still being written. Uses fetch instead of
// axios because axios can't read a response stream in the browser.
// Pass an AbortSignal to stop the stream (e.g. a Stop button).
const streamChat = async (body: ChatRequest, onEvent: (event: StreamEvent) => void, signal?: AbortSignal) => {
  const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/agent/chat/stream`, {
    method: 'POST',
    credentials: 'include', // send the session cookie, like axios withCredentials
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) throw new Error(`Stream request failed: ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  // Network chunks don't line up with events, so keep any half-received
  // event until the rest arrives. Events are separated by a blank line.
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const event of events) {
      const line = event.split('\n').find((l) => l.startsWith('data: '))
      if (line) onEvent(JSON.parse(line.slice(6)))
    }
  }
}

export default streamChat
