import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { marked, type Token, type Tokens } from 'marked'
import { Chart } from './Chart'
import { analyzeTable, type TableData } from './table'
import { humanize } from './data'
import './markdown.css'

/**
 * `[[wiki/people/x|label]]` is Obsidian syntax marked knows nothing about, so
 * it is rewritten to a normal link with a sentinel href before lexing and
 * turned back into a router link on the way out.
 */
const WIKI_HREF = '#wiki:'

function preprocess(md: string) {
  return md.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_all, target: string, label?: string) => {
    const slug = target.trim().replace(/^wiki\//, '').replace(/\.md$/, '')
    return `[${(label ?? humanize(slug)).trim()}](${WIKI_HREF}${slug})`
  })
}

const slugFromHref = (href: string) => (href.startsWith(WIKI_HREF) ? href.slice(WIKI_HREF.length) : null)

function Inline({ tokens }: { tokens?: Token[] }): ReactNode {
  if (!tokens) return null
  return (
    <>
      {tokens.map((token, i) => {
        switch (token.type) {
          case 'text':
            return (token as Tokens.Text).tokens ? (
              <Inline key={i} tokens={(token as Tokens.Text).tokens} />
            ) : (
              <Fragment key={i}>{(token as Tokens.Text).text}</Fragment>
            )
          case 'strong':
            return (
              <strong key={i}>
                <Inline tokens={(token as Tokens.Strong).tokens} />
              </strong>
            )
          case 'em':
            return (
              <em key={i}>
                <Inline tokens={(token as Tokens.Em).tokens} />
              </em>
            )
          case 'codespan':
            return <code key={i}>{(token as Tokens.Codespan).text}</code>
          case 'br':
            return <br key={i} />
          case 'del':
            return (
              <del key={i}>
                <Inline tokens={(token as Tokens.Del).tokens} />
              </del>
            )
          case 'link': {
            const link = token as Tokens.Link
            const slug = slugFromHref(link.href)
            if (slug) {
              return (
                <Link key={i} to={`/brain/${slug}`} className="md__wikilink">
                  <Inline tokens={link.tokens} />
                </Link>
              )
            }
            return (
              <a key={i} href={link.href} target="_blank" rel="noreferrer noopener">
                <Inline tokens={link.tokens} />
              </a>
            )
          }
          default:
            return <Fragment key={i}>{'text' in token ? (token.text as string) : null}</Fragment>
        }
      })}
    </>
  )
}

const headingId = (text: string) =>
  text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'section'

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

export function Markdown({ source }: { source: string }) {
  const tokens = marked.lexer(preprocess(source))
  return (
    <div className="md">
      {tokens.map((token, i) => (
        <Block key={i} token={token} />
      ))}
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
