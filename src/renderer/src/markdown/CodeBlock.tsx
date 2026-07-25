import { useEffect, useState } from 'react'
import { getHighlighter, SHIKI_THEME } from './highlighter'

interface Props {
  code: string
  lang?: string
  highlight: boolean
}

const SUPPORTED = new Set(['typescript', 'tsx', 'javascript', 'js', 'ts', 'python', 'py', 'java', 'go', 'sql', 'bash', 'sh', 'shell', 'json'])

const ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
}

export function CodeBlock({ code, lang, highlight }: Props): JSX.Element {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    if (!highlight) {
      setHtml(null)
      return
    }
    let cancelled = false
    const normalized = lang ? (ALIASES[lang] ?? lang) : ''
    const useLang = SUPPORTED.has(normalized) ? normalized : 'typescript'
    void getHighlighter().then((hl) => {
      if (cancelled) return
      try {
        const out = hl.codeToHtml(code, { lang: useLang, theme: SHIKI_THEME })
        setHtml(out)
      } catch {
        setHtml(null)
      }
    })
    return () => {
      cancelled = true
    }
  }, [code, lang, highlight])

  if (highlight && html) {
    return <div className="llm-codeblock" dangerouslySetInnerHTML={{ __html: html }} />
  }
  return (
    <pre className="llm-codeblock-plain">
      <code>{code}</code>
    </pre>
  )
}
