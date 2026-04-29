import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

// ── Helpers ───────────────────────────────────────────────────

function newId() {
  return crypto.randomUUID()
}

function moveItem(arr, index, dir) {
  const next = index + dir
  if (next < 0 || next >= arr.length) return arr
  const out = [...arr]
  ;[out[index], out[next]] = [out[next], out[index]]
  return out.map((item, i) => ({ ...item, order: i + 1 }))
}

// ── Top-level page ────────────────────────────────────────────

export default function Settings() {
  const [tab, setTab] = useState('interest')
  const [spokeId, setSpokeId] = useState(null)

  useEffect(() => {
    supabase.from('user_spokes').select('spoke_id').single()
      .then(({ data }) => { if (data) setSpokeId(data.spoke_id) })
  }, [])

  const tabs = [
    { id: 'interest',   label: 'Interest Form' },
    { id: 'application', label: 'Application' },
    { id: 'reference',  label: 'Reference Check' },
    { id: 'documents',  label: 'Documents' },
  ]

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Forms</h1>
        <p className="text-sm text-gray-400 mt-0.5">Edit the forms candidates see during the hiring process.</p>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {spokeId && tab === 'interest'     && <InterestFormEditor   spokeId={spokeId} />}
      {spokeId && tab === 'application'  && <ApplicationEditor    spokeId={spokeId} />}
      {spokeId && tab === 'reference'    && <ReferenceEditor      spokeId={spokeId} />}
      {spokeId && tab === 'documents'    && <DocumentsEditor      spokeId={spokeId} />}
      {!spokeId && <p className="text-sm text-gray-400">Loading...</p>}
    </Layout>
  )
}

// ── Interest Form Editor ──────────────────────────────────────

