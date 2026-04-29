import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

const EMPTY_REF = () => ({
  reference_name: '', reference_email: '', reference_phone: '',
  reference_relationship: '', how_long_known: '',
})

const EMPTY_JOB = (subFields = {}) => {
  const obj = {}
  Object.entries(subFields).forEach(([key, cfg]) => { if (cfg.show) obj[key] = '' })
  return obj
}

const EMPTY_SCHOOL = (subFields = {}) => {
  const obj = {}
  Object.entries(subFields).forEach(([key, cfg]) => { if (cfg.show) obj[key] = '' })
  return obj
}

export default function ApplicationForm() {
  const { token } = useParams()
  const navigate  = useNavigate()

  const [appData, setAppData]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState(null)
  const [formError, setFormError] = useState(null)

  // Personal info state (used by personal_info field type)
  const [personal, setPersonal] = useState({
    first_name: '', last_name: '', email: '', phone: '', date_of_birth: '',
    address: { street: '', city: '', state: '', zip: '' },
  })
  // Dynamic field responses keyed by field.id
  const [responses, setResponses] = useState({})
  // References state (used by references field type)
  const [refs, setRefs] = useState([EMPTY_REF(), EMPTY_REF()])

  useEffect(() => {
    supabase.rpc('get_application_by_token', { p_token: token }).then(({ data, error }) => {
      if (error || !data) { setError('This link is invalid or has expired.'); setLoading(false); return }
      if (data.error === 'invalid_token')    { setError('This link is invalid or has expired.'); setLoading(false); return }
      if (data.error === 'already_submitted') { setError('This application has already been submitted.'); setLoading(false); return }

      setAppData(data)
      const c = data.candidate
      setPersonal({
        first_name:    c.first_name    ?? '',
        last_name:     c.last_name     ?? '',
        email:         c.email         ?? '',
        phone:         c.phone         ?? '',
        date_of_birth: c.date_of_birth ?? '',
        address: {
          street: c.address_street ?? '',
          city:   c.address_city   ?? '',
          state:  c.address_state  ?? '',
          zip:    c.address_zip    ?? '',
        },
      })

      // Initialize repeatable/dynamic field responses
      const init = {}
      const fields = data.application?.fields ?? []
      fields.forEach(f => {
        if (f.type === 'employment_history' || f.type === 'school_history') init[f.id] = []
        else if (f.type === 'personal_info' || f.type === 'references') { /* handled by dedicated state */ }
        else init[f.id] = ''
      })
      setResponses(init)

      // Init refs based on references field min_count
      const refField = fields.find(f => f.type === 'references')
      const minRefs = refField?.min_count ?? 2
      setRefs(Array.from({ length: minRefs }, EMPTY_REF))
      setLoading(false)
    })
  }, [token])

  function setPersonalField(key, value) {
    setPersonal(prev => ({ ...prev, [key]: value }))
  }
  function setAddress(key, value) {
    setPersonal(prev => ({ ...prev, address: { ...prev.address, [key]: value } }))
  }
  function setResponse(id, value) {
    setResponses(prev => ({ ...prev, [id]: value }))
  }

  function setRef(i, key, value) {
    setRefs(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: value } : r))
  }
  function addRef() { if (refs.length < 4) setRefs(prev => [...prev, EMPTY_REF()]) }
  function removeRef(i) { if (refs.length > 2) setRefs(prev => prev.filter((_, idx) => idx !== i)) }

  function validate() {
    const allFields = appData?.application?.fields ?? []
    const hasPersonalField = allFields.some(f => f.type === 'personal_info')
    // Always require name + email regardless
    if (!personal.first_name || !personal.last_name || !personal.email) {
      return 'Please fill out your name and email.'
    }
    for (const f of allFields) {
      if (f.type === 'personal_info' || f.type === 'references') continue
      if (!f.required) continue
      const val = responses[f.id]
      if (f.type === 'employment_history' || f.type === 'school_history') {
        if (!Array.isArray(val) || val.length === 0) return `Please add at least one entry for "${f.label}".`
      } else if (!val || String(val).trim() === '') {
        return `Please answer: "${f.label}"`
      }
    }
    const refField = allFields.find(f => f.type === 'references')
    if (refField !== undefined || !allFields.some(f => f.type === 'references') === false) {
      if (refs.some(r => !r.reference_name || !r.reference_email)) {
        return 'Each reference needs at least a name and email.'
      }
    }
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const err = validate()
    if (err) { setFormError(err); return }
    setSubmitting(true)
    setFormError(null)

    const payload = {
      ...personal,
      ...responses,
      references: refs,
    }

    const { data, error } = await supabase.rpc('submit_application', {
      p_token: token,
      p_responses: payload,
    })
    setSubmitting(false)
    if (error || data?.error) { setFormError('Something went wrong. Please try again.'); return }
    navigate('/application/success')
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading...</p>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm text-center"><p className="text-gray-600">{error}</p></div>
    </div>
  )

  const fields = [...(appData?.application?.fields ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const config  = appData?.application?.config ?? {}
  const introText = appData?.application?.intro_text

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">{appData?.org_name ?? 'Camp Achva'}</h1>
          <p className="text-gray-400 text-sm mt-1">Staff Application</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">

          {introText && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
              <p className="text-blue-900 text-sm leading-relaxed">{introText}</p>
            </div>
          )}

          {/* All fields rendered dynamically */}
          {fields.map(f => (
            <DynamicField
              key={f.id}
              field={f}
              value={responses[f.id]}
              onChange={v => setResponse(f.id, v)}
              personal={personal}
              setPersonalField={setPersonalField}
              setAddress={setAddress}
              refs={refs}
              setRef={setRef}
              addRef={addRef}
              removeRef={removeRef}
            />
          ))}

          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 text-sm">{formError}</p>
            </div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {submitting ? 'Submitting...' : 'Submit application'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Dynamic field renderer ────────────────────────────────────

function DynamicField({ field, value, onChange, personal, setPersonalField, setAddress, refs, setRef, addRef, removeRef }) {
  const labelText = field.required ? `${field.label} *` : field.label

  if (field.type === 'personal_info') {
    return <PersonalInfoSection field={field} personal={personal} setPersonalField={setPersonalField} setAddress={setAddress} />
  }
  if (field.type === 'references') {
    return <ReferencesSection field={field} refs={refs} setRef={setRef} addRef={addRef} removeRef={removeRef} />
  }
  if (field.type === 'employment_history') {
    return <EmploymentSection field={field} entries={value ?? []} onChange={onChange} />
  }
  if (field.type === 'school_history') {
    return <SchoolSection field={field} entries={value ?? []} onChange={onChange} />
  }

  return (
    <Section title={labelText}>
      {field.instructions && (
        <p className="text-xs text-gray-400 mb-3 -mt-2">{field.instructions}</p>
      )}
      {field.type === 'short_text' && (
        <input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)} className={inputClass} />
      )}
      {field.type === 'long_text' && (
        <textarea value={value ?? ''} onChange={e => onChange(e.target.value)} rows={4}
          className={`${inputClass} resize-none`} />
      )}
      {field.type === 'yes_no' && (
        <RadioGroup options={['Yes', 'No']} value={value} onChange={onChange} />
      )}
      {field.type === 'radio' && (
        <RadioGroup options={field.options ?? []} value={value} onChange={onChange} />
      )}
      {field.type === 'select' && (
        <select value={value ?? ''} onChange={e => onChange(e.target.value)} className={inputClass}>
          <option value="">Select an option...</option>
          {(field.options ?? []).map(opt => <option key={opt}>{opt}</option>)}
        </select>
      )}
    </Section>
  )
}

function RadioGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map(opt => (
        <label key={opt} className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
          value === opt ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:border-blue-300'
        }`}>
          <input type="radio" checked={value === opt} onChange={() => onChange(opt)} className="sr-only" />
          {opt}
        </label>
      ))}
    </div>
  )
}

// ── Personal information section ─────────────────────────────

function PersonalInfoSection({ field, personal, setPersonalField, setAddress }) {
  const sf = field.sub_fields ?? {}
  const show = (key) => sf[key]?.show !== false
  const label = (key, fallback) => (sf[key]?.required ? `${sf[key]?.label ?? fallback} *` : sf[key]?.label ?? fallback)

  return (
    <Section title={field.label || 'About you'}>
      {field.instructions && <p className="text-xs text-gray-400 -mt-2 mb-1">{field.instructions}</p>}
      <div className="grid grid-cols-2 gap-4">
        {show('first_name') && (
          <Field label={label('first_name', 'First name')}>
            <input type="text" value={personal.first_name} onChange={e => setPersonalField('first_name', e.target.value)} className={inputClass} autoComplete="given-name" />
          </Field>
        )}
        {show('last_name') && (
          <Field label={label('last_name', 'Last name')}>
            <input type="text" value={personal.last_name} onChange={e => setPersonalField('last_name', e.target.value)} className={inputClass} autoComplete="family-name" />
          </Field>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {show('email') && (
          <Field label={label('email', 'Email')}>
            <input type="email" value={personal.email} readOnly className={`${inputClass} bg-gray-50 text-gray-400`} />
          </Field>
        )}
        {show('phone') && (
          <Field label={label('phone', 'Phone')}>
            <input type="tel" value={personal.phone} onChange={e => setPersonalField('phone', e.target.value)} className={inputClass} autoComplete="tel" />
          </Field>
        )}
      </div>
      {show('date_of_birth') && (
        <Field label={label('date_of_birth', 'Date of birth')}>
          <input type="date" value={personal.date_of_birth} onChange={e => setPersonalField('date_of_birth', e.target.value)} className={`${inputClass} w-auto`} />
        </Field>
      )}
      {(show('address_street') || show('address_city') || show('address_state') || show('address_zip')) && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Address</p>
          {show('address_street') && (
            <Field label={label('address_street', 'Street')}>
              <input type="text" value={personal.address.street} onChange={e => setAddress('street', e.target.value)} className={inputClass} />
            </Field>
          )}
          <div className="grid grid-cols-3 gap-3">
            {show('address_city') && (
              <Field label={label('address_city', 'City')}>
                <input type="text" value={personal.address.city} onChange={e => setAddress('city', e.target.value)} className={inputClass} />
              </Field>
            )}
            {show('address_state') && (
              <Field label={label('address_state', 'State')}>
                <select value={personal.address.state} onChange={e => setAddress('state', e.target.value)} className={inputClass}>
                  <option value="">—</option>
                  {US_STATES.map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
            )}
            {show('address_zip') && (
              <Field label={label('address_zip', 'ZIP')}>
                <input type="text" value={personal.address.zip} onChange={e => setAddress('zip', e.target.value)} className={inputClass} maxLength={10} />
              </Field>
            )}
          </div>
        </div>
      )}
    </Section>
  )
}

// ── References section ────────────────────────────────────────

function ReferencesSection({ field, refs, setRef, addRef, removeRef }) {
  const sf  = field.sub_fields ?? {}
  const show = (key) => sf[key]?.show !== false
  const lbl  = (key, fallback) => (sf[key]?.required ? `${sf[key]?.label ?? fallback} *` : sf[key]?.label ?? fallback)
  const min  = field.min_count ?? 2
  const max  = field.max_count ?? 4
  const subtitle = `Minimum ${min}${max > min ? `, maximum ${max}` : ''}.${field.instructions ? ` ${field.instructions}` : ''}`

  return (
    <Section title={field.required ? `${field.label} *` : field.label} subtitle={subtitle}>
      <div className="space-y-4">
        {refs.map((ref, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reference {i + 1}</span>
              {refs.length > min && (
                <button type="button" onClick={() => removeRef(i)} className="text-xs text-gray-300 hover:text-red-400">Remove</button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {show('reference_name') && (
                <Field label={lbl('reference_name', 'Full name')}>
                  <input type="text" value={ref.reference_name} onChange={e => setRef(i, 'reference_name', e.target.value)} className={inputClass} />
                </Field>
              )}
              {show('reference_email') && (
                <Field label={lbl('reference_email', 'Email')}>
                  <input type="email" value={ref.reference_email} onChange={e => setRef(i, 'reference_email', e.target.value)} className={inputClass} />
                </Field>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {show('reference_phone') && (
                <Field label={lbl('reference_phone', 'Phone')}>
                  <input type="tel" value={ref.reference_phone} onChange={e => setRef(i, 'reference_phone', e.target.value)} className={inputClass} />
                </Field>
              )}
              {show('reference_relationship') && (
                <Field label={lbl('reference_relationship', 'Relationship')}>
                  <input type="text" value={ref.reference_relationship} onChange={e => setRef(i, 'reference_relationship', e.target.value)} placeholder="e.g. Former supervisor" className={inputClass} />
                </Field>
              )}
            </div>
            {show('how_long_known') && (
              <Field label={lbl('how_long_known', 'How long have you known them?')}>
                <input type="text" value={ref.how_long_known} onChange={e => setRef(i, 'how_long_known', e.target.value)} placeholder="e.g. 3 years" className={inputClass} />
              </Field>
            )}
          </div>
        ))}
        {refs.length < max && (
          <button type="button" onClick={addRef} className="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Add reference</button>
        )}
      </div>
    </Section>
  )
}

// ── Employment history repeater ───────────────────────────────

function EmploymentSection({ field, entries, onChange }) {
  const sf = field.sub_fields ?? {}

  function addEntry() {
    onChange([...entries, EMPTY_JOB(sf)])
  }
  function updateEntry(i, key, value) {
    onChange(entries.map((e, idx) => idx === i ? { ...e, [key]: value } : e))
  }
  function removeEntry(i) {
    onChange(entries.filter((_, idx) => idx !== i))
  }

  return (
    <Section title={field.required ? `${field.label} *` : field.label}
             subtitle={field.instructions}>
      <div className="space-y-4">
        {entries.map((entry, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Position {i + 1}</span>
              <button type="button" onClick={() => removeEntry(i)} className="text-xs text-gray-300 hover:text-red-400">Remove</button>
            </div>
            {sf.employer?.show && (
              <Field label={sf.employer.required ? `${sf.employer.label} *` : sf.employer.label}>
                <input type="text" value={entry.employer ?? ''} onChange={e => updateEntry(i, 'employer', e.target.value)} className={inputClass} />
              </Field>
            )}
            {sf.role?.show && (
              <Field label={sf.role.required ? `${sf.role.label} *` : sf.role.label}>
                <input type="text" value={entry.role ?? ''} onChange={e => updateEntry(i, 'role', e.target.value)} className={inputClass} />
              </Field>
            )}
            {sf.dates?.show && (
              <Field label={sf.dates.label}>
                <input type="text" value={entry.dates ?? ''} onChange={e => updateEntry(i, 'dates', e.target.value)} placeholder="e.g. June–August 2024" className={inputClass} />
              </Field>
            )}
            {sf.description?.show && (
              <Field label={sf.description.label}>
                <textarea value={entry.description ?? ''} onChange={e => updateEntry(i, 'description', e.target.value)} rows={3} className={`${inputClass} resize-none`} />
              </Field>
            )}
            {sf.supervisor_name?.show && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={sf.supervisor_name.label}>
                  <input type="text" value={entry.supervisor_name ?? ''} onChange={e => updateEntry(i, 'supervisor_name', e.target.value)} className={inputClass} />
                </Field>
                {sf.supervisor_contact?.show && (
                  <Field label={sf.supervisor_contact.label}>
                    <input type="text" value={entry.supervisor_contact ?? ''} onChange={e => updateEntry(i, 'supervisor_contact', e.target.value)} className={inputClass} />
                  </Field>
                )}
              </div>
            )}
            {sf.may_contact?.show && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">{sf.may_contact.label}</p>
                <RadioGroup options={['Yes', 'No']} value={entry.may_contact} onChange={v => updateEntry(i, 'may_contact', v)} />
              </div>
            )}
            {sf.address?.show && (
              <Field label={sf.address.label}>
                <input type="text" value={entry.address ?? ''} onChange={e => updateEntry(i, 'address', e.target.value)} className={inputClass} />
              </Field>
            )}
          </div>
        ))}
        <button type="button" onClick={addEntry} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          + Add position
        </button>
      </div>
    </Section>
  )
}

// ── School history repeater ───────────────────────────────────

function SchoolSection({ field, entries, onChange }) {
  const sf = field.sub_fields ?? {}

  function addEntry() {
    onChange([...entries, EMPTY_SCHOOL(sf)])
  }
  function updateEntry(i, key, value) {
    onChange(entries.map((e, idx) => idx === i ? { ...e, [key]: value } : e))
  }
  function removeEntry(i) {
    onChange(entries.filter((_, idx) => idx !== i))
  }

  return (
    <Section title={field.required ? `${field.label} *` : field.label}
             subtitle={field.instructions}>
      <div className="space-y-4">
        {entries.map((entry, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">School {i + 1}</span>
              <button type="button" onClick={() => removeEntry(i)} className="text-xs text-gray-300 hover:text-red-400">Remove</button>
            </div>
            {sf.name?.show && (
              <Field label={sf.name.required ? `${sf.name.label} *` : sf.name.label}>
                <input type="text" value={entry.name ?? ''} onChange={e => updateEntry(i, 'name', e.target.value)} className={inputClass} />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              {sf.program?.show && (
                <Field label={sf.program.label}>
                  <input type="text" value={entry.program ?? ''} onChange={e => updateEntry(i, 'program', e.target.value)} placeholder="e.g. B.A. Education" className={inputClass} />
                </Field>
              )}
              {sf.dates?.show && (
                <Field label={sf.dates.label}>
                  <input type="text" value={entry.dates ?? ''} onChange={e => updateEntry(i, 'dates', e.target.value)} placeholder="e.g. 2020–2024" className={inputClass} />
                </Field>
              )}
            </div>
            {sf.graduated?.show && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">{sf.graduated.label}</p>
                <RadioGroup options={['Yes', 'No', 'In progress']} value={entry.graduated} onChange={v => updateEntry(i, 'graduated', v)} />
              </div>
            )}
            {sf.address?.show && (
              <Field label={sf.address.label}>
                <input type="text" value={entry.address ?? ''} onChange={e => updateEntry(i, 'address', e.target.value)} className={inputClass} />
              </Field>
            )}
          </div>
        ))}
        <button type="button" onClick={addEntry} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          + Add school
        </button>
      </div>
    </Section>
  )
}

// ── Shared components ─────────────────────────────────────────

function Section({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
