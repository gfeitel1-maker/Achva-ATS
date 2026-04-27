import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import StageBadge from '../components/StageBadge'
import { STAGES, STAGE_FLOW, nextStage, prevStage, isTerminal, daysInStage, getInitials } from '../lib/stages'

const RESPONSE_LABELS = {
  agree:    'Agree',
  neither:  'Neither agree nor disagree',
  disagree: 'Disagree',
}

function buildOfferLetterHtml({ candidateName, positionTitle, startDate, salary, orgName }) {
  const today        = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const formattedStart = new Date(startDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return `<div style="font-family:Georgia,serif;color:#111;line-height:1.75;font-size:15px">
  <p style="color:#999;font-size:13px;margin:0 0 28px">${today}</p>
  <p style="margin:0 0 20px">Dear ${candidateName},</p>
  <p style="margin:0 0 16px">We are pleased to offer you the position of <strong>${positionTitle}</strong> with <strong>${orgName}</strong> for the upcoming season.</p>
  <table style="margin:24px 0;border-collapse:collapse;width:100%;font-size:14px">
    <tr><td style="padding:10px 32px 10px 0;font-weight:bold;color:#666;white-space:nowrap;vertical-align:top;letter-spacing:.05em;font-size:12px">POSITION</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0">${positionTitle}</td></tr>
    <tr><td style="padding:10px 32px 10px 0;font-weight:bold;color:#666;white-space:nowrap;vertical-align:top;letter-spacing:.05em;font-size:12px">START DATE</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0">${formattedStart}</td></tr>
    <tr><td style="padding:10px 32px 10px 0;font-weight:bold;color:#666;white-space:nowrap;vertical-align:top;letter-spacing:.05em;font-size:12px">COMPENSATION</td><td style="padding:10px 0">${salary}</td></tr>
  </table>
  <p style="margin:0 0 16px">This offer is contingent upon satisfactory completion of all required documentation as part of ${orgName}'s onboarding process.</p>
  <p style="margin:0 0 40px">We are so excited to have you joining the team this season and look forward to your response.</p>
  <p style="margin:0 0 4px">Warm regards,</p>
  <p style="margin:0;font-weight:bold">${orgName} Hiring Team</p>
</div>`
}

export default function CandidateDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [record, setRecord]         = useState(null)
  const [submission, setSubmission] = useState(null)
  const [appSub, setAppSub]         = useState(null)
  const [refs, setRefs]             = useState([])
  const [notes, setNotes]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [copied, setCopied]         = useState(false)
  const [sendingRef, setSendingRef] = useState(null)
  const [activeTab, setActiveTab]   = useState('Application')

  // Offer state
  const [offer, setOffer]               = useState(null)
  const [offerForm, setOfferForm]       = useState({ position_title: '', start_date: '', salary: '' })
  const [positionMode, setPositionMode] = useState('applied')
  const [offerSaving, setOfferSaving]   = useState(false)
  const [editingOffer, setEditingOffer] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody]       = useState('')
  const [templateSaving, setTemplateSaving] = useState(false)
  const [sendingOffer, setSendingOffer]     = useState(false)

  const [editingPosition, setEditingPosition] = useState(false)
  const [positionValue, setPositionValue]     = useState('')

  const [showNoteForm, setShowNoteForm] = useState(false)
  const [noteText, setNoteText]         = useState('')
  const [noteDate, setNoteDate]         = useState(new Date().toISOString().slice(0, 10))
  const [noteSaving, setNoteSaving]     = useState(false)

  // Load core record data
  useEffect(() => {
    async function load() {
      const [recordRes, subRes, appRes, refsRes, notesRes] = await Promise.all([
        supabase.from('pipeline_records')
          .select('*, candidates(*), hiring_cycles(name, spoke_id, spokes(name))')
          .eq('id', id).single(),
        supabase.from('interest_form_submissions')
          .select('responses, interest_forms(questions)').eq('pipeline_record_id', id).maybeSingle(),
        supabase.from('application_submissions')
          .select('responses, submitted_at').eq('pipeline_record_id', id).maybeSingle(),
        supabase.from('references').select('id, reference_name, reference_email, reference_phone, reference_relationship, how_long_known, response_received_at, email_sent_at, response, reference_token').eq('pipeline_record_id', id).order('created_at'),
        supabase.from('interview_notes').select('*').eq('pipeline_record_id', id).order('created_at', { ascending: false }),
      ])
      if (recordRes.data) { setRecord(recordRes.data); setPositionValue(recordRes.data.position ?? '') }
      setSubmission(subRes.data ?? null)
      setAppSub(appRes.data ?? null)
      setRefs(refsRes.data ?? [])
      setNotes(notesRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  // Load offer + email template when at offer/hired stage
  useEffect(() => {
    if (!record) return
    const stage = record.current_stage
    if (!['offer', 'hired'].includes(stage)) return

    async function loadOfferData() {
      const spokeId = record.hiring_cycles?.spoke_id
      const [offerRes, templateRes] = await Promise.all([
        supabase.from('offers').select('*').eq('pipeline_record_id', id).maybeSingle(),
        spokeId
          ? supabase.from('offer_email_templates').select('*').eq('spoke_id', spokeId).maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      const offerData = offerRes.data ?? null
      setOffer(offerData)

      if (offerData) {
        setOfferForm({
          position_title: offerData.position_title,
          start_date:     offerData.start_date,
          salary:         offerData.salary,
        })
        setPositionMode(offerData.position_title === record.position ? 'applied' : 'custom')
      } else {
        setOfferForm({ position_title: record.position ?? '', start_date: '', salary: '' })
        setPositionMode(record.position ? 'applied' : 'custom')
      }

      // Store raw template with placeholders — substitution happens at send time
      const tmpl = templateRes.data
      setEmailSubject(tmpl?.subject ?? 'Your offer — {{org_name}}')
      setEmailBody(tmpl?.body ?? 'Hi {{first_name}},\n\nWe\'re excited to extend this offer to you. Please review the letter below.\n\nWarm regards,\n{{org_name}} Hiring Team')
    }
    loadOfferData()
  }, [record?.current_stage, id])

  function substituted(text) {
    const orgName   = record?.hiring_cycles?.spokes?.name ?? 'Camp'
    const firstName = record?.candidates?.first_name ?? ''
    return text.replace(/{{first_name}}/g, firstName).replace(/{{org_name}}/g, orgName)
  }

  async function moveStage(newStage) {
    setSaving(true)
    const now     = new Date().toISOString()
    const updates = { current_stage: newStage, stage_entered_at: now }
    const token   = newStage === 'application' ? crypto.randomUUID() : undefined
    if (token) updates.application_token = token

    const { error } = await supabase.from('pipeline_records').update(updates).eq('id', id)
    if (!error) {
      setRecord(prev => ({ ...prev, ...updates }))
      if (newStage === 'offer')  setActiveTab('Offer')
      if (token) {
        const link = `${window.location.origin}/application/${token}`
        await supabase.functions.invoke('send-application-email', {
          body: {
            candidate_name:   `${record.candidates.first_name} ${record.candidates.last_name}`,
            candidate_email:  record.candidates.email,
            application_link: link,
          },
        })
      }
    }
    setSaving(false)
  }

  async function savePosition() {
    const { error } = await supabase.from('pipeline_records').update({ position: positionValue }).eq('id', id)
    if (!error) { setRecord(prev => ({ ...prev, position: positionValue })); setEditingPosition(false) }
  }

  async function addNote(e) {
    e.preventDefault()
    if (!noteText.trim()) return
    setNoteSaving(true)
    const { data, error } = await supabase
      .from('interview_notes')
      .insert({ pipeline_record_id: id, notes: noteText.trim(), interview_date: noteDate || null, created_by: user.id })
      .select().single()
    if (!error && data) { setNotes(prev => [data, ...prev]); setNoteText(''); setShowNoteForm(false) }
    setNoteSaving(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/application/${record.application_token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function sendReferenceRequest(ref) {
    setSendingRef(ref.id)
    const orgName = record.hiring_cycles?.spokes?.name ?? 'Camp'
    const link = `${window.location.origin}/reference/${ref.reference_token}`
    const { error } = await supabase.functions.invoke('send-reference-email', {
      body: {
        reference_name:  ref.reference_name,
        reference_email: ref.reference_email,
        candidate_name:  `${c.first_name} ${c.last_name}`,
        org_name:        orgName,
        reference_link:  link,
      },
    })
    if (!error) {
      const now = new Date().toISOString()
      await supabase.from('references').update({ email_sent_at: now }).eq('id', ref.id)
      setRefs(prev => prev.map(r => r.id === ref.id ? { ...r, email_sent_at: now } : r))
    }
    setSendingRef(null)
  }

  async function generateOffer() {
    setOfferSaving(true)
    const orgName        = record.hiring_cycles?.spokes?.name ?? 'Camp'
    const candidateName  = `${record.candidates?.first_name} ${record.candidates?.last_name}`
    const html           = buildOfferLetterHtml({ candidateName, orgName, ...offerForm })
    const spokeId        = record.hiring_cycles?.spoke_id

    const { data, error } = await supabase
      .from('offers')
      .upsert({
        pipeline_record_id: id,
        spoke_id:           spokeId,
        position_title:     offerForm.position_title,
        start_date:         offerForm.start_date,
        salary:             offerForm.salary,
        offer_letter_html:  html,
        status:             'draft',
        updated_at:         new Date().toISOString(),
      }, { onConflict: 'pipeline_record_id' })
      .select().single()

    if (!error && data) { setOffer(data); setEditingOffer(false) }
    setOfferSaving(false)
  }

  async function saveEmailTemplate() {
    setTemplateSaving(true)
    const spokeId = record.hiring_cycles?.spoke_id
    await supabase
      .from('offer_email_templates')
      .upsert({ spoke_id: spokeId, subject: emailSubject, body: emailBody, updated_at: new Date().toISOString() }, { onConflict: 'spoke_id' })
    setTemplateSaving(false)
  }

  async function sendOffer() {
    setSendingOffer(true)
    const { error } = await supabase.functions.invoke('send-offer-email', {
      body: {
        to_email:          record.candidates?.email,
        subject:           substituted(emailSubject),
        email_body:        substituted(emailBody),
        offer_letter_html: offer.offer_letter_html,
      },
    })
    if (!error) {
      const { data } = await supabase
        .from('offers')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', offer.id)
        .select().single()
      if (data) setOffer(data)
    }
    setSendingOffer(false)
  }

  if (loading) return <Layout><div className="py-20 text-center text-gray-400 text-sm">Loading...</div></Layout>
  if (!record)  return <Layout><div className="py-20 text-center text-gray-400 text-sm">Candidate not found.</div></Layout>

  const c             = record.candidates
  const stage         = record.current_stage
  const days          = daysInStage(record.stage_entered_at)
  const forward       = nextStage(stage)
  const back          = prevStage(stage)
  const terminal      = isTerminal(stage)
  const hired         = stage === 'hired'
  const waitingForApp = stage === 'application' && !appSub
  const currentOrder  = STAGES[stage]?.order ?? 0
  const questions     = [...(submission?.interest_forms?.questions ?? [])].sort((a, b) => a.order - b.order)
  const showOfferTab  = ['offer', 'hired'].includes(stage)
  const tabs          = showOfferTab
    ? ['Offer', 'Application', 'References', 'Notes', 'Documents']
    : ['Application', 'References', 'Notes', 'Documents']

  return (
    <Layout>
      <div className="mb-5">
        <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
          ← Dashboard
        </button>
      </div>

      <div className="flex gap-5 items-start">

        {/* ── SIDEBAR ── */}
        <div className="w-56 flex-shrink-0 space-y-3">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg mb-2">
                {getInitials(c?.first_name, c?.last_name)}
              </div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">{c?.first_name} {c?.last_name}</h1>
              {record.is_returning_staff && (
                <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full mt-1.5">returning</span>
              )}
            </div>

            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Stage</span>
              <StageBadge stage={stage} />
            </div>
            <p className="text-xs text-gray-300 text-right mb-3">{days}d · {record.hiring_cycles?.name}</p>

            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Position</span>
                {!editingPosition && (
                  <button onClick={() => setEditingPosition(true)} className="text-xs text-gray-300 hover:text-blue-500">edit</button>
                )}
              </div>
              {editingPosition ? (
                <div className="space-y-1.5">
                  <input type="text" value={positionValue} onChange={e => setPositionValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') savePosition() }}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
                  <div className="flex gap-2">
                    <button onClick={savePosition} className="text-xs text-blue-600 font-medium">Save</button>
                    <button onClick={() => { setEditingPosition(false); setPositionValue(record.position ?? '') }} className="text-xs text-gray-400">Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-900">{record.position || <span className="text-gray-300 text-sm">—</span>}</p>
              )}
            </div>

            <div className="pt-3 mt-3 border-t border-gray-100 space-y-1">
              <a href={`mailto:${c?.email}`} className="text-xs text-blue-600 hover:underline block truncate">{c?.email}</a>
              {c?.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
            </div>
          </div>

          {/* Stage action */}
          {!terminal && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              {hired ? (
                <div>
                  <p className="text-sm font-semibold text-green-700 mb-2">Hired!</p>
                  <button onClick={() => moveStage('offer')} disabled={saving} className="text-xs text-gray-400 hover:text-gray-600">← Back to offer</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {forward && (
                    <button onClick={() => moveStage(forward)} disabled={saving}
                      className="w-full text-sm bg-blue-600 text-white px-3 py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors text-left">
                      {saving ? 'Saving...' : `Move to ${STAGES[forward]?.label} →`}
                    </button>
                  )}
                  <div className="flex items-center justify-between">
                    {back ? (
                      <button onClick={() => moveStage(back)} disabled={saving} className="text-xs text-gray-400 hover:text-gray-600">← {STAGES[back]?.label}</button>
                    ) : <span />}
                    <button onClick={() => moveStage('not_advancing')} disabled={saving} className="text-xs text-red-400 hover:text-red-600">Not hiring</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {terminal && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-sm font-medium text-gray-500">{STAGES[stage]?.label}</p>
              <p className="text-xs text-gray-400 mt-1">No longer active.</p>
            </div>
          )}

          {/* Progress tracker */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Progress</p>
            <div className="space-y-2.5">
              {STAGE_FLOW.map((s, i) => {
                const sOrder  = STAGES[s]?.order ?? 0
                const done    = sOrder < currentOrder
                const current = s === stage
                return (
                  <div key={s} className="flex items-center gap-2.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      done ? 'bg-blue-600 text-white' : current ? 'ring-2 ring-blue-500 bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span className={`text-sm ${current ? 'font-semibold text-blue-600' : done ? 'text-gray-500' : 'text-gray-300'}`}>
                      {STAGES[s]?.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 min-w-0">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200 mb-4">
            {tabs.map(tab => {
              let badge = null
              if (tab === 'References' && refs.length > 0) badge = refs.length
              if (tab === 'Notes' && notes.length > 0) badge = notes.length
              return (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 -mb-px ${
                    activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}>
                  {tab}
                  {badge != null && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === tab ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                      {badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* ── OFFER TAB ── */}
          {activeTab === 'Offer' && (
            <div className="space-y-4">
              {!offer || editingOffer ? (
                /* Offer form */
                <Section title={editingOffer ? 'Edit offer details' : 'Create offer'}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Hire for</label>
                        {record.position ? (
                          <div className="space-y-2">
                            <select
                              value={positionMode}
                              onChange={e => {
                                setPositionMode(e.target.value)
                                if (e.target.value === 'applied') {
                                  setOfferForm(p => ({ ...p, position_title: record.position }))
                                } else {
                                  setOfferForm(p => ({ ...p, position_title: '' }))
                                }
                              }}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="applied">{record.position}</option>
                              <option value="custom">Different position...</option>
                            </select>
                            {positionMode === 'custom' && (
                              <input type="text" value={offerForm.position_title}
                                onChange={e => setOfferForm(p => ({ ...p, position_title: e.target.value }))}
                                placeholder="Enter position title"
                                autoFocus
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            )}
                          </div>
                        ) : (
                          <input type="text" value={offerForm.position_title}
                            onChange={e => setOfferForm(p => ({ ...p, position_title: e.target.value }))}
                            placeholder="e.g. Senior Counselor"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Start date</label>
                        <input type="date" value={offerForm.start_date}
                          onChange={e => setOfferForm(p => ({ ...p, start_date: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Compensation</label>
                        <input type="text" value={offerForm.salary}
                          onChange={e => setOfferForm(p => ({ ...p, salary: e.target.value }))}
                          placeholder="e.g. $500/week"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={generateOffer}
                        disabled={offerSaving || !offerForm.position_title || !offerForm.start_date || !offerForm.salary}
                        className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        {offerSaving ? 'Generating...' : 'Generate offer letter'}
                      </button>
                      {editingOffer && (
                        <button onClick={() => setEditingOffer(false)} className="text-sm text-gray-400 hover:text-gray-700 px-3 py-2">Cancel</button>
                      )}
                    </div>
                  </div>
                </Section>
              ) : (
                <>
                  {/* Offer status */}
                  {offer.status === 'sent' && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                      <div className="w-7 h-7 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-green-800">Offer sent</p>
                        {offer.sent_at && (
                          <p className="text-xs text-green-600 mt-0.5">
                            {new Date(offer.sent_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                      <button onClick={() => setEditingOffer(true)} className="ml-auto text-xs text-green-600 hover:text-green-800">Edit & resend</button>
                    </div>
                  )}

                  {/* Offer letter preview */}
                  <Section title="Offer letter">
                    <div className="flex justify-end mb-4">
                      <button onClick={() => setEditingOffer(true)} className="text-xs text-gray-400 hover:text-blue-600">Edit details</button>
                    </div>
                    <div
                      className="border border-gray-100 rounded-lg p-6 bg-gray-50"
                      dangerouslySetInnerHTML={{ __html: offer.offer_letter_html }}
                    />
                  </Section>

                  {/* Email template — only show if not yet sent, or always for resend */}
                  {offer.status !== 'sent' && (
                    <Section title="Email to candidate">
                      <p className="text-xs text-gray-400 mb-4">
                        Use <code className="bg-gray-100 px-1 rounded">{'{{first_name}}'}</code> and <code className="bg-gray-100 px-1 rounded">{'{{org_name}}'}</code> as placeholders — they'll be filled in automatically.
                      </p>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">Subject</label>
                          <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">Message</label>
                          <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={7}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <button onClick={saveEmailTemplate} disabled={templateSaving}
                            className="text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2">
                            {templateSaving ? 'Saving...' : 'Save as default email'}
                          </button>
                          <button onClick={sendOffer} disabled={sendingOffer}
                            className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                            {sendingOffer ? 'Sending...' : 'Send offer →'}
                          </button>
                        </div>
                      </div>
                    </Section>
                  )}

                  {/* Resend button if already sent */}
                  {offer.status === 'sent' && (
                    <Section title="Email to candidate">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">Subject</label>
                          <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">Message</label>
                          <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={6}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <button onClick={saveEmailTemplate} disabled={templateSaving}
                            className="text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2">
                            {templateSaving ? 'Saving...' : 'Save as default email'}
                          </button>
                          <button onClick={sendOffer} disabled={sendingOffer}
                            className="text-sm bg-gray-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
                            {sendingOffer ? 'Sending...' : 'Resend offer →'}
                          </button>
                        </div>
                      </div>
                    </Section>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── APPLICATION TAB ── */}
          {activeTab === 'Application' && (
            <div className="space-y-4">
              <Section title="Personal information">
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <InfoField label="Full name" value={`${c?.first_name ?? ''} ${c?.last_name ?? ''}`.trim()} />
                  <InfoField label="Email" value={c?.email} />
                  {c?.phone && <InfoField label="Phone" value={c.phone} />}
                  {c?.date_of_birth && (
                    <InfoField label="Date of birth" value={new Date(c.date_of_birth + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />
                  )}
                  {appSub?.responses?.address && (
                    <InfoField label="Address" value={[
                      appSub.responses.address.street, appSub.responses.address.city,
                      appSub.responses.address.state, appSub.responses.address.zip,
                    ].filter(Boolean).join(', ')} />
                  )}
                </div>
              </Section>

              {(record.position || appSub) && (
                <Section title="Applying for">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    {record.position && <InfoField label="Position" value={record.position} />}
                    {appSub?.responses?.availability && <InfoField label="Availability" value={appSub.responses.availability} />}
                    {appSub?.responses?.current_school && <InfoField label="School" value={appSub.responses.current_school} />}
                  </div>
                </Section>
              )}

              {Array.isArray(appSub?.responses?.employment_history) && appSub.responses.employment_history.length > 0 && (
                <Section title="Employment history">
                  <div className="space-y-3">
                    {appSub.responses.employment_history.map((job, i) => (
                      <div key={i} className="border border-gray-100 rounded-lg p-4">
                        <p className="text-sm font-semibold text-gray-900">{job.role}{job.employer ? ` — ${job.employer}` : ''}</p>
                        {job.dates && <p className="text-xs text-gray-400 mt-0.5">{job.dates}</p>}
                        {job.description && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{job.description}</p>}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {!appSub && stage === 'application' && record.application_token && (
                <Section title="Application link">
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 flex-1 truncate text-gray-600">
                      {window.location.origin}/application/{record.application_token}
                    </code>
                    <button onClick={copyLink} className="text-sm px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex-shrink-0 transition-colors">
                      {copied ? 'Copied!' : 'Copy link'}
                    </button>
                  </div>
                </Section>
              )}

              {!appSub && stage !== 'application' && (
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
                  <p className="text-sm text-gray-400">No application submitted yet.</p>
                </div>
              )}
            </div>
          )}

          {/* ── REFERENCES TAB ── */}
          {activeTab === 'References' && (
            <div className="space-y-3">
              {refs.length === 0 ? (
                <EmptyState text="No references on file for this candidate." />
              ) : (
                refs.map(ref => (
                  <div key={ref.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Header */}
                    <div className="p-5 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{ref.reference_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{[ref.reference_relationship, ref.how_long_known].filter(Boolean).join(' · ')}</p>
                        <p className="text-xs text-gray-500 mt-1">{[ref.reference_email, ref.reference_phone].filter(Boolean).join(' · ')}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {ref.response_received_at ? (
                          <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-50 text-green-700">Responded</span>
                        ) : ref.email_sent_at ? (
                          <span className="text-xs px-2 py-1 rounded-full font-medium bg-amber-50 text-amber-600">Awaiting response</span>
                        ) : (
                          <button
                            onClick={() => sendReferenceRequest(ref)}
                            disabled={sendingRef === ref.id}
                            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {sendingRef === ref.id ? 'Sending...' : 'Send request'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Email sent date */}
                    {ref.email_sent_at && !ref.response_received_at && (
                      <div className="px-5 pb-4">
                        <p className="text-xs text-gray-300">
                          Request sent {new Date(ref.email_sent_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          {' · '}
                          <button
                            onClick={() => sendReferenceRequest(ref)}
                            disabled={sendingRef === ref.id}
                            className="text-blue-500 hover:text-blue-700 disabled:opacity-50"
                          >
                            {sendingRef === ref.id ? 'Sending...' : 'Resend'}
                          </button>
                        </p>
                      </div>
                    )}

                    {/* Response */}
                    {ref.response && ref.response_received_at && (
                      <div className="border-t border-gray-100 px-5 py-5 space-y-4">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                          Response · {new Date(ref.response_received_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                        {[
                          { id: 'capacity',    label: 'How they know the candidate' },
                          { id: 'recommend',   label: 'Recommendation' },
                          { id: 'character',   label: 'Character & work ethic' },
                          { id: 'youth',       label: 'With young people' },
                          { id: 'challenge',   label: 'Handling responsibility' },
                          { id: 'anything_else', label: 'Anything else' },
                        ].map(({ id, label }) => ref.response[id] ? (
                          <div key={id}>
                            <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
                            <p className={`text-sm leading-relaxed ${id === 'recommend' ? 'font-semibold text-gray-800' : 'text-gray-700'}`}>
                              {ref.response[id]}
                            </p>
                          </div>
                        ) : null)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── NOTES TAB ── */}
          {activeTab === 'Notes' && (
            <div>
              <div className="flex justify-end mb-3">
                {!showNoteForm && (
                  <button onClick={() => setShowNoteForm(true)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Add note</button>
                )}
              </div>
              {showNoteForm && (
                <form onSubmit={addNote} className="mb-4 bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Interview date</label>
                    <input type="date" value={noteDate} onChange={e => setNoteDate(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                    <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={4}
                      placeholder="Enter interview notes..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" autoFocus />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={noteSaving || !noteText.trim()}
                      className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      {noteSaving ? 'Saving...' : 'Save note'}
                    </button>
                    <button type="button" onClick={() => { setShowNoteForm(false); setNoteText('') }} className="text-sm text-gray-400 hover:text-gray-700">Cancel</button>
                  </div>
                </form>
              )}
              {notes.length === 0 && !showNoteForm
                ? <EmptyState text="No notes yet." action={{ label: '+ Add first note', onClick: () => setShowNoteForm(true) }} />
                : (
                  <div className="space-y-3">
                    {notes.map(note => (
                      <div key={note.id} className="bg-white rounded-xl border border-gray-200 p-5">
                        {note.interview_date && (
                          <p className="text-xs font-medium text-gray-400 mb-2">
                            {new Date(note.interview_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{note.notes}</p>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}

          {/* ── DOCUMENTS TAB ── */}
          {activeTab === 'Documents' && (
            <div className="space-y-3">
              <DocCard title="Interest Form" available={questions.length > 0}>
                {questions.length > 0 ? (
                  <div className="space-y-4">
                    {questions.map((q, i) => {
                      const r = submission?.responses?.[q.id]
                      return (
                        <div key={q.id} className="flex gap-3">
                          <span className="text-gray-300 text-sm font-medium mt-0.5 flex-shrink-0 w-4">{i + 1}.</span>
                          <div>
                            <p className="text-sm text-gray-700 leading-relaxed">{q.statement}</p>
                            <p className={`text-sm font-semibold mt-1 ${r === 'agree' ? 'text-green-600' : r === 'disagree' ? 'text-red-500' : 'text-gray-400'}`}>
                              {RESPONSE_LABELS[r] ?? '—'}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No interest form on file.</p>
                )}
              </DocCard>

              <DocCard title="Application" available={!!appSub}>
                {appSub ? (
                  <div className="space-y-4">
                    {appSub.responses?.availability && <InfoField label="Availability" value={appSub.responses.availability} />}
                    {appSub.responses?.current_school && <InfoField label="School" value={appSub.responses.current_school} />}
                    {Array.isArray(appSub.responses?.employment_history) && appSub.responses.employment_history.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Employment history</p>
                        <div className="space-y-2">
                          {appSub.responses.employment_history.map((job, i) => (
                            <div key={i} className="border border-gray-100 rounded-lg p-3">
                              <p className="text-sm font-semibold text-gray-900">{job.role}{job.employer ? ` — ${job.employer}` : ''}</p>
                              {job.dates && <p className="text-xs text-gray-400 mt-0.5">{job.dates}</p>}
                              {job.description && <p className="text-sm text-gray-600 mt-1 leading-relaxed">{job.description}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {appSub.submitted_at && (
                      <p className="text-xs text-gray-300">
                        Submitted {new Date(appSub.submitted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No application submitted yet.</p>
                )}
              </DocCard>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">{title}</h2>
      {children}
    </div>
  )
}

function InfoField({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-900">{value || '—'}</p>
    </div>
  )
}

function DocCard({ title, available, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${available ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
            {available ? 'On file' : 'Pending'}
          </span>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-6 pb-6 border-t border-gray-100 pt-5">{children}</div>}
    </div>
  )
}

function EmptyState({ text, action }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
      <p className="text-sm text-gray-400">{text}</p>
      {action && (
        <button onClick={action.onClick} className="text-sm text-blue-600 hover:text-blue-800 font-medium mt-3 block mx-auto">
          {action.label}
        </button>
      )}
    </div>
  )
}