function InterestFormEditor({ spokeId }) {
  const [formId, setFormId]       = useState(null)
  const [introText, setIntroText] = useState('')
  const [questions, setQuestions] = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  useEffect(() => {
    supabase.from('interest_forms')
      .select('id, intro_text, questions')
      .eq('spoke_id', spokeId)
      .eq('is_active', true)
      .single()
      .then(({ data }) => {
        if (data) {
          setFormId(data.id)
          setIntroText(data.intro_text ?? '')
          const qs = [...(data.questions ?? [])].sort((a, b) => a.order - b.order)
          setQuestions(qs)
        }
        setLoading(false)
      })
  }, [spokeId])

  function addQuestion() {
    setQuestions(prev => [...prev, {
      id: newId(), statement: '', response_type: 'agree_disagree', order: prev.length + 1,
    }])
  }

  function updateStatement(id, value) {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, statement: value } : q))
  }

  function removeQuestion(id) {
    setQuestions(prev => prev.filter(q => q.id !== id).map((q, i) => ({ ...q, order: i + 1 })))
  }

  function move(index, dir) {
    setQuestions(prev => moveItem(prev, index, dir))
  }

  async function save() {
    if (!formId) return
    setSaving(true)
    await supabase.from('interest_forms')
      .update({ intro_text: introText, questions })
      .eq('id', formId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>
  if (!formId) return <p className="text-sm text-gray-400">No active interest form found for this account.</p>

  return (
    <div className="space-y-5 max-w-2xl">
      <FormSection title="Introduction">
        <p className="text-xs text-gray-400 mb-3">Shown at the top of the interest form in a blue box.</p>
        <textarea
          value={introText}
          onChange={e => setIntroText(e.target.value)}
          rows={4}
          placeholder="Tell candidates what this form is for and what to expect..."
          className={textareaClass}
        />
      </FormSection>

      <FormSection title="Questions">
        <p className="text-xs text-gray-400 mb-4">
          Candidates respond to each statement with Agree, Neither, or Disagree.
        </p>
        <div className="space-y-3">
          {questions.map((q, i) => (
            <div key={q.id} className="flex gap-2 items-start">
              <div className="flex flex-col gap-0.5 pt-2 flex-shrink-0">
                <button onClick={() => move(i, -1)} disabled={i === 0}
                  className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none">▲</button>
                <button onClick={() => move(i, 1)} disabled={i === questions.length - 1}
                  className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none">▼</button>
              </div>
              <span className="text-xs text-gray-300 font-medium pt-2.5 flex-shrink-0 w-5">{i + 1}.</span>
              <textarea
                value={q.statement}
                onChange={e => updateStatement(q.id, e.target.value)}
                rows={2}
                placeholder="Enter a statement candidates will respond to..."
                className={`${textareaClass} flex-1 resize-none`}
              />
              <button onClick={() => removeQuestion(q.id)}
                className="text-gray-300 hover:text-red-400 pt-2.5 flex-shrink-0 text-sm">✕</button>
            </div>
          ))}
        </div>
        <button onClick={addQuestion}
          className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium">
          + Add question
        </button>
      </FormSection>

      <div className="flex justify-end">
        <SaveButton saving={saving} saved={saved} onClick={save} />
      </div>
    </div>
  )
}

// ── Application Editor ────────────────────────────────────────

const FIELD_TYPE_OPTIONS = [
  { value: 'short_text',         label: 'Short answer' },
  { value: 'long_text',          label: 'Long answer' },
  { value: 'yes_no',             label: 'Yes / No' },
  { value: 'radio',              label: 'Multiple choice' },
  { value: 'select',             label: 'Dropdown' },
  { value: 'school_history',     label: 'Education history' },
  { value: 'employment_history', label: 'Employment history' },
  { value: 'personal_info',      label: 'Personal information' },
  { value: 'references',         label: 'References' },
]

const PERSONAL_INFO_SUB_FIELDS = [
  { key: 'first_name',     defaultLabel: 'First name',     alwaysOn: true },
  { key: 'last_name',      defaultLabel: 'Last name',      alwaysOn: true },
  { key: 'email',          defaultLabel: 'Email',          alwaysOn: true },
  { key: 'phone',          defaultLabel: 'Phone number',   alwaysOn: false },
  { key: 'date_of_birth',  defaultLabel: 'Date of birth',  alwaysOn: false },
  { key: 'address_street', defaultLabel: 'Street address', alwaysOn: false },
  { key: 'address_city',   defaultLabel: 'City',           alwaysOn: false },
  { key: 'address_state',  defaultLabel: 'State',          alwaysOn: false },
  { key: 'address_zip',    defaultLabel: 'ZIP code',       alwaysOn: false },
]

const REFERENCES_SUB_FIELDS = [
  { key: 'reference_name',         defaultLabel: 'Full name',                 alwaysOn: true },
  { key: 'reference_email',        defaultLabel: 'Email',                     alwaysOn: true },
  { key: 'reference_phone',        defaultLabel: 'Phone',                     alwaysOn: false },
  { key: 'reference_relationship', defaultLabel: 'Relationship to you',       alwaysOn: false },
  { key: 'how_long_known',         defaultLabel: 'How long have you known them?', alwaysOn: false },
]

const EMPLOYMENT_SUB_FIELDS = [
  { key: 'employer',           defaultLabel: 'Employer name',                    alwaysOn: true },
  { key: 'role',               defaultLabel: 'Job title',                        alwaysOn: true },
  { key: 'dates',              defaultLabel: 'Dates (e.g. June–August 2024)',    alwaysOn: false },
  { key: 'description',        defaultLabel: 'Brief description of responsibilities', alwaysOn: false },
  { key: 'supervisor_name',    defaultLabel: 'Supervisor name',                  alwaysOn: false },
  { key: 'may_contact',        defaultLabel: 'May we contact this employer?',    alwaysOn: false },
  { key: 'supervisor_contact', defaultLabel: 'Supervisor email or phone',        alwaysOn: false },
  { key: 'address',            defaultLabel: 'Employer address',                 alwaysOn: false },
]

const SCHOOL_SUB_FIELDS = [
  { key: 'name',      defaultLabel: 'School name',          alwaysOn: true },
  { key: 'dates',     defaultLabel: 'Dates attended',       alwaysOn: false },
  { key: 'program',   defaultLabel: 'Degree or program',    alwaysOn: false },
  { key: 'graduated', defaultLabel: 'Graduated?',           alwaysOn: false },
  { key: 'address',   defaultLabel: 'School address',       alwaysOn: false },
]

function defaultSubFields(defs) {
  const sf = {}
  defs.forEach(d => {
    sf[d.key] = { show: d.alwaysOn, required: d.alwaysOn, label: d.defaultLabel }
  })
  return sf
}

const SUB_FIELD_DEFS = {
  personal_info:      PERSONAL_INFO_SUB_FIELDS,
  references:         REFERENCES_SUB_FIELDS,
  employment_history: EMPLOYMENT_SUB_FIELDS,
  school_history:     SCHOOL_SUB_FIELDS,
}

function newField(type) {
  const base = { id: newId(), type, label: '', instructions: '', required: false, order: 0 }
  if (SUB_FIELD_DEFS[type]) return { ...base, label: defaultLabelFor(type), sub_fields: defaultSubFields(SUB_FIELD_DEFS[type]), ...(type === 'references' ? { min_count: 2, max_count: 4 } : {}) }
  if (type === 'radio' || type === 'select') return { ...base, options: [] }
  return base
}

function defaultLabelFor(type) {
  return { personal_info: 'About you', references: 'References', employment_history: 'Employment history', school_history: 'Education history' }[type] ?? ''
}

function ApplicationEditor({ spokeId }) {
  const [appId, setAppId]         = useState(null)
  const [introText, setIntroText] = useState('')
  const [fields, setFields]       = useState([])
  const [addType, setAddType]     = useState('short_text')
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  useEffect(() => {
    supabase.from('applications')
      .select('id, intro_text, fields')
      .eq('spoke_id', spokeId)
      .eq('is_active', true)
      .single()
      .then(({ data }) => {
        if (data) {
          setAppId(data.id)
          setIntroText(data.intro_text ?? '')
          const fs = [...(data.fields ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          setFields(fs)
        }
        setLoading(false)
      })
  }, [spokeId])

  function addField() {
    const f = newField(addType)
    setFields(prev => [...prev, { ...f, order: prev.length + 1 }])
  }

  function updateField(id, key, value) {
    setFields(prev => prev.map(f => f.id === id ? { ...f, [key]: value } : f))
  }

  function updateSubField(fieldId, subKey, prop, value) {
    setFields(prev => prev.map(f => {
      if (f.id !== fieldId) return f
      return {
        ...f,
        sub_fields: {
          ...f.sub_fields,
          [subKey]: { ...f.sub_fields[subKey], [prop]: value },
        },
      }
    }))
  }

  function removeField(id) {
    setFields(prev => prev.filter(f => f.id !== id).map((f, i) => ({ ...f, order: i + 1 })))
  }

  function move(index, dir) {
    setFields(prev => moveItem(prev, index, dir))
  }

  async function save() {
    if (!appId) return
    setSaving(true)
    const ordered = fields.map((f, i) => ({ ...f, order: i + 1 }))
    await supabase.from('applications')
      .update({ intro_text: introText, fields: ordered })
      .eq('id', appId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>
  if (!appId)  return <p className="text-sm text-gray-400">No active application found. Run application_builder.sql first.</p>

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Intro text */}
      <FormSection title="Introduction">
        <p className="text-xs text-gray-400 mb-3">Optional message shown at the top of the application.</p>
        <textarea value={introText} onChange={e => setIntroText(e.target.value)} rows={3}
          placeholder="Welcome message or instructions for applicants..."
          className={textareaClass} />
      </FormSection>

      {/* Dynamic fields */}
      {fields.map((f, i) => (
        <AppFieldCard
          key={f.id}
          field={f}
          index={i}
          total={fields.length}
          onMove={move}
          onUpdate={updateField}
          onUpdateSubField={updateSubField}
          onRemove={removeField}
        />
      ))}

      {/* Add field */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
        <select value={addType} onChange={e => setAddType(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          {FIELD_TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button onClick={addField}
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex-shrink-0">
          + Add field
        </button>
      </div>

      <div className="flex justify-end">
        <SaveButton saving={saving} saved={saved} onClick={save} />
      </div>
    </div>
  )
}


function AppFieldCard({ field, index, total, onMove, onUpdate, onUpdateSubField, onRemove }) {
  const [open, setOpen] = useState(true)
  const isStructured = !!SUB_FIELD_DEFS[field.type]
  const subFieldDefs = SUB_FIELD_DEFS[field.type] ?? []
  const typeLabel = FIELD_TYPE_OPTIONS.find(t => t.value === field.type)?.label ?? field.type

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <button onClick={() => onMove(index, -1)} disabled={index === 0}
            className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-xs">▲</button>
          <button onClick={() => onMove(index, 1)} disabled={index === total - 1}
            className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-xs">▼</button>
        </div>
        <span className="text-xs text-gray-300 w-5 flex-shrink-0">{index + 1}.</span>
        <input
          type="text"
          value={field.label}
          onChange={e => onUpdate(field.id, 'label', e.target.value)}
          placeholder="Question or field label..."
          className="flex-1 text-sm font-medium text-gray-800 border-0 focus:outline-none bg-transparent placeholder:text-gray-300"
        />
        <span className="text-xs text-gray-400 flex-shrink-0 px-2 py-1 bg-gray-100 rounded-md">{typeLabel}</span>
        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer flex-shrink-0">
          <input type="checkbox" checked={field.required ?? false}
            onChange={e => onUpdate(field.id, 'required', e.target.checked)} className="accent-blue-600" />
          Required
        </label>
        <button onClick={() => setOpen(v => !v)} className="text-gray-300 hover:text-gray-600 text-sm flex-shrink-0">
          {open ? '−' : '+'}
        </button>
        <button onClick={() => onRemove(field.id)} className="text-gray-300 hover:text-red-400 flex-shrink-0">✕</button>
      </div>

      {open && (
        <div className="px-5 py-4 space-y-4">
          {/* Instructions */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Instructions (optional)</label>
            <input type="text" value={field.instructions ?? ''}
              onChange={e => onUpdate(field.id, 'instructions', e.target.value)}
              placeholder="Add a hint or clarification shown below the label..."
              className={`${inputClass} text-sm`} />
          </div>

          {/* Radio/select options */}
          {(field.type === 'radio' || field.type === 'select') && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Options (one per line)</label>
              <textarea
                value={(field.options ?? []).join('\n')}
                onChange={e => {
                  const options = e.target.value.split('\n').map(s => s.trim()).filter(Boolean)
                  onUpdate(field.id, 'options', options)
                }}
                rows={4}
                className={`${textareaClass} resize-none text-sm`}
                placeholder={"Option 1\nOption 2\nOption 3"}
              />
            </div>
          )}

          {/* References: min/max count */}
          {field.type === 'references' && (
            <div className="flex items-center gap-6">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Minimum references</label>
                <input type="number" min={1} max={field.max_count ?? 4}
                  value={field.min_count ?? 2}
                  onChange={e => onUpdate(field.id, 'min_count', Number(e.target.value))}
                  className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Maximum references</label>
                <input type="number" min={field.min_count ?? 2} max={8}
                  value={field.max_count ?? 4}
                  onChange={e => onUpdate(field.id, 'max_count', Number(e.target.value))}
                  className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}

          {/* Structured sub-fields */}
          {isStructured && (
            <div>
              <label className="block text-xs text-gray-500 mb-2">Fields to collect</label>
              <div className="space-y-2">
                {subFieldDefs.map(def => {
                  const sf = field.sub_fields?.[def.key] ?? { show: def.alwaysOn, required: def.alwaysOn, label: def.defaultLabel }
                  return (
                    <div key={def.key} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                      <Toggle
                        value={sf.show || def.alwaysOn}
                        onChange={v => { if (!def.alwaysOn) onUpdateSubField(field.id, def.key, 'show', v) }}
                      />
                      <input
                        type="text"
                        value={sf.label}
                        onChange={e => onUpdateSubField(field.id, def.key, 'label', e.target.value)}
                        disabled={!sf.show && !def.alwaysOn}
                        className="flex-1 text-sm border-0 focus:outline-none bg-transparent text-gray-700 placeholder:text-gray-300 disabled:text-gray-300"
                      />
                      {!def.alwaysOn && (sf.show || def.alwaysOn) && (
                        <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer flex-shrink-0">
                          <input type="checkbox" checked={sf.required ?? false}
                            onChange={e => onUpdateSubField(field.id, def.key, 'required', e.target.checked)}
                            className="accent-blue-600" />
                          Req.
                        </label>
                      )}
                      {def.alwaysOn && <span className="text-xs text-gray-300 flex-shrink-0">Always on</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Reference Check Editor ────────────────────────────────────

const QUESTION_TYPES = [
  { value: 'text',     label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'select',   label: 'Multiple choice' },
]

function ReferenceEditor({ spokeId }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  useEffect(() => {
    supabase.from('reference_check_templates')
      .select('questions')
      .eq('spoke_id', spokeId)
      .single()
      .then(({ data }) => {
        if (data) {
          const qs = [...(data.questions ?? [])].sort((a, b) => a.order - b.order)
          setQuestions(qs)
        }
        setLoading(false)
      })
  }, [spokeId])

  function addQuestion() {
    setQuestions(prev => [...prev, {
      id: newId(), label: '', type: 'textarea', optional: false, order: prev.length + 1,
    }])
  }

  function updateField(id, key, value) {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [key]: value } : q))
  }

  function removeQuestion(id) {
    setQuestions(prev => prev.filter(q => q.id !== id).map((q, i) => ({ ...q, order: i + 1 })))
  }

  function move(index, dir) {
    setQuestions(prev => moveItem(prev, index, dir))
  }

  function updateOptions(id, raw) {
    const options = raw.split('\n').map(s => s.trim()).filter(Boolean)
    updateField(id, 'options', options)
  }

  async function save() {
    setSaving(true)
    await supabase.from('reference_check_templates')
      .update({ questions, updated_at: new Date().toISOString() })
      .eq('spoke_id', spokeId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>

  return (
    <div className="space-y-5 max-w-2xl">
      <FormSection title="Questions">
        <p className="text-xs text-gray-400 mb-4">
          These are the questions references answer when they receive an email request.
        </p>
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={q.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex gap-2 items-start">
                <div className="flex flex-col gap-0.5 flex-shrink-0 pt-1">
                  <button onClick={() => move(i, -1)} disabled={i === 0}
                    className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-xs">▲</button>
                  <button onClick={() => move(i, 1)} disabled={i === questions.length - 1}
                    className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-xs">▼</button>
                </div>
                <span className="text-xs text-gray-300 font-medium pt-1.5 flex-shrink-0 w-5">{i + 1}.</span>
                <textarea
                  value={q.label}
                  onChange={e => updateField(q.id, 'label', e.target.value)}
                  rows={2}
                  placeholder="Question text..."
                  className={`${textareaClass} flex-1 resize-none`}
                />
                <button onClick={() => removeQuestion(q.id)}
                  className="text-gray-300 hover:text-red-400 pt-1.5 flex-shrink-0 text-sm">✕</button>
              </div>

              <div className="flex items-center gap-4 ml-7">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Type</label>
                  <select
                    value={q.type}
                    onChange={e => updateField(q.id, 'type', e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {QUESTION_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={q.optional ?? false}
                    onChange={e => updateField(q.id, 'optional', e.target.checked)}
                    className="accent-blue-600"
                  />
                  Optional
                </label>
              </div>

              {q.type === 'select' && (
                <div className="ml-7">
                  <label className="block text-xs text-gray-500 mb-1">Options (one per line)</label>
                  <textarea
                    value={(q.options ?? []).join('\n')}
                    onChange={e => updateOptions(q.id, e.target.value)}
                    rows={4}
                    className={`${textareaClass} resize-none text-xs`}
                    placeholder={"Option 1\nOption 2\nOption 3"}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <button onClick={addQuestion}
          className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium">
          + Add question
        </button>
      </FormSection>

      <div className="flex justify-end">
        <SaveButton saving={saving} saved={saved} onClick={save} />
      </div>
    </div>
  )
}

// ── Documents Editor ──────────────────────────────────────────

function DocumentsEditor({ spokeId }) {
  const [docs, setDocs]           = useState([])
  const [removedIds, setRemovedIds] = useState(new Set())
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  useEffect(() => {
    supabase.from('documents')
      .select('id, name, description')
      .eq('spoke_id', spokeId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => { setDocs(data ?? []); setLoading(false) })
  }, [spokeId])

  function addDoc() {
    setDocs(prev => [...prev, { id: newId(), name: '', description: '', _new: true }])
  }

  function update(id, key, val) {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, [key]: val } : d))
  }

  function remove(id, isNew) {
    setDocs(prev => prev.filter(d => d.id !== id))
    if (!isNew) setRemovedIds(prev => new Set([...prev, id]))
  }

  async function save() {
    setSaving(true)
    const valid = docs.filter(d => d.name.trim())

    for (const id of removedIds) {
      await supabase.from('documents').update({ is_active: false }).eq('id', id)
    }

    const newDocs = valid.filter(d => d._new)
    if (newDocs.length) {
      await supabase.from('documents').insert(
        newDocs.map(d => ({ id: d.id, spoke_id: spokeId, name: d.name.trim(), description: d.description?.trim() || null, is_active: true }))
      )
    }

    for (const d of valid.filter(d => !d._new)) {
      await supabase.from('documents').update({ name: d.name.trim(), description: d.description?.trim() || null }).eq('id', d.id)
    }

    setRemovedIds(new Set())
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    supabase.from('documents').select('id, name, description').eq('spoke_id', spokeId).eq('is_active', true).order('name')
      .then(({ data }) => setDocs(data ?? []))
  }

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>

  return (
    <div className="space-y-4 max-w-2xl">
      <FormSection title="Required documents">
        <p className="text-xs text-gray-400 mb-4">
          These documents are tracked for every candidate. Hiring managers mark them received from the candidate's Documents tab.
        </p>
        <div className="space-y-4">
          {docs.map(doc => (
            <div key={doc.id} className="flex gap-3 items-start">
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={doc.name}
                  onChange={e => update(doc.id, 'name', e.target.value)}
                  placeholder="Document name (e.g. Signed contract)"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={doc.description ?? ''}
                  onChange={e => update(doc.id, 'description', e.target.value)}
                  placeholder="Brief description (optional)"
                  className={`${inputClass} text-gray-500`}
                />
              </div>
              <button onClick={() => remove(doc.id, doc._new)}
                className="text-gray-300 hover:text-red-400 pt-2.5 flex-shrink-0 text-sm">✕</button>
            </div>
          ))}
        </div>
        <button onClick={addDoc} className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium">
          + Add document
        </button>
      </FormSection>

      <div className="flex justify-end">
        <SaveButton saving={saving} saved={saved} onClick={save} />
      </div>
    </div>
  )
}

// ── Shared components ─────────────────────────────────────────

function FormSection({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">{title}</h2>
      {children}
    </div>
  )
}

function Toggle({ value, onChange, labels = ['Off', 'On'] }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
        value ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
        value ? 'translate-x-4' : 'translate-x-0.5'
      }`} />
    </button>
  )
}

function SaveButton({ saving, saved, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className={`text-sm px-5 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 ${
        saved
          ? 'bg-green-600 text-white'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      }`}
    >
      {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
    </button>
  )
}

const inputClass    = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const textareaClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
