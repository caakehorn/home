import { useMemo, useRef, useState } from 'react'
import { useShell } from '../../shell/context'
import {
  clearContacts,
  findContacts,
  loadContacts,
  parseContacts,
  saveContacts,
  type Contact,
} from './contacts'
import './imessage.css'

/**
 * The address book, beside the terminal.
 *
 * It exists to answer one question — "what is their number?" — without sending
 * the reader to the Contacts app and back with a string in their head. Drop a
 * file in, type two letters of a name, and the handle goes into the terminal as
 * the answer to whatever it is currently asking.
 *
 * ---- said on the panel, not in a footnote ----------------------------------
 *
 * Every claim this room makes about privacy is printed here, next to the drop
 * zone, before the file is chosen rather than after. There is no server behind
 * this site; the file is read in the page and kept in this browser. That is
 * worth stating at the moment of decision, because "we don't upload it" is
 * exactly the kind of thing a person is entitled to be told before they hand
 * over their address book rather than in a paragraph they will not scroll to.
 *
 * ---- the name travels with the handle --------------------------------------
 *
 * Picking a contact writes `Name <handle>` as the answer rather than the bare
 * handle. It reads correctly in the terminal echo, and it means `compose` can
 * stamp the name onto the export's rows while remaining a pure function of the
 * answers — the panel never reaches into the plan, and nothing about the
 * deliverable depends on state the build gate cannot reproduce.
 */
export function Panels() {
  const shell = useShell()
  const [contacts, setContacts] = useState<Contact[]>(() => loadContacts())
  const [query, setQuery] = useState('')
  const [over, setOver] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)

  const hits = useMemo(() => findContacts(contacts, query), [contacts, query])

  const take = async (file: File | null | undefined) => {
    if (!file) return
    setProblem(null)
    try {
      const text = await file.text()
      const result = parseContacts(file.name, text)
      if (!result.contacts.length) {
        setProblem(
          `Nothing usable in ${file.name}. Export from Google Contacts as CSV, or from the ` +
            'Mac Contacts app as a vCard.',
        )
        return
      }
      setContacts(result.contacts)
      if (!saveContacts(result.contacts)) {
        setProblem(
          `${result.contacts.length} loaded, but too large for this browser to remember. ` +
            'They will work now and be gone on reload.',
        )
      }
      const kind = result.format === 'vcard' ? 'vCard' : 'Google CSV'
      setLoaded(
        `${result.contacts.length} contacts from ${kind}` +
          (result.skipped ? ` · ${result.skipped} had no name or no number` : ''),
      )
      shell.say('ok', `  ✓ address book loaded — ${result.contacts.length} contacts, in this browser only`)
    } catch {
      setProblem(`Could not read ${file.name}.`)
    }
    // Reset the picker so choosing the same file twice fires onChange again.
    if (picker.current) picker.current.value = ''
  }

  const use = (contact: Contact, handle: string) => {
    const step = shell.waitingOn
    if (step !== 'handle') {
      shell.say('err', '  the terminal is not asking for a number right now.')
      return
    }
    shell.answer('handle', `${contact.name} <${handle}>`)
  }

  const forget = () => {
    clearContacts()
    setContacts([])
    setLoaded(null)
    setQuery('')
    shell.say('ok', '  ✓ address book forgotten.')
  }

  return (
    <div className="im">
      <div className="im__head">
        <span>ADDRESS BOOK</span>
        {contacts.length > 0 && (
          <button type="button" className="im__forget" onClick={forget}>
            FORGET
          </button>
        )}
      </div>

      {problem && (
        <p className="im__problem" role="status">
          {problem}
        </p>
      )}

      {/* The two branches below each hold an <input> in a similar slot, and
          without distinct keys React can reconcile the file picker into the
          search box when the first file lands — which turns an uncontrolled
          input into a controlled one and warns. Keys keep them separate
          elements, which is what they are. */}
      {contacts.length === 0 ? (
        <>
          <label
            className={`im__drop${over ? ' im__drop--over' : ''}`}
            htmlFor="im-contacts"
            onDragOver={(e) => {
              e.preventDefault()
              setOver(true)
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(false)
              void take(e.dataTransfer.files?.[0])
            }}
          >
            <span className="im__drop-mark" aria-hidden="true">
              ⇥
            </span>
            <b>Drop your contacts here</b>
            <span>
              Google Contacts <code>.csv</code> or Mac Contacts <code>.vcf</code>
            </span>
            <span className="im__drop-or">or click to choose a file</span>
          </label>
          <input
            key="im-picker"
            ref={picker}
            id="im-contacts"
            type="file"
            accept=".csv,.vcf,text/csv,text/vcard,text/x-vcard"
            className="im__file"
            onChange={(e) => void take(e.target.files?.[0])}
          />
          <p className="im__privacy">
            <b>This file does not leave your browser.</b> There is no server behind this site to
            send it to. It is read on this page, kept in this browser only, and FORGET removes it.
          </p>
        </>
      ) : (
        <>
          <p className="im__loaded">{loaded ?? `${contacts.length} contacts, in this browser`}</p>
          <input
            key="im-search"
            className="im__search"
            value={query}
            placeholder="find a name or a number"
            spellCheck={false}
            autoComplete="off"
            aria-label="Search contacts"
            onChange={(e) => setQuery(e.target.value)}
          />

          {query && !hits.length && <p className="im__none">No contact matches that.</p>}

          <ul className="im__hits">
            {hits.map((c) => (
              <li key={c.name + c.handles[0]}>
                <span className="im__hit-name">{c.name}</span>
                {c.handles.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className="im__hit"
                    onClick={() => use(c, h)}
                    disabled={shell.waitingOn !== 'handle'}
                    title={
                      shell.waitingOn === 'handle'
                        ? `use ${h}`
                        : 'the terminal is not asking for a number right now'
                    }
                  >
                    {h}
                  </button>
                ))}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
