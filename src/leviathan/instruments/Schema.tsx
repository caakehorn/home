import { Frame } from '../Frame'
import { useSet, type Instrument, type WikiSet } from '../core'

/**
 * ◈ WIKI XVII · THE SCHEMA
 *
 * The shape of the metadata rather than the prose: which front-matter fields
 * are filled in, on how many pages, and how the eleven page types are spread.
 *
 * ---- absence is the subject, so nothing is inferred into it ----------------
 *
 * A field counted here is a field with a value on that page. An empty string,
 * a null and a missing key are all *not filled in*, and none of them is
 * guessed at from elsewhere — a page whose `date_range_end` is absent does not
 * get one from its last edit, and a page with no `title` in front-matter is not
 * given the one in its heading. The absence is the measurement.
 *
 * "Where the record is thin" is the old console's phrase for the bottom of the
 * first list, and it is not repeated on the instrument. A field on 2% of pages
 * might be under-used or might be a field that only applies to 2% of pages.
 * `dui` is a tag on two pages and that is not a documentation failure.
 */
export function Schema({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<WikiSet>('wiki.json')

  if (loading)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">reading the front-matter…</p>
      </Frame>
    )

  if (error || !data)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">
          The dataset is missing ({error}). Run <code>npm run wiki-instruments</code> and rebuild.
        </p>
      </Frame>
    )

  const { schema } = data
  const typePeak = Math.max(...schema.types.map((t) => t.count))
  const perPeak = Math.max(...schema.byDomain.map((d) => d.per))
  const universal = schema.fields.filter((f) => f.count === data.counts.pages)

  return (
    <Frame
      instrument={instrument}
      footer={
        <p className="inst__method">
          <b>ABSENCE IS THE SUBJECT, SO NOTHING IS INFERRED INTO IT</b> A field counted here has a
          value on that page. An empty string, a null and a missing key are all <i>not filled in</i>
          , and none is guessed at from elsewhere: a page with no <code>date_range_end</code> does
          not get one from its last edit, and a page with no front-matter <code>title</code> is not
          given the one in its heading. The old console called the bottom of this list &ldquo;where
          the record is thin&rdquo;; that phrase is not repeated here, because a field on 2% of
          pages might be under-used or might be a field that only applies to 2% of pages.
        </p>
      }
    >
      <div className="pt-split pt-split--wide">
        <div className="pt-stack">
          <h3 className="pt-sub">EVERY FIELD · HOW MANY PAGES CARRY IT</h3>
          <ol className="pt-rows" style={{ ['--pt-label' as string]: '10rem' }}>
            {schema.fields.map((field) => (
              <li key={field.field} className="pt-row" style={{ ['--pt-label' as string]: '10rem' }}>
                <span className="pt-label">{field.field}</span>
                <span className="pt-bar">
                  <span
                    className={`pt-fill${field.count === data.counts.pages ? '' : ' pt-fill--alt'}`}
                    style={{ inlineSize: `${field.share * 100}%` }}
                  />
                </span>
                <span className="pt-value">
                  {field.count} · {Math.round(field.share * 100)}%
                </span>
              </li>
            ))}
          </ol>
          <p className="pt-note">
            {universal.length} of {schema.fields.length} fields are on every page:{' '}
            {universal.map((f) => f.field).join(', ')}. Those are the schema; everything below them
            is optional and used at whatever rate it is used.
          </p>
        </div>

        <div className="pt-stack">
          <h3 className="pt-sub">PAGE TYPES</h3>
          <ol className="pt-rows" style={{ ['--pt-label' as string]: '6rem' }}>
            {schema.types.map((row) => (
              <li key={row.type} className="pt-row" style={{ ['--pt-label' as string]: '6rem' }}>
                <span className="pt-label">{row.type}</span>
                <span className="pt-bar">
                  <span className="pt-fill" style={{ inlineSize: `${(row.count / typePeak) * 100}%` }} />
                </span>
                <span className="pt-value">{row.count}</span>
              </li>
            ))}
          </ol>

          <h3 className="pt-sub">FIELDS FILLED IN, PER PAGE, BY DOMAIN</h3>
          <ol className="pt-rows" style={{ ['--pt-label' as string]: '6rem' }}>
            {[...schema.byDomain]
              .sort((a, b) => b.per - a.per)
              .map((row) => (
                <li key={row.id} className="pt-row" style={{ ['--pt-label' as string]: '6rem' }}>
                  <span className="pt-label">{row.id}</span>
                  <span className="pt-bar">
                    <span
                      className="pt-fill pt-fill--alt"
                      style={{ inlineSize: `${(row.per / perPeak) * 100}%` }}
                    />
                  </span>
                  <span className="pt-value">{row.per.toFixed(1)}</span>
                </li>
              ))}
          </ol>
          <p className="pt-note">
            The mean number of filled fields on a page in each domain. A domain of eleven index
            pages and a domain of a hundred-and-sixty profiles are not the same kind of object, and
            the difference between their means is mostly that rather than care taken.
          </p>

          <dl className="pt-facts">
            <dt>DISTINCT FIELDS</dt>
            <dd>{schema.fields.length} across the corpus</dd>
            <dt>ON EVERY PAGE</dt>
            <dd>{universal.length}</dd>
            <dt>PAGE TYPES</dt>
            <dd>{schema.types.length}</dd>
            <dt>RAREST FIELD</dt>
            <dd>
              {schema.fields[schema.fields.length - 1]?.field} · on{' '}
              {schema.fields[schema.fields.length - 1]?.count} page
              {schema.fields[schema.fields.length - 1]?.count === 1 ? '' : 's'}
            </dd>
          </dl>
        </div>
      </div>
    </Frame>
  )
}
