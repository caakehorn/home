import { useMemo, type ReactNode } from 'react'
import { Chart } from './Chart'
import { Brief } from './Brief'
import { Inline, preprocess } from './inline'
import { analyzeTable, type TableData } from './table'
import { headingId, segmentBriefs } from './brief'
import { marked, type Token, type Tokens } from 'marked'
import './markdown.css'

function Block({ token }: { token: Token }): ReactNode {
  switch (token.type) {
    case 'heading': {
      const h = token as Tokens.Heading
      const id = headingId(h.text)
      const Tag = (`h${Math.min(6, h.depth + 1)}`) as 'h2'
      return (
        <Tag id={id} className="md__h">
          <Inline tokens={h.tokens} />
        </Tag>
      )
    }
    case 'paragraph':
      return (
        <p className="md__p">
          <Inline tokens={(token as Tokens.Paragraph).tokens} />
        </p>
      )
    case 'list': {
      const list = token as Tokens.List
      const Tag = list.ordered ? 'ol' : 'ul'
      return (
        <Tag className="md__list">
          {list.items.map((item, i) => (
            <li key={i}>
              <Inline tokens={item.tokens} />
            </li>
          ))}
        </Tag>
      )
    }
    case 'blockquote':
      return (
        <blockquote className="md__quote">
          {(token as Tokens.Blockquote).tokens.map((t, i) => (
            <Block key={i} token={t} />
          ))}
        </blockquote>
      )
    case 'code':
      return (
        <pre className="md__code">
          <code>{(token as Tokens.Code).text}</code>
        </pre>
      )
    case 'hr':
      return <hr className="md__hr" />
    case 'table': {
      const t = token as Tokens.Table
      const data: TableData = {
        headers: t.header.map((c) => c.text),
        rows: t.rows.map((row) => row.map((c) => c.text)),
      }
      const spec = analyzeTable(data)
      // Numbers become a chart; the table itself stays reachable in its toggle.
      if (spec) return <Chart spec={spec} table={data} />
      return (
        <div className="md__tablewrap">
          <table className="md__table">
            <thead>
              <tr>
                {t.header.map((c, i) => (
                  <th key={i} scope="col">
                    <Inline tokens={c.tokens} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((c, i) => (
                    <td key={i}>
                      <Inline tokens={c.tokens} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    case 'space':
      return null
    default:
      return 'text' in token && token.text ? <p className="md__p">{token.text as string}</p> : null
  }
}

function Blocks({ source }: { source: string }) {
  return (
    <>
      {marked.lexer(preprocess(source)).map((token, i) => (
        <Block key={i} token={token} />
      ))}
    </>
  )
}

export function Markdown({ source }: { source: string }) {
  // Compressed blocks are pulled out ahead of lexing: the visualiser reads the
  // prose whole, not a stream of tokens, and the rest of the page is unaffected.
  const segments = useMemo(() => segmentBriefs(source), [source])
  return (
    <div className="md">
      {segments.map((segment, i) =>
        segment.kind === 'brief' ? (
          <Brief key={i} brief={segment.brief} />
        ) : (
          <Blocks key={i} source={segment.text} />
        ),
      )}
    </div>
  )
}

/** Headings for the contents rail. */
export function outline(source: string) {
  return marked
    .lexer(preprocess(source))
    .filter((t): t is Tokens.Heading => t.type === 'heading' && (t as Tokens.Heading).depth <= 3)
    .map((h) => ({ id: headingId(h.text), text: h.text, depth: h.depth }))
}
