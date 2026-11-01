import { useState } from 'react'
import ResizeHandle from './ResizeHandle'
import { ARTIFACT } from './layout'
import { Button, IconButton } from './ui/Button'
import { cn } from './ui/cn'

export type ArtifactFile = {
  language: string
  code: string
  // File name from the code block label, e.g. ```html:index.html
  fileName?: string
}

// All code blocks from one reply, plus which one to show first
export type ArtifactData = {
  files: ArtifactFile[]
  active: number
}

type Props = {
  // null = nothing generated yet in this chat
  artifact: ArtifactData | null
  // Panel width in px; changed by dragging the left edge
  width: number
  // Widest the panel may get (Home works it out from the sidebar width)
  maxWidth: number
  onResize: (width: number) => void
  // Collapses the panel back to the strip on the right edge
  onClose: () => void
}

// File extension for names when the reply had no file name
const EXTENSIONS: Record<string, string> = {
  javascript: 'js', js: 'js', jsx: 'jsx', typescript: 'ts', ts: 'ts', tsx: 'tsx',
  python: 'py', py: 'py', html: 'html', css: 'css', json: 'json', java: 'java',
  c: 'c', cpp: 'cpp', csharp: 'cs', go: 'go', rust: 'rs', sql: 'sql',
  bash: 'sh', sh: 'sh', shell: 'sh', yaml: 'yml', yml: 'yml', markdown: 'md', svg: 'svg',
}

const nameOf = (file: ArtifactFile, index: number) =>
  file.fileName || `file${index + 1}.${EXTENSIONS[file.language.toLowerCase()] ?? 'txt'}`

const isLang = (file: ArtifactFile, ...langs: string[]) => langs.includes(file.language.toLowerCase())

// Escapes a value for use inside a RegExp
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Builds one HTML document for the Preview tab: takes the html file and
// replaces <link href="style.css"> / <script src="script.js"> with the
// matching files' contents, since the iframe can't load them by name.
// If the reply has CSS/JS but the html doesn't reference them, they're
// appended so the preview still works.
const buildPreview = (files: ArtifactFile[]) => {
  const html = files.find((f) => isLang(f, 'html'))
  if (!html) {
    const svg = files.find((f) => isLang(f, 'svg'))
    return svg?.code ?? null
  }

  let doc = html.code
  files.forEach((f, i) => {
    const name = escapeRegex(nameOf(f, i))
    if (isLang(f, 'css')) {
      const link = new RegExp(`<link[^>]*href=["'](?:\\./)?${name}["'][^>]*>`, 'i')
      doc = link.test(doc)
        ? doc.replace(link, () => `<style>\n${f.code}\n</style>`)
        : doc.replace(/<\/head>/i, () => `<style>\n${f.code}\n</style>\n</head>`)
    }
    if (isLang(f, 'javascript', 'js')) {
      const script = new RegExp(`<script[^>]*src=["'](?:\\./)?${name}["'][^>]*>\\s*</script>`, 'i')
      doc = script.test(doc)
        ? doc.replace(script, () => `<script>\n${f.code}\n</script>`)
        : doc.replace(/<\/body>/i, () => `<script>\n${f.code}\n</script>\n</body>`)
    }
  })
  return doc
}

