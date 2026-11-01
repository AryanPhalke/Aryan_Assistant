import { useState } from 'react'

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
  artifact: ArtifactData
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

// Right-hand panel for code from a reply. Shows every file as a tab, plus a
// live Preview that combines HTML + CSS + JS. Coding replies open here
// automatically; other code blocks open from the "Open" button.
function Artifact({ artifact, onClose }: Props) {
  const { files } = artifact
  const preview = buildPreview(files)
  // -1 = Preview tab. Home remounts this panel (via `key`) for each new
  // artifact, so the selection starts fresh every time.
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
    `h-8 px-3 shrink-0 rounded-lg text-[12px] font-mono transition-colors cursor-pointer ${
      active ? 'bg-white/[0.08] text-slate-100' : 'text-slate-500 hover:text-slate-200'
    }`

  return (
    <aside className='w-[45%] max-w-[720px] shrink-0 h-full flex flex-col bg-[#13151c] border-l border-white/[0.08]'>
      <header className='shrink-0 flex items-center justify-between gap-3 px-3 py-2 border-b border-white/[0.06]'>
        {/* Tabs: Preview + one per file */}
        <div className='flex items-center gap-1 min-w-0 overflow-x-auto'>
          {preview && (
            <button onClick={() => setSelected(-1)} className={`${tabClass(selected === -1)} font-sans`}>
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
              <button onClick={copy} className='text-[12px] text-slate-400 hover:text-slate-100 transition-colors cursor-pointer'>
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={() => download(current, selected)}
                className='text-[12px] text-slate-400 hover:text-slate-100 transition-colors cursor-pointer'
              >
                Download
              </button>
            </>
          )}
          {files.length > 1 && (
            <button onClick={downloadAll} className='text-[12px] text-slate-400 hover:text-slate-100 transition-colors cursor-pointer'>
              Download all
            </button>
          )}
          <button
            onClick={onClose}
            title='Close'
            className='w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 transition-colors cursor-pointer'
          >
            ✕
          </button>
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
    </aside>
  )
}

export default Artifact
