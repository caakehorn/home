import { Link } from 'react-router-dom'
import type { WikiPage } from './data'
import { humanize } from './data'
import { getImage } from './store'
import './infobox.css'

/** Field order and labels match the wiki's own renderer, so pages read the same. */
const ORDER = [
  'name', 'born', 'dob', 'status', 'type', 'relationship', 'relationship_to_dan', 'known_for',
  'occupation', 'role', 'partner', 'parents', 'location', 'sex', 'first_mentioned', 'first_contact',
  'closed', 'handles', 'era', 'period', 'ideology', 'medication', 'outcome', 'aliases', 'notes',
]

const LABELS: Record<string, string> = {
  name: 'Name', born: 'Born', dob: 'Born', status: 'Status', type: 'Type',
  relationship: 'Relationship', relationship_to_dan: 'Relationship to Dan', known_for: 'Known for',
  occupation: 'Occupation', role: 'Role', partner: 'Partner', parents: 'Parents',
  location: 'Location', sex: 'Sex', first_mentioned: 'First mentioned',
  first_contact: 'First contact', closed: 'Closed', handles: 'Handles', era: 'Era',
  period: 'Period', ideology: 'Ideology', medication: 'Medication', outcome: 'Outcome',
  aliases: 'Also known as', notes: 'Notes',
}

const label = (key: string) => LABELS[key] ?? key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

/** `[a, b]` YAML-ish inline lists render as a comma list, not raw brackets. */
function splitValue(value: string): string[] {
  const trimmed = value.trim()
  if (/^\[.*\]$/.test(trimmed)) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
  }
  return [trimmed]
}

/** Values may contain [[wiki links]]; keep them clickable inside the box. */
function Value({ text }: { text: string }) {
  const parts = text.split(/(\[\[[^\]]+\]\])/g)
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[\[([^\]|]+)(?:\|([^\]]*))?\]\]$/)
        if (!m) return <span key={i}>{part}</span>
        const slug = m[1].trim().replace(/^wiki\//, '').replace(/\.md$/, '')
        return (
          <Link key={i} to={`/brain/${slug}`} className="ib__link">
            {(m[2] ?? humanize(slug)).trim()}
          </Link>
        )
      })}
    </>
  )
}

/**
 * Resolve an `image:` frontmatter value. Pictures uploaded through the editor
 * are stored in this browser under an `upload:<id>` handle; anything else is
 * treated as a URL.
 */
export function resolveImage(value: string | undefined): string | null {
  if (!value) return null
  if (value.startsWith('upload:')) return getImage(value.slice(7))
  if (/^(https?:|data:)/.test(value)) return value
  return null
}

export function Infobox({ page }: { page: WikiPage }) {
  const box = page.infobox
  const image = resolveImage(page.meta.image)
  if (!box && !image) return null

  const keys = box
    ? [
        ...ORDER.filter((k) => k !== 'name' && box[k]),
        ...Object.keys(box).filter((k) => k !== 'name' && !ORDER.includes(k) && box[k]),
      ]
    : []

  return (
    <aside className="ib" aria-label={`${page.title} summary`}>
      <div className="ib__head">{box?.name || page.title}</div>

      {image && (
        <figure className="ib__figure">
          <img className="ib__img" src={image} alt={box?.name || page.title} loading="lazy" />
          {page.meta.image_caption && <figcaption className="ib__caption">{page.meta.image_caption}</figcaption>}
        </figure>
      )}

      {keys.length > 0 && (
        <table className="ib__table">
          <tbody>
            {keys.map((key) => {
              const values = splitValue(box![key])
              return (
                <tr key={key}>
                  <th scope="row">{label(key)}</th>
                  <td>
                    {values.map((v, i) => (
                      <span key={i}>
                        {i > 0 && ', '}
                        <Value text={v} />
                      </span>
                    ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </aside>
  )
}
