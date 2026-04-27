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

const EMPTY_JOB = () => ({
  employer: '', role: '', dates: '', description: '',
})

export default function ApplicationForm() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [appData, setAppData] = useState(null)  // { candidate, application }
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [formError, setFormError] = useState(null)

  // Form state
  const [fields, setFields] = useState({
    first_name: '', last_name: '', email: '', phone: '', date_of_birth: '',
    address: { street: '', city: '', state: '', zip: '' },
    current_school: '', availability: '',
  })
  const [jobs, setJobs] = useState([])
  const [refs, setRefs] = useState([EMPTY_REF(), EMPTY_REF()])

  useEffect(() => {
    supabase.rpc('get_application_by_token', { p_token: token }).then(({ data, error }) => {
      if (error || !data) { setError('This link is invalid or has expired.'); setLoading(false); return }
      if (data.error === 'invalid_token') { setError('This link is invalid or has expired.'); setLoading(false); return }
      if (data.error === 'already_submitted') { setError('This application has already been submitted.'); setLoading(false); return }

      setAppData(data)
      const c = data.candidate
      setFields({
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
        current_school: '',
        availability:   '',
      })
      setLoading(false)
    })
  }, [token])

  function setField(key, value) {
    setFields(prev => ({ ...prev, [key]: value }))
  }

  function setAddress(key, value) {
    setFields(prev => ({ ...prev, address: { ...prev.address, [key]: value } }))
  }

  function setRef(index, key, value) {
    setRefs(prev => prev.map((r, i) => i === index ? { ...r, [key]: value } : r))
  }

  function addRef() {
    if (refs.length < 4) setRefs(prev => [...prev, EMPTY_REF()])
  }

  function removeRef(index) {
    if (refs.length > 2) setRefs(prev => prev.filter((_, i) => i !== index))
  }

  function setJob(index, key, value) {
    setJobs(prev => prev.map((j, i) => i === index ? { ...j, [key]: value } : j))
  }

  function addJob() {
    setJobs(prev => [...prev, EMPTY_JOB()])
  }

  function removeJob(index) {
    setJobs(prev => prev.filter((_, i) => i !== index))
  }

  function validate() {
    const { first_name, last_name, email, availability } = fields
    if (!first_name || !last_name || !email) return 'Please fill out your name and email.'
    if (!availability.trim()) return 'Please describe your summer availability.'
    const incompleteRef = refs.find(r => !r.reference_name || !r.reference_email)
    if (incompleteRef) return 'Each reference needs at least a name and email.'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const err = validate()
    if (err) { setFormError(err); return }

    setSubmitting(true)
    setFormError(null)

    const responses = {
      ...fields,
      employment_history: jobs,
      references: refs,
    }

    const { data, error } = await supabase.rpc('submit_application', {
      p_token: token,
      p_responses: responses,
    })

    setSubmitting(false)

    if (error || data?.error) {
      setFormError('Something went wrong. Please try again.')
      return
    }

    navigate('/application/success')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Camp Achva</h1>
          <p className="text-gray-400 text-sm mt-1">Staff Application</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">

          {/* Personal info */}
          <Section title="About you">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First name">
                <input type="text" value={fields.first_name} onChange={e => setField('first_name', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Last name">
                <input type="text" value={fields.last_name} onChange={e => setField('last_name', e.target.value)} className={inputClass} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email">
                <input type="email" value={fields.email} readOnly className={`${inputClass} bg-gray-50 text-gray-400`} />
              </Field>
              <Field label="Phone">
                <input type="tel" value={fields.phone} onChange={e => setField('phone', e.target.value)} className={inputClass} />
              </Field>
            </div>
            <Field label="Date of birth">
              <input type="date" value={fields.date_of_birth} onChange={e => setField('date_of_birth', e.target.value)} className={`${inputClass} w-auto`} />
            </Field>
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Address</p>
              <Field label="Street">
                <input type="text" value={fields.address.street} onChange={e => setAddress('street', e.target.value)} className={inputClass} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="City" className="col-span-1">
                  <input type="text" value={fields.address.city} onChange={e => setAddress('city', e.target.value)} className={inputClass} />
                </Field>
                <Field label="State">
                  <select value={fields.address.state} onChange={e => setAddress('state', e.target.value)} className={inputClass}>
                    <option value="">—</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="ZIP">
                  <input type="text" value={fields.address.zip} onChange={e => setAddress('zip', e.target.value)} className={inputClass} maxLength={10} />
                </Field>
              </div>
            </div>
          </Section>

          {/* Background */}
          <Section title="Background">
            <Field label="Current school (if applicable)">
              <input type="text" value={fields.current_school} onChange={e => setField('current_school', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Summer availability *">
              <textarea
                value={fields.availability}
                onChange={e => setField('availability', e.target.value)}
                rows={3}
                placeholder="e.g. Available June 15 – August 20, full-time..."
                className={`${inputClass} resize-none`}
              />
            </Field>
          </Section>

          {/* Employment history */}
          <Section title="Employment history" subtitle="Optional — list relevant past positions.">
            <div className="space-y-4">
              {jobs.map((job, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Position {i + 1}</span>
                    <button type="button" onClick={() => removeJob(i)} className="text-xs text-gray-300 hover:text-red-400">Remove</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Employer">
                      <input type="text" value={job.employer} onChange={e => setJob(i, 'employer', e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Role">
                      <input type="text" value={job.role} onChange={e => setJob(i, 'role', e.target.value)} className={inputClass} />
                    </Field>
                  </div>
                  <Field label="Dates">
                    <input type="text" value={job.dates} onChange={e => setJob(i, 'dates', e.target.value)} placeholder="e.g. Summer 2024" className={inputClass} />
                  </Field>
                  <Field label="Brief description">
                    <textarea value={job.description} onChange={e => setJob(i, 'description', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
                  </Field>
                </div>
              ))}
              <button type="button" onClick={addJob} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                + Add position
              </button>
            </div>
          </Section>

          {/* References */}
          <Section title="References" subtitle={`Minimum 2, maximum 4. Include at least one professional reference.`}>
            <div className="space-y-4">
              {refs.map((ref, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reference {i + 1}</span>
                    {refs.length > 2 && (
                      <button type="button" onClick={() => removeRef(i)} className="text-xs text-gray-300 hover:text-red-400">Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Full name *">
                      <input type="text" value={ref.reference_name} onChange={e => setRef(i, 'reference_name', e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Email *">
                      <input type="email" value={ref.reference_email} onChange={e => setRef(i, 'reference_email', e.target.value)} className={inputClass} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Phone">
                      <input type="tel" value={ref.reference_phone} onChange={e => setRef(i, 'reference_phone', e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Relationship">
                      <input type="text" value={ref.reference_relationship} onChange={e => setRef(i, 'reference_relationship', e.target.value)} placeholder="e.g. Former supervisor" className={inputClass} />
                    </Field>
                  </div>
                  <Field label="How long have you known them?">
                    <input type="text" value={ref.how_long_known} onChange={e => setRef(i, 'how_long_known', e.target.value)} placeholder="e.g. 3 years" className={inputClass} />
                  </Field>
                </div>
              ))}
              {refs.length < 4 && (
                <button type="button" onClick={addRef} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                  + Add reference
                </button>
              )}
            </div>
          </Section>

          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 text-sm">{formError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  )
}

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
