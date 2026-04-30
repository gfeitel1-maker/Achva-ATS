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
  const [tab, setTab] = useState('general')
  const [spokeId, setSpokeId] = useState(null)

  useEffect(() => {
    supabase.from('user_spokes').select('spoke_id').single()
      .then(({ data }) => { if (data) setSpokeId(data.spoke_id) })
  }, [])

  const tabs = [
    { id: 'general',     label: 'General' },
    { id: 'interest',    label: 'Interest Form' },
    { id: 'application', label: 'Application' },
    { id: 'reference',   label: 'Reference Check' },
    { id: 'documents',   label: 'Documents' },
    { id: 'contracts',   label: 'Contracts' },
  ]

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage your organization, hiring cycles, and forms.</p>
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

      {spokeId && tab === 'general'      && <GeneralEditor        spokeId={spokeId} />}
      {spokeId && tab === 'interest'     && <InterestFormEditor   spokeId={spokeId} />}
      {spokeId && tab === 'application'  && <ApplicationEditor    spokeId={spokeId} />}
      {spokeId && tab === 'reference'    && <ReferenceEditor      spokeId={spokeId} />}
      {spokeId && tab === 'documents'    && <DocumentsEditor          spokeId={spokeId} />}
      {spokeId && tab === 'contracts'   && <ContractTemplateEditor  spokeId={spokeId} />}
      {!spokeId && <p className="text-sm text-gray-400">Loading...</p>}
    </Layout>
  )
}

// ── General Editor ────────────────────────────────────────────

