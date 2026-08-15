import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Lexer, type Token, type Tokens } from 'marked'
import { humanize } from './data'

/**
 * Inline markdown, shared by the page renderer and the brief visualiser.
 *
 * `[[wiki/people/x|label]]` is Obsidian syntax marked knows nothing about, so
 * it is rewritten to a normal link with a sentinel href before lexing and
 * turned back into a router link on the way out.
 */
export const WIKI_HREF = '#wiki:'

export function preprocess(md: string) {
  return md.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_all, target: string, label?: string) => {
    const slug = target.trim().replace(/^wiki\//, '').replace(/\.md$/, '')
    return `[${(label ?? humanize(slug)).trim()}](${WIKI_HREF}${slug})`
  })
}

const slugFromHref = (href: string) => (href.startsWith(WIKI_HREF) ? href.slice(WIKI_HREF.length) : null)

export function Inline({ tokens }: { tokens?: Token[] }): ReactNode {
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

/** A run of markdown with no block structure — a sentence, a table cell. */
export function InlineMarkdown({ text }: { text: string }) {
  return <Inline tokens={Lexer.lexInline(preprocess(text))} />
}
