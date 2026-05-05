import { createHighlighterCore, type HighlighterCore } from 'shiki/core'

let highlighterPromise: Promise<HighlighterCore> | null = null

export function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const [theme, ts, tsx, js, py, java, go, sql, bash, json, engineModule] = await Promise.all([
        import('shiki/themes/vitesse-black.mjs').then((m) => m.default),
        import('shiki/langs/typescript.mjs').then((m) => m.default),
        import('shiki/langs/tsx.mjs').then((m) => m.default),
        import('shiki/langs/javascript.mjs').then((m) => m.default),
        import('shiki/langs/python.mjs').then((m) => m.default),
        import('shiki/langs/java.mjs').then((m) => m.default),
        import('shiki/langs/go.mjs').then((m) => m.default),
        import('shiki/langs/sql.mjs').then((m) => m.default),
        import('shiki/langs/bash.mjs').then((m) => m.default),
        import('shiki/langs/json.mjs').then((m) => m.default),
        import('shiki/engine/javascript'),
      ])
      const engine = engineModule.createJavaScriptRegexEngine()
      return await createHighlighterCore({
        themes: [theme],
        langs: [ts, tsx, js, py, java, go, sql, bash, json],
        engine,
      })
    })()
  }
  return highlighterPromise
}

export const SHIKI_THEME = 'vitesse-black'