function GeneralEditor({ spokeId }) {
  const [orgName, setOrgName]       = useState('')
  const [cycles, setCycles]         = useState([])
  const [newCycleName, setNewCycleName] = useState('')
  const [orgSaving, setOrgSaving]   = useState(false)
  const [orgSaved, setOrgSaved]     = useState(false)
  const [cycleSaving, setCycleSaving] = useState(false)
  const [loading, setLoading]       = useState(true)
  const [interestFormUrl, setInterestFormUrl] = useState('')

  useEffect(() => {
    setInterestFormUrl(`${window.location.origin}/apply`)
    Promise.all([
      supabase.from('spokes').select('name').eq('id', spokeId).single(),
      supabase.from('hiring_cycles').select('id, name, is_active, created_at').eq('spoke_id', spokeId).order('created_at', { ascending: false }),
    ]).then(([spokeRes, cyclesRes]) => {
      if (spokeRes.data) setOrgName(spokeRes.data.name ?? '')
      setCycles(cyclesRes.data ?? [])
      setLoading(false)
    })
  }, [spokeId])

  async function saveOrgName() {
    setOrgSaving(true)
    await supabase.from('spokes').update({ name: orgName.trim() }).eq('id', spokeId)
    setOrgSaving(false)
    setOrgSaved(true)
    setTimeout(() => setOrgSaved(false), 2000)
  }

  async function createCycle() {
    const name = newCycleName.trim()
    if (!name) return
    setCycleSaving(true)
    const { data } = await supabase
      .from('hiring_cycles')
      .insert({ spoke_id: spokeId, name, is_active: false })
      .select('id, name, is_active, created_at')
      .single()
    if (data) setCycles(prev => [data, ...prev])
    setNewCycleName('')
    setCycleSaving(false)
  }

  async function setActiveCycle(cycleId) {
    await supabase.from('hiring_cycles').update({ is_active: false }).eq('spoke_id', spokeId)
    await supabase.from('hiring_cycles').update({ is_active: true }).eq('id', cycleId)
    setCycles(prev => prev.map(c => ({ ...c, is_active: c.id === cycleId })))
  }

  const [copied, setCopied] = useState(false)
  function copyLink() {
    navigator.clipboard.writeText(interestFormUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Org name */}
      <FormSection title="Organization">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Organization name</label>
            <input
              type="text"
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              placeholder="e.g. Camp Achva"
              className={inputClass}
            />
            <p className="text-xs text-gray-400 mt-1.5">Shown in offer letters and candidate-facing emails.</p>
          </div>
          <div className="flex justify-end">
            <SaveButton saving={orgSaving} saved={orgSaved} onClick={saveOrgName} />
          </div>
        </div>
      </FormSection>

      {/* Interest form link */}
      <FormSection title="Interest form link">
        <p className="text-xs text-gray-400 mb-3">Share this link with candidates to start the application process.</p>
        <div className="flex items-center gap-2">
          <code className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 flex-1 truncate text-gray-600">
            {interestFormUrl}
          </code>
          <button onClick={copyLink}
            className="text-sm px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex-shrink-0 transition-colors">
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      </FormSection>

      {/* Hiring cycles */}
      <FormSection title="Hiring cycles">
        <p className="text-xs text-gray-400 mb-4">Only one cycle can be active at a time. The active cycle is what candidates apply to and what appears on the dashboard.</p>
        <div className="space-y-2 mb-4">
          {cycles.map(c => (
            <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-sm text-gray-800 truncate">{c.name}</span>
                {c.is_active && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100 flex-shrink-0">Active</span>
                )}
              </div>
              {!c.is_active && (
                <button onClick={() => setActiveCycle(c.id)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex-shrink-0">
                  Set active
                </button>
              )}
            </div>
          ))}
          {cycles.length === 0 && <p className="text-sm text-gray-400">No hiring cycles yet.</p>}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newCycleName}
            onChange={e => setNewCycleName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createCycle() }}
            placeholder="New cycle name (e.g. Summer 2027)"
            className={inputClass}
          />
          <button onClick={createCycle} disabled={cycleSaving || !newCycleName.trim()}
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0">
            {cycleSaving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </FormSection>

    </div>
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
  const [docs, setDocs]               = useState([])
  const [removedIds, setRemovedIds]   = useState(new Set())
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [templateUploading, setTemplateUploading] = useState({}) // { [docId]: true }
  const [templateRemoving, setTemplateRemoving]   = useState({}) // { [docId]: true }

  function loadDocs() {
    return supabase.from('documents')
      .select('id, name, description, template_file_path, template_file_name')
      .eq('spoke_id', spokeId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => { setDocs(data ?? []); setLoading(false) })
  }

  useEffect(() => { loadDocs() }, [spokeId])

  function addDoc() {
    setDocs(prev => [...prev, { id: newId(), name: '', description: '', template_file_path: null, template_file_name: null, _new: true }])
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
    loadDocs()
  }

  async function uploadTemplate(doc, file) {
    if (!file || doc._new) return
    if (file.size > 20 * 1024 * 1024) { alert('File must be under 20 MB.'); return }

    setTemplateUploading(prev => ({ ...prev, [doc.id]: true }))

    const ext      = file.name.split('.').pop()
    const path     = `${doc.id}/${Date.now()}.${ext}`

    // Remove old file if there was one
    if (doc.template_file_path) {
      await supabase.storage.from('document-templates').remove([doc.template_file_path])
    }

    const { error } = await supabase.storage
      .from('document-templates')
      .upload(path, file, { upsert: true })

    if (error) {
      alert('Upload failed. Please try again.')
      setTemplateUploading(prev => ({ ...prev, [doc.id]: false }))
      return
    }

    await supabase.from('documents')
      .update({ template_file_path: path, template_file_name: file.name })
      .eq('id', doc.id)

    setDocs(prev => prev.map(d =>
      d.id === doc.id ? { ...d, template_file_path: path, template_file_name: file.name } : d
    ))
    setTemplateUploading(prev => ({ ...prev, [doc.id]: false }))
  }

  async function removeTemplate(doc) {
    if (!doc.template_file_path) return
    setTemplateRemoving(prev => ({ ...prev, [doc.id]: true }))

    await supabase.storage.from('document-templates').remove([doc.template_file_path])
    await supabase.from('documents')
      .update({ template_file_path: null, template_file_name: null })
      .eq('id', doc.id)

    setDocs(prev => prev.map(d =>
      d.id === doc.id ? { ...d, template_file_path: null, template_file_name: null } : d
    ))
    setTemplateRemoving(prev => ({ ...prev, [doc.id]: false }))
  }

  async function downloadTemplate(doc) {
    const { data } = supabase.storage.from('document-templates').getPublicUrl(doc.template_file_path)
    window.open(data.publicUrl, '_blank')
  }

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>

  return (
    <div className="space-y-4 max-w-2xl">
      <FormSection title="Required documents">
        <p className="text-xs text-gray-400 mb-4">
          Add the documents candidates need to submit. Optionally attach a blank template file they can download, fill out, and upload.
        </p>
        <div className="space-y-5">
          {docs.map(doc => (
            <div key={doc.id} className="border border-gray-100 rounded-xl p-4 space-y-3">
              <div className="flex gap-3 items-start">
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={doc.name}
                    onChange={e => update(doc.id, 'name', e.target.value)}
                    placeholder="Document name (e.g. Medical form)"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={doc.description ?? ''}
                    onChange={e => update(doc.id, 'description', e.target.value)}
                    placeholder="Brief description shown to candidates (optional)"
                    className={`${inputClass} text-gray-500`}
                  />
                </div>
                <button onClick={() => remove(doc.id, doc._new)}
                  className="text-gray-300 hover:text-red-400 pt-2.5 flex-shrink-0 text-sm">✕</button>
              </div>

              {/* Template file section — only for saved docs */}
              {!doc._new && (
                <div className="pt-1 border-t border-gray-50">
                  <p className="text-xs font-medium text-gray-500 mb-2">Blank form template</p>
                  {doc.template_file_path ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <span className="text-xs text-gray-600 truncate">{doc.template_file_name}</span>
                      </div>
                      <button onClick={() => downloadTemplate(doc)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium flex-shrink-0">
                        Download
                      </button>
                      <label className={`text-xs text-gray-500 hover:text-gray-700 cursor-pointer flex-shrink-0 ${templateUploading[doc.id] ? 'opacity-50 pointer-events-none' : ''}`}>
                        Replace
                        <input type="file" className="hidden"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          disabled={templateUploading[doc.id]}
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadTemplate(doc, f); e.target.value = '' }} />
                      </label>
                      <button onClick={() => removeTemplate(doc)} disabled={templateRemoving[doc.id]}
                        className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 flex-shrink-0">
                        {templateRemoving[doc.id] ? '...' : 'Remove'}
                      </button>
                    </div>
                  ) : (
                    <label className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                      templateUploading[doc.id]
                        ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                    }`}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      {templateUploading[doc.id] ? 'Uploading...' : 'Upload blank template'}
                      <input type="file" className="hidden"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        disabled={templateUploading[doc.id]}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadTemplate(doc, f); e.target.value = '' }} />
                    </label>
                  )}
                  {doc._new && (
                    <p className="text-xs text-gray-400 italic">Save first to upload a template.</p>
                  )}
                </div>
              )}
              {doc._new && (
                <p className="text-xs text-gray-300 pt-1 border-t border-gray-50">Save to add a blank form template.</p>
              )}
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

// ── Contract Template Editor ──────────────────────────────────

const PLACEHOLDERS = [
  { token: '{{first_name}}', desc: 'Candidate first name' },
  { token: '{{last_name}}',  desc: 'Last name' },
  { token: '{{position}}',   desc: 'Position / role' },
  { token: '{{start_date}}', desc: 'Start date' },
  { token: '{{end_date}}',   desc: 'End date' },
  { token: '{{salary}}',     desc: 'Compensation' },
  { token: '{{org_name}}',   desc: 'Organization name' },
]

function ContractTemplateEditor({ spokeId }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading]     = useState(true)
  const [editingId, setEditingId] = useState(null)   // null = list, 'new' = new form, uuid = edit existing
  const [form, setForm]           = useState({ name: '', body_html: '' })
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [removing, setRemoving]   = useState(null)

  useEffect(() => {
    load()
  }, [spokeId])

  async function load() {
    const { data } = await supabase
      .from('contract_templates')
      .select('id, name, is_active, created_at')
      .eq('spoke_id', spokeId)
      .order('created_at', { ascending: false })
    setTemplates(data ?? [])
    setLoading(false)
  }

  function startNew() {
    setForm({ name: '', body_html: '' })
    setEditingId('new')
    setSaved(false)
  }

  async function startEdit(id) {
    const { data } = await supabase
      .from('contract_templates')
      .select('id, name, body_html')
      .eq('id', id)
      .single()
    if (data) {
      setForm({ name: data.name, body_html: data.body_html })
      setEditingId(id)
      setSaved(false)
    }
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    if (editingId === 'new') {
      const { data } = await supabase
        .from('contract_templates')
        .insert({ spoke_id: spokeId, name: form.name.trim(), body_html: form.body_html, is_active: true })
        .select('id, name, is_active, created_at')
        .single()
      if (data) setTemplates(prev => [data, ...prev])
    } else {
      await supabase
        .from('contract_templates')
        .update({ name: form.name.trim(), body_html: form.body_html, updated_at: new Date().toISOString() })
        .eq('id', editingId)
      setTemplates(prev => prev.map(t => t.id === editingId ? { ...t, name: form.name.trim() } : t))
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => { setSaved(false); setEditingId(null) }, 1200)
  }

  async function toggleActive(id, current) {
    await supabase.from('contract_templates').update({ is_active: !current }).eq('id', id)
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, is_active: !current } : t))
  }

  async function remove(id) {
    setRemoving(id)
    await supabase.from('contract_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
    setRemoving(null)
  }

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>

  // ── Edit / New form ──
  if (editingId !== null) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            {editingId === 'new' ? 'New template' : 'Edit template'}
          </h2>
          <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600">
            ← Back to templates
          </button>
        </div>

        <FormSection title="Template name">
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Summer 2025 Counselor Contract"
            className={inputClass}
            autoFocus
          />
        </FormSection>

        <FormSection title="Contract body">
          <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">Available placeholders</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {PLACEHOLDERS.map(p => (
                <span key={p.token} className="text-xs text-gray-500">
                  <code className="bg-white border border-gray-200 rounded px-1 py-0.5 text-blue-600 font-mono">
                    {p.token}
                  </code>
                  {' '}— {p.desc}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-2">
            Write the contract in HTML. Use the placeholders above — they'll be filled in with the candidate's details when you generate a contract.
          </p>
          <textarea
            value={form.body_html}
            onChange={e => setForm(f => ({ ...f, body_html: e.target.value }))}
            rows={24}
            placeholder={`<p>This agreement is entered into between <strong>{{org_name}}</strong> and <strong>{{first_name}} {{last_name}}</strong>...</p>`}
            className={`${textareaClass} font-mono text-xs resize-y`}
          />
        </FormSection>

        <div className="flex justify-end gap-3">
          <button onClick={() => setEditingId(null)}
            className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <SaveButton saving={saving} saved={saved} onClick={save} />
        </div>
      </div>
    )
  }

  // ── Template list ──
  return (
    <div className="space-y-4 max-w-2xl">
      <FormSection title="Contract templates">
        <p className="text-xs text-gray-400 mb-4">
          Templates are used to generate contracts for candidates at the Contract stage.
          Use placeholders like <code className="bg-gray-100 px-1 rounded text-blue-600">{'{{first_name}}'}</code> and <code className="bg-gray-100 px-1 rounded text-blue-600">{'{{position}}'}</code> — they're filled in automatically.
        </p>

        {templates.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No templates yet. Create one below.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {templates.map(t => (
              <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="text-sm text-gray-800 truncate">{t.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${
                    t.is_active
                      ? 'bg-green-50 text-green-700 border-green-100'
                      : 'bg-gray-50 text-gray-400 border-gray-200'
                  }`}>
                    {t.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button onClick={() => toggleActive(t.id, t.is_active)}
                    className="text-xs text-gray-400 hover:text-gray-700">
                    {t.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => startEdit(t.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                    Edit
                  </button>
                  <button onClick={() => remove(t.id)} disabled={removing === t.id}
                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50">
                    {removing === t.id ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button onClick={startNew}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          + New template
        </button>
      </FormSection>
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