// Right-hand panel. Shows the artifact (files + live preview) or, when
// nothing has been generated yet, a "Nothing to preview" message.
// Drag the left edge to resize; drag it almost shut to collapse to the strip.
function Artifact({ artifact, width, maxWidth, onResize, onClose }: Props) {
  const [dragging, setDragging] = useState(false)

  // Close button, shown at the right of the header in both states
  const controls = (
    <IconButton onClick={onClose} title='Close'>
      ✕
    </IconButton>
  )

  return (
    <aside
      style={{ width }}
      className={cn(
        'relative shrink-0 h-full flex flex-col bg-panel border-l border-line',
        dragging && width < ARTIFACT.collapseAt && 'opacity-50',
      )}
    >
      {/* Drag the left edge to resize; nearly shut collapses to the strip */}
      <ResizeHandle
        side='left'
        width={width}
        min={ARTIFACT.min}
        max={maxWidth}
        collapseAt={ARTIFACT.collapseAt}
        defaultWidth={ARTIFACT.default}
        onResize={onResize}
        onCollapse={onClose}
        dragging={dragging}
        onDraggingChange={setDragging}
      />

      {/* While dragging, cover the panel so the preview iframe doesn't swallow
          pointer events, and stop text from being selected */}
      {dragging && <div className='absolute inset-0 z-10 cursor-col-resize select-none' />}

      {artifact ? (
        <ArtifactView artifact={artifact} controls={controls} />
      ) : (
        <>
          <header className='shrink-0 h-12 flex items-center justify-between px-3 border-b border-line-soft'>
            <span className='px-2 text-[13px] font-medium text-slate-300'>Artifacts</span>
            {controls}
          </header>
          {/* Empty state */}
          <div className='flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center'>
            <div className='w-12 h-12 rounded-2xl border border-line bg-white/3 flex items-center justify-center text-[20px] text-slate-500'>
              {'</>'}
            </div>
            <p className='text-[15px] font-medium text-slate-200'>Nothing to preview yet</p>
            <p className='max-w-70 text-[13px] text-slate-500'>
              Ask for code, a web page, a PDF or slides and it will show up here.
            </p>
          </div>
        </>
      )}
    </aside>
  )
}

// Files + preview for one artifact. Separate component so its tab state
// resets when Home remounts it (via `key`) for a new artifact.
function ArtifactView({ artifact, controls }: { artifact: ArtifactData; controls: React.ReactNode }) {
  const { files } = artifact
  const preview = buildPreview(files)
  // -1 = Preview tab
  const [selected, setSelected] = useState(preview ? -1 : artifact.active)
  const [copied, setCopied] = useState(false)

  const current = selected >= 0 ? files[selected] : null

  const copy = async () => {
    if (!current) return
    await navigator.clipboard.writeText(current.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const download = (file: ArtifactFile, index: number) => {
    const url = URL.createObjectURL(new Blob([file.code], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = nameOf(file, index)
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadAll = () => files.forEach((f, i) => download(f, i))

  const tabClass = (active: boolean) =>
    cn(
      'h-8 px-3 shrink-0 rounded-lg text-[12px] font-mono transition-colors cursor-pointer',
      active ? 'bg-white/8 text-slate-100' : 'text-slate-500 hover:text-slate-200',
    )

  return (
    <>
      <header className='shrink-0 flex items-center justify-between gap-3 px-3 py-2 border-b border-line-soft'>
        {/* Tabs: Preview + one per file */}
        <div className='flex items-center gap-1 min-w-0 overflow-x-auto'>
          {preview && (
            <button onClick={() => setSelected(-1)} className={cn(tabClass(selected === -1), 'font-sans')}>
              Preview
            </button>
          )}
          {files.map((f, i) => (
            <button key={i} onClick={() => setSelected(i)} className={tabClass(selected === i)}>
              {nameOf(f, i)}
            </button>
          ))}
        </div>

        <div className='flex items-center gap-3 shrink-0'>
          {current && (
            <>
              <Button variant='link' onClick={copy}>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button variant='link' onClick={() => download(current, selected)}>
                Download
              </Button>
            </>
          )}
          {files.length > 1 && (
            <Button variant='link' onClick={downloadAll}>
              Download all
            </Button>
          )}
          {controls}
        </div>
      </header>

      {current ? (
        <pre className='flex-1 overflow-auto p-4 text-[13px] leading-relaxed font-mono text-slate-200'>
          <code>{current.code}</code>
        </pre>
      ) : (
        // sandbox="allow-scripts" runs the page's JS but keeps it isolated from
        // our app (no access to cookies, storage or the parent page)
        <iframe title='Preview' sandbox='allow-scripts' srcDoc={preview ?? ''} className='flex-1 w-full bg-white' />
      )}
    </>
  )
}

export default Artifact
