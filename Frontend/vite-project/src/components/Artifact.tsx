import { useState } from 'react'

export type ArtifactData = {
  language: string
  code: string
}

type Props = {
  artifact: ArtifactData
  onClose: () => void
}

// Right-hand panel that shows a code block from the chat at full height,
// with a copy button. Opened from the "Open" button on a code block.
function Artifact({ artifact, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(artifact.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <aside className='w-[45%] max-w-[640px] shrink-0 h-full flex flex-col bg-[#13151c] border-l border-white/[0.08]'>
      <header className='h-12 shrink-0 flex items-center justify-between px-4 border-b border-white/[0.06]'>
        <span className='text-[12px] font-mono text-slate-400'>{artifact.language || 'text'}</span>
        <div className='flex items-center gap-3'>
          <button onClick={copy} className='text-[12px] text-slate-400 hover:text-slate-100 transition-colors cursor-pointer'>
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={onClose}
            title='Close'
            className='w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 transition-colors cursor-pointer'
          >
            ✕
          </button>
        </div>
      </header>

      <pre className='flex-1 overflow-auto p-4 text-[13px] leading-relaxed font-mono text-slate-200'>
        <code>{artifact.code}</code>
      </pre>
    </aside>
  )
}

export default Artifact
