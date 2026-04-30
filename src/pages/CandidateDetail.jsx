import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import StageBadge from '../components/StageBadge'
import { STAGES, STAGE_FLOW, nextStage, prevStage, isTerminal, daysInStage, getInitials } from '../lib/stages'

function cycleYear(name) {
  const m = (name ?? '').match(/\d{4}/)
  return m ? m[0] : (name ?? '—')
}

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
  const { id: candidateId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  // Person-level (loaded once)
  const [candidate, setCandidate]   = useState(null)
  const [allRecords, setAllRecords] = useState([])
  const [loading, setLoading]       = useState(true)

  // Active cycle
  const [activeRecordId, setActiveRecordId] = useState(null)
  const [cycleLoading, setCycleLoading]     = useState(false)

  // Cycle-specific data
  const [submission, setSubmission] = useState(null)
  const [appSub, setAppSub]         = useState(null)
  const [appFields, setAppFields]   = useState([])
  const [refs, setRefs]             = useState([])
  const [notes, setNotes]           = useState([])
  const [docs, setDocs]             = useState([])
  const [docSubs, setDocSubs]       = useState([])

  // Offer
  const [offer, setOffer]               = useState(null)
  const [offerForm, setOfferForm]       = useState({ position_title: '', start_date: '', salary: '' })
  const [positionMode, setPositionMode] = useState('applied')

  // Contract
  const [contract, setContract]                   = useState(null)
  const [contractTemplates, setContractTemplates] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [contractVars, setContractVars]           = useState({ position: '', start_date: '', end_date: '', salary: '' })
  const [generatingContract, setGeneratingContract] = useState(false)
  const [offerSaving, setOfferSaving]   = useState(false)
  const [editingOffer, setEditingOffer] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody]       = useState('')
  const [templateSaving, setTemplateSaving] = useState(false)
  const [sendingOffer, setSendingOffer]     = useState(false)

  // UI
  const [activeTab, setActiveTab]             = useState('Application')
  const [saving, setSaving]                   = useState(false)
  const [copied, setCopied]                   = useState(false)
  const [sendingRef, setSendingRef]           = useState(null)
  const [editingPosition, setEditingPosition] = useState(false)
  const [positionValue, setPositionValue]     = useState('')
  const [showNoteForm, setShowNoteForm]       = useState(false)
  const [noteText, setNoteText]               = useState('')
  const [noteDate, setNoteDate]               = useState(new Date().toISOString().slice(0, 10))
  const [noteSaving, setNoteSaving]           = useState(false)
  const [markingDoc, setMarkingDoc]           = useState(null)

  // ── Load person + all pipeline records ────────────────────────
  useEffect(() => {
    async function loadPerson() {
      const [candRes, recordsRes] = await Promise.all([
        supabase.from('candidates').select('*').eq('id', candidateId).single(),
        supabase.from('pipeline_records')
          .select('*, hiring_cycles(id, name, spoke_id, spokes(name))')
          .eq('candidate_id', candidateId),
      ])
      if (candRes.data) setCandidate(candRes.data)
      if (recordsRes.data?.length > 0) {
        const sorted = [...recordsRes.data].sort((a, b) =>
          cycleYear(b.hiring_cycles?.name).localeCompare(cycleYear(a.hiring_cycles?.name))
        )
        setAllRecords(sorted)
        setActiveRecordId(sorted[0].id)
        setPositionValue(sorted[0].position ?? '')
      }
      setLoading(false)
    }
    loadPerson()
  }, [candidateId])

  // ── Load cycle-specific data when active record changes ───────
  useEffect(() => {
    if (!activeRecordId) return
    const rec = allRecords.find(r => r.id === activeRecordId)
    if (!rec) return

    setActiveTab('Application')
    setOffer(null)
    setCycleLoading(true)

    const spokeId = rec.hiring_cycles?.spoke_id

    async function loadCycle() {
      const [subRes, appRes, refsRes, notesRes, docSubsRes] = await Promise.all([
        supabase.from('interest_form_submissions')
          .select('responses, interest_forms(questions)').eq('pipeline_record_id', activeRecordId).maybeSingle(),
        supabase.from('application_submissions')
          .select('responses, submitted_at').eq('pipeline_record_id', activeRecordId).maybeSingle(),
        supabase.from('references')
          .select('id, reference_name, reference_email, reference_phone, reference_relationship, how_long_known, response_received_at, email_sent_at, response, reference_token')
          .eq('pipeline_record_id', activeRecordId).order('created_at'),
        supabase.from('interview_notes')
          .select('*').eq('pipeline_record_id', activeRecordId).order('created_at', { ascending: false }),
        supabase.from('document_submissions')
          .select('*').eq('pipeline_record_id', activeRecordId),
      ])
      setSubmission(subRes.data ?? null)
      setAppSub(appRes.data ?? null)
      setRefs(refsRes.data ?? [])
      setNotes(notesRes.data ?? [])
      setDocSubs(docSubsRes.data ?? [])

      if (spokeId) {
        const [appFieldsRes, docsRes] = await Promise.all([
          supabase.from('applications').select('fields').eq('spoke_id', spokeId).eq('is_active', true).single(),
          supabase.from('documents').select('id, name, description').eq('spoke_id', spokeId).eq('is_active', true).order('name'),
        ])
        setAppFields(appFieldsRes.data?.fields
          ? [...appFieldsRes.data.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          : []
        )
        setDocs(docsRes.data ?? [])
      }

      // Load offer if at offer / contract / hired stage
      const stage = rec.current_stage
      if (['offer', 'contract', 'hired'].includes(stage)) {
        const [offerRes, templateRes] = await Promise.all([
          supabase.from('offers').select('*').eq('pipeline_record_id', activeRecordId).maybeSingle(),
          spokeId
            ? supabase.from('offer_email_templates').select('*').eq('spoke_id', spokeId).maybeSingle()
            : Promise.resolve({ data: null }),
        ])
        const offerData = offerRes.data ?? null
        setOffer(offerData)
        if (offerData) {
          setOfferForm({ position_title: offerData.position_title, start_date: offerData.start_date, salary: offerData.salary })
          setPositionMode(offerData.position_title === rec.position ? 'applied' : 'custom')
        } else {
          setOfferForm({ position_title: rec.position ?? '', start_date: '', salary: '' })
          setPositionMode(rec.position ? 'applied' : 'custom')
        }
        const tmpl = templateRes.data
        setEmailSubject(tmpl?.subject ?? 'Your offer — {{org_name}}')
        setEmailBody(tmpl?.body ?? "Hi {{first_name}},\n\nWe're excited to extend this offer to you. Please review the letter below.\n\nWarm regards,\n{{org_name}} Hiring Team")

        if (stage === 'contract') setActiveTab('Contract')
        else setActiveTab('Offer')
      }

      // Load contract data if at contract stage
      if (stage === 'contract') {
        const [contractRes, templatesRes] = await Promise.all([
          supabase.from('contracts').select('*').eq('pipeline_record_id', activeRecordId).maybeSingle(),
          supabase.from('contract_templates').select('id, name').eq('is_active', true),
        ])
        const contractData = contractRes.data ?? null
        const templates    = templatesRes.data ?? []
        setContract(contractData)
        setContractTemplates(templates)
        setContractVars({ position: rec.position ?? '', start_date: '', end_date: '', salary: '' })
        if (templates.length > 0 && !contractData) setSelectedTemplateId(templates[0].id)
      }

      setCycleLoading(false)
    }
    loadCycle()
  }, [activeRecordId])

  // ── Derived ───────────────────────────────────────────────────
  const activeRecord  = allRecords.find(r => r.id === activeRecordId) ?? null
  const stage         = activeRecord?.current_stage ?? 'interest'
  const days          = daysInStage(activeRecord?.stage_entered_at)
  const forward       = nextStage(stage)
  const back          = prevStage(stage)
  const terminal      = isTerminal(stage)
  const hired         = stage === 'hired'
  const showOfferTab     = ['offer', 'contract', 'hired'].includes(stage)
  const showContractTab  = stage === 'contract'
  const tabs = [
    ...(showOfferTab    ? ['Offer']    : []),
    ...(showContractTab ? ['Contract'] : []),
    'Application', 'References', 'Notes', 'Documents',
  ]
  const currentOrder  = STAGES[stage]?.order ?? 0
  const questions     = [...(submission?.interest_forms?.questions ?? [])].sort((a, b) => a.order - b.order)

  function substituted(text) {
    const orgName   = activeRecord?.hiring_cycles?.spokes?.name ?? 'Camp'
    const firstName = candidate?.first_name ?? ''
    return text.replace(/{{first_name}}/g, firstName).replace(/{{org_name}}/g, orgName)
  }

  // ── Actions ───────────────────────────────────────────────────
  function selectCycle(recordId) {
    const rec = allRecords.find(r => r.id === recordId)
    setActiveRecordId(recordId)
    setPositionValue(rec?.position ?? '')
    setEditingPosition(false)
  }

  async function moveStage(newStage) {
    setSaving(true)
    const now     = new Date().toISOString()
    const updates = { current_stage: newStage, stage_entered_at: now }
    const token   = newStage === 'application' ? crypto.randomUUID() : undefined
    if (token) updates.application_token = token

    const { error } = await supabase.from('pipeline_records').update(updates).eq('id', activeRecordId)
    if (!error) {
      setAllRecords(prev => prev.map(r => r.id === activeRecordId ? { ...r, ...updates } : r))
      if (newStage === 'offer')     setActiveTab('Offer')
      if (newStage === 'contract')  setActiveTab('Contract')
      if (token) {
        const link = `${window.location.origin}/application/${token}`
        await supabase.functions.invoke('send-application-email', {
          body: {
            candidate_name:   `${candidate.first_name} ${candidate.last_name}`,
            candidate_email:  candidate.email,
            application_link: link,
            org_name:         activeRecord.hiring_cycles?.spokes?.name ?? 'Camp',
          },
        })
      }
    }
    setSaving(false)
  }

  async function savePosition() {
    const { error } = await supabase.from('pipeline_records').update({ position: positionValue }).eq('id', activeRecordId)
    if (!error) {
      setAllRecords(prev => prev.map(r => r.id === activeRecordId ? { ...r, position: positionValue } : r))
      setEditingPosition(false)
    }
  }

  async function addNote(e) {
    e.preventDefault()
    if (!noteText.trim()) return
    setNoteSaving(true)
    const { data, error } = await supabase
      .from('interview_notes')
      .insert({ pipeline_record_id: activeRecordId, notes: noteText.trim(), interview_date: noteDate || null, created_by: user.id })
      .select().single()
    if (!error && data) { setNotes(prev => [data, ...prev]); setNoteText(''); setShowNoteForm(false) }
    setNoteSaving(false)
  }

  async function markReceived(docId) {
    setMarkingDoc(docId)
    const { data } = await supabase.from('document_submissions')
      .insert({ pipeline_record_id: activeRecordId, document_id: docId, received_at: new Date().toISOString(), received_by: user.id })
      .select().single()
    if (data) setDocSubs(prev => [...prev, data])
    setMarkingDoc(null)
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/application/${activeRecord.application_token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function sendReferenceRequest(ref) {
    setSendingRef(ref.id)
    const orgName = activeRecord.hiring_cycles?.spokes?.name ?? 'Camp'
    const link    = `${window.location.origin}/reference/${ref.reference_token}`
    const { error } = await supabase.functions.invoke('send-reference-email', {
      body: {
        reference_name:  ref.reference_name,
        reference_email: ref.reference_email,
        candidate_name:  `${candidate.first_name} ${candidate.last_name}`,
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

  async function generateContract() {
    if (!selectedTemplateId) return
    setGeneratingContract(true)
    const orgName = activeRecord?.hiring_cycles?.spokes?.name ?? 'Camp'
    const { data, error } = await supabase.rpc('generate_contract', {
      p_pipeline_record_id: activeRecordId,
      p_template_id:        selectedTemplateId,
      p_variables: {
        first_name: candidate?.first_name ?? '',
        last_name:  candidate?.last_name  ?? '',
        org_name:   orgName,
        position:   contractVars.position,
        start_date: contractVars.start_date || null,
        end_date:   contractVars.end_date   || null,
        salary:     contractVars.salary,
      },
    })
    if (!error && data?.success) {
      const { data: contractData } = await supabase
        .from('contracts').select('*').eq('pipeline_record_id', activeRecordId).single()
      setContract(contractData ?? null)
    }
    setGeneratingContract(false)
  }

  async function generateOffer() {
    setOfferSaving(true)
    const orgName       = activeRecord.hiring_cycles?.spokes?.name ?? 'Camp'
    const candidateName = `${candidate?.first_name} ${candidate?.last_name}`
    const html          = buildOfferLetterHtml({ candidateName, orgName, ...offerForm })
    const spokeId       = activeRecord.hiring_cycles?.spoke_id

    const { data, error } = await supabase
      .from('offers')
      .upsert({
        pipeline_record_id: activeRecordId,
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
    const spokeId = activeRecord.hiring_cycles?.spoke_id
    await supabase
      .from('offer_email_templates')
      .upsert({ spoke_id: spokeId, subject: emailSubject, body: emailBody, updated_at: new Date().toISOString() }, { onConflict: 'spoke_id' })
    setTemplateSaving(false)
  }

  async function sendOffer() {
    setSendingOffer(true)
    const acceptanceLink = offer.acceptance_token
      ? `${window.location.origin}/offer/${offer.acceptance_token}`
      : undefined
    const { error } = await supabase.functions.invoke('send-offer-email', {
      body: {
        to_email:          candidate?.email,
        subject:           substituted(emailSubject),
        email_body:        substituted(emailBody),
        offer_letter_html: offer.offer_letter_html,
        org_name:          activeRecord?.hiring_cycles?.spokes?.name ?? 'Camp',
        acceptance_link:   acceptanceLink,
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

  // ── Render ────────────────────────────────────────────────────
  if (loading) return <Layout><div className="py-20 text-center text-gray-400 text-sm">Loading...</div></Layout>
  if (!candidate) return <Layout><div className="py-20 text-center text-gray-400 text-sm">Candidate not found.</div></Layout>

  const addressParts = [
    candidate.address_street,
    candidate.address_city,
    candidate.address_state,
    candidate.address_zip,
  ].filter(Boolean)

  return (
    <Layout>
      <div className="mb-4">
        <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
          ← Dashboard
        </button>
      </div>

      {/* ── HERO ── */}
      <div className="bg-white rounded-t-xl border border-gray-200 px-6 py-5 flex items-start gap-5">
        <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg flex-shrink-0">
          {getInitials(candidate.first_name, candidate.last_name)}
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap mb-1">
            <h1 className="text-xl font-bold text-gray-900">{candidate.first_name} {candidate.last_name}</h1>
            {activeRecord?.is_returning_staff && (
              <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">returning</span>
            )}
          </div>
          <div className="flex items-center gap-4 flex-wrap text-sm">
            <a href={`mailto:${candidate.email}`} className="text-blue-600 hover:underline">{candidate.email}</a>
            {candidate.phone && <span className="text-gray-500">{candidate.phone}</span>}
            {candidate.date_of_birth && (
              <span className="text-gray-400">
                {new Date(candidate.date_of_birth + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            )}
            {addressParts.length > 0 && <span className="text-gray-400">{addressParts.join(', ')}</span>}
          </div>
          {/* Position (per cycle) */}
          {activeRecord && (
            <div className="mt-2 flex items-center gap-2">
              {editingPosition ? (
                <>
                  <input type="text" value={positionValue} onChange={e => setPositionValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') savePosition() }}
                    className="border border-gray-300 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" autoFocus />
                  <button onClick={savePosition} className="text-xs text-blue-600 font-medium">Save</button>
                  <button onClick={() => { setEditingPosition(false); setPositionValue(activeRecord.position ?? '') }} className="text-xs text-gray-400">Cancel</button>
                </>
              ) : (
                <>
                  <span className="text-sm text-gray-500">{activeRecord.position || <span className="text-gray-300">No position set</span>}</span>
                  <button onClick={() => setEditingPosition(true)} className="text-xs text-gray-300 hover:text-blue-500">edit</button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Stage + actions (right side of hero) */}
        {activeRecord && (
          <div className="flex-shrink-0 text-right space-y-2 min-w-[160px]">
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs text-gray-300">{days}d · {activeRecord.hiring_cycles?.name}</span>
              <StageBadge stage={stage} />
            </div>
            {hired ? (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-green-700">Hired!</p>
                <button onClick={() => moveStage('offer')} disabled={saving} className="text-xs text-gray-400 hover:text-gray-600">← Back to offer</button>
              </div>
            ) : !terminal ? (
              <div className="space-y-1.5">
                {forward && (
                  <button onClick={() => moveStage(forward)} disabled={saving}
                    className="w-full text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {saving ? 'Saving...' : `Move to ${STAGES[forward]?.label} →`}
                  </button>
                )}
                <div className="flex items-center justify-end gap-3">
                  {back && (
                    <button onClick={() => moveStage(back)} disabled={saving} className="text-xs text-gray-400 hover:text-gray-600">← {STAGES[back]?.label}</button>
                  )}
                  <button onClick={() => moveStage('not_advancing')} disabled={saving} className="text-xs text-red-400 hover:text-red-600">Not hiring</button>
                </div>
              </div>
            ) : (
              <p className="text-sm font-medium text-gray-400">{STAGES[stage]?.label}</p>
            )}
          </div>
        )}
      </div>

      {/* ── HISTORY BAR ── */}
      <div className="bg-white border-x border-b border-gray-200 rounded-b-xl mb-6">
        {/* Year pills */}
        <div className="flex items-center gap-1.5 px-6 pt-3 flex-wrap">
          {allRecords.map(r => (
            <button key={r.id} onClick={() => selectCycle(r.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                r.id === activeRecordId ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {cycleYear(r.hiring_cycles?.name)}
              <span className={r.id === activeRecordId ? 'text-blue-200' : 'text-gray-400'}>
                {STAGES[r.current_stage]?.label}
              </span>
            </button>
          ))}
        </div>
        {/* Section tabs */}
        <div className="flex border-t border-gray-100 mt-3">
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
      </div>

      {/* ── CONTENT (full width) ── */}
      <div>
        {cycleLoading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading...</div>
        ) : (
          <>

              {/* ── OFFER TAB ── */}
              {activeTab === 'Offer' && (
                <div className="space-y-4">
                  {!offer || editingOffer ? (
                    <Section title={editingOffer ? 'Edit offer details' : 'Create offer'}>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">Hire for</label>
                            {activeRecord.position ? (
                              <div className="space-y-2">
                                <select value={positionMode}
                                  onChange={e => {
                                    setPositionMode(e.target.value)
                                    setOfferForm(p => ({ ...p, position_title: e.target.value === 'applied' ? activeRecord.position : '' }))
                                  }}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                                  <option value="applied">{activeRecord.position}</option>
                                  <option value="custom">Different position...</option>
                                </select>
                                {positionMode === 'custom' && (
                                  <input type="text" value={offerForm.position_title}
                                    onChange={e => setOfferForm(p => ({ ...p, position_title: e.target.value }))}
                                    placeholder="Enter position title" autoFocus
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
                          <button onClick={generateOffer}
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
                      {offer.status === 'accepted' && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                          <div className="w-7 h-7 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-green-800">Offer accepted</p>
                            {offer.accepted_at && (
                              <p className="text-xs text-green-600 mt-0.5">
                                {new Date(offer.accepted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      {offer.status === 'declined' && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                          <div>
                            <p className="text-sm font-semibold text-red-800">Offer declined</p>
                            {offer.declined_at && (
                              <p className="text-xs text-red-600 mt-0.5">
                                {new Date(offer.declined_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
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
                      <Section title="Offer letter">
                        <div className="flex justify-end mb-4">
                          <button onClick={() => setEditingOffer(true)} className="text-xs text-gray-400 hover:text-blue-600">Edit details</button>
                        </div>
                        <div className="border border-gray-100 rounded-lg p-6 bg-gray-50" dangerouslySetInnerHTML={{ __html: offer.offer_letter_html }} />
                      </Section>
                      <Section title="Email to candidate">
                        <p className="text-xs text-gray-400 mb-4">
                          Use <code className="bg-gray-100 px-1 rounded">{'{{first_name}}'}</code> and <code className="bg-gray-100 px-1 rounded">{'{{org_name}}'}</code> as placeholders.
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
                              className={`text-sm text-white px-5 py-2 rounded-lg font-semibold disabled:opacity-50 transition-colors ${offer.status === 'sent' ? 'bg-gray-600 hover:bg-gray-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                              {sendingOffer ? 'Sending...' : offer.status === 'sent' ? 'Resend offer →' : 'Send offer →'}
                            </button>
                          </div>
                        </div>
                      </Section>
                    </>
                  )}
                </div>
              )}

              {/* ── CONTRACT TAB ── */}
              {activeTab === 'Contract' && (
                <div className="space-y-4">
                  {!contract ? (
                    <Section title="Generate contract">
                      <div className="space-y-4">
                        {contractTemplates.length === 0 ? (
                          <p className="text-sm text-gray-400">
                            No contract templates found. Add one in Settings → Contract Templates.
                          </p>
                        ) : (
                          <>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1.5">Template</label>
                              <select
                                value={selectedTemplateId ?? ''}
                                onChange={e => setSelectedTemplateId(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              >
                                {contractTemplates.map(t => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5">Position</label>
                                <input type="text" value={contractVars.position}
                                  onChange={e => setContractVars(v => ({ ...v, position: e.target.value }))}
                                  placeholder="e.g. Counselor"
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5">Compensation</label>
                                <input type="text" value={contractVars.salary}
                                  onChange={e => setContractVars(v => ({ ...v, salary: e.target.value }))}
                                  placeholder="e.g. $500/week"
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5">Start date</label>
                                <input type="date" value={contractVars.start_date}
                                  onChange={e => setContractVars(v => ({ ...v, start_date: e.target.value }))}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5">End date</label>
                                <input type="date" value={contractVars.end_date}
                                  onChange={e => setContractVars(v => ({ ...v, end_date: e.target.value }))}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                              </div>
                            </div>
                            <button onClick={generateContract} disabled={generatingContract || !selectedTemplateId}
                              className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                              {generatingContract ? 'Generating...' : 'Generate contract'}
                            </button>
                          </>
                        )}
                      </div>
                    </Section>
                  ) : (
                    <>
                      {contract.status === 'signed' ? (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                          <div className="w-7 h-7 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-green-800">Contract signed</p>
                            <p className="text-xs text-green-600 mt-0.5">
                              Signed as "{contract.signature_name}"
                              {contract.signed_at ? ` · ${new Date(contract.signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-amber-800">Awaiting candidate signature</p>
                            <p className="text-xs text-amber-600 mt-0.5">
                              The candidate can sign via their applicant portal at /candidate
                            </p>
                          </div>
                          <button onClick={() => setContract(null)} className="text-xs text-amber-600 hover:text-amber-800 flex-shrink-0">Regenerate</button>
                        </div>
                      )}
                      <Section title="Contract preview">
                        <div className="border border-gray-100 rounded-lg p-6 bg-gray-50"
                          dangerouslySetInnerHTML={{ __html: contract.rendered_html }} />
                      </Section>
                    </>
                  )}
                </div>
              )}

              {/* ── APPLICATION TAB ── */}
              {activeTab === 'Application' && (
                <div className="space-y-4">
                  {appSub && appFields.map(f => (
                    <AppFieldResponse key={f.id} field={f} value={appSub.responses?.[f.id]} />
                  ))}

                  {appSub && appFields.length === 0 && (
                    <>
                      {appSub.responses?.availability && (
                        <Section title="Availability">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{appSub.responses.availability}</p>
                        </Section>
                      )}
                      {Array.isArray(appSub.responses?.employment_history) && appSub.responses.employment_history.length > 0 && (
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
                    </>
                  )}

                  {!appSub && stage === 'application' && activeRecord?.application_token && (
                    <Section title="Application link">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 flex-1 truncate text-gray-600">
                          {window.location.origin}/application/{activeRecord.application_token}
                        </code>
                        <button onClick={copyLink} className="text-sm px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex-shrink-0 transition-colors">
                          {copied ? 'Copied!' : 'Copy link'}
                        </button>
                      </div>
                    </Section>
                  )}

                  {!appSub && (
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
                      <p className="text-sm text-gray-400">No application submitted yet.</p>
                    </div>
                  )}

                  {/* Interest form responses */}
                  {questions.length > 0 && (
                    <Section title="Interest form">
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
                    </Section>
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
                              <button onClick={() => sendReferenceRequest(ref)} disabled={sendingRef === ref.id}
                                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                                {sendingRef === ref.id ? 'Sending...' : 'Send request'}
                              </button>
                            )}
                          </div>
                        </div>
                        {ref.email_sent_at && !ref.response_received_at && (
                          <div className="px-5 pb-4">
                            <p className="text-xs text-gray-300">
                              Request sent {new Date(ref.email_sent_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                              {' · '}
                              <button onClick={() => sendReferenceRequest(ref)} disabled={sendingRef === ref.id}
                                className="text-blue-500 hover:text-blue-700 disabled:opacity-50">
                                {sendingRef === ref.id ? 'Sending...' : 'Resend'}
                              </button>
                            </p>
                          </div>
                        )}
                        {ref.response && ref.response_received_at && (
                          <div className="border-t border-gray-100 px-5 py-5 space-y-4">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                              Response · {new Date(ref.response_received_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </p>
                            {[
                              { id: 'capacity',     label: 'How they know the candidate' },
                              { id: 'recommend',    label: 'Recommendation' },
                              { id: 'character',    label: 'Character & work ethic' },
                              { id: 'youth',        label: 'With young people' },
                              { id: 'challenge',    label: 'Handling responsibility' },
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
                  {docs.length === 0 ? (
                    <EmptyState text="No documents configured for this spoke. Add them in Settings → Documents." />
                  ) : (
                    docs.map(doc => {
                      const sub = docSubs.find(s => s.document_id === doc.id)
                      return (
                        <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2.5">
                              <p className="text-sm font-semibold text-gray-900">{doc.name}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${sub ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                {sub ? 'Received' : 'Pending'}
                              </span>
                            </div>
                            {doc.description && <p className="text-xs text-gray-400 mt-1">{doc.description}</p>}
                            {sub?.received_at && (
                              <p className="text-xs text-gray-300 mt-1.5">
                                Received {new Date(sub.received_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                          {!sub && (
                            <button onClick={() => markReceived(doc.id)} disabled={markingDoc === doc.id}
                              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0">
                              {markingDoc === doc.id ? 'Saving...' : 'Mark received'}
                            </button>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </>
          )}
      </div>
    </Layout>
  )
}

// ── Shared sub-components ──────────────────────────────────────

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

function AppFieldResponse({ field, value }) {
  if (value === undefined || value === null || value === '') return null

  if (field.type === 'employment_history' && Array.isArray(value) && value.length > 0) {
    return (
      <Section title={field.label}>
        <div className="space-y-3">
          {value.map((job, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-900">{[job.role, job.employer].filter(Boolean).join(' — ')}</p>
              {job.dates && <p className="text-xs text-gray-400">{job.dates}</p>}
              {job.description && <p className="text-sm text-gray-600 leading-relaxed">{job.description}</p>}
              {(job.supervisor_name || job.supervisor_contact) && (
                <p className="text-xs text-gray-500">
                  Supervisor: {[job.supervisor_name, job.supervisor_contact].filter(Boolean).join(' · ')}
                  {job.may_contact && ` · Contact: ${job.may_contact}`}
                </p>
              )}
            </div>
          ))}
        </div>
      </Section>
    )
  }

  if (field.type === 'school_history' && Array.isArray(value) && value.length > 0) {
    return (
      <Section title={field.label}>
        <div className="space-y-3">
          {value.map((school, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-900">{school.name}</p>
              {school.program && <p className="text-sm text-gray-600 mt-0.5">{school.program}</p>}
              <p className="text-xs text-gray-400 mt-1">
                {[school.dates, school.graduated ? `Graduated: ${school.graduated}` : null].filter(Boolean).join(' · ')}
              </p>
            </div>
          ))}
        </div>
      </Section>
    )
  }

  return (
    <Section title={field.label}>
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{String(value)}</p>
    </Section>
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
