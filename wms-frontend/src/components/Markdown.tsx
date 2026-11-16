import type { ReactNode } from 'react'

/**
 * Small, safe Markdown renderer for AI replies (no HTML injection):
 * headings, bold/italic, inline code, code blocks, bullet/numbered lists, tables.
 */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    const k = `${keyBase}-${i++}`
    if (tok.startsWith('**')) out.push(<strong key={k} className="font-semibold text-ink">{tok.slice(2, -2)}</strong>)
    else if (tok.startsWith('`')) out.push(<code key={k} className="px-1 py-0.5 rounded bg-surface-subtle font-mono text-[12px]">{tok.slice(1, -1)}</code>)
    else out.push(<em key={k}>{tok.slice(1, -1)}</em>)
    last = m.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export default function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let k = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim().startsWith('```')) {
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i++])
      i++
      blocks.push(
        <pre key={k++} className="bg-ink text-white/90 rounded-lg p-3 text-xs overflow-x-auto font-mono">{code.join('\n')}</pre>,
      )
      continue
    }

    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const parse = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      const head = parse(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(parse(lines[i++]))
      blocks.push(
        <div key={k++} className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-surface-subtle">
              <tr>{head.map((h, j) => <th key={j} className="px-2.5 py-1.5 text-left font-semibold text-ink-muted">{inline(h, `h${j}`)}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => <td key={ci} className="px-2.5 py-1.5 tabular-nums whitespace-nowrap">{inline(c, `c${ri}${ci}`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) {
      blocks.push(<p key={k++} className="font-semibold text-ink mt-1">{inline(h[2], `h${k}`)}</p>)
      i++
      continue
    }

    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]/.test(line)
      const items: string[] = []
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ''))
        i++
      }
      const Tag = ordered ? 'ol' : 'ul'
      blocks.push(
        <Tag key={k++} className={`${ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-0.5`}>
          {items.map((it, j) => <li key={j}>{inline(it, `l${k}${j}`)}</li>)}
        </Tag>,
      )
      continue
    }

    if (line.trim() === '') {
      i++
      continue
    }

    const para: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,4}\s|```|\s*([-*•]|\d+[.)])\s+|\s*\|)/.test(lines[i])) para.push(lines[i++])
    if (para.length === 0) para.push(lines[i++])
    blocks.push(<p key={k++}>{inline(para.join(' '), `p${k}`)}</p>)
  }

  return <div className="space-y-2 leading-relaxed">{blocks}</div>
}
