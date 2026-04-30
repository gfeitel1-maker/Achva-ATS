import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STAGE_INFO = {
  interest:      { label: 'Interest received',   message: "We've received your interest form and will be in touch soon with next steps." },
  interview:     { label: 'Interview scheduled', message: "Your interview is scheduled. We'll reach out after it's completed." },
  application:   { label: 'Ready to apply',      message: 'Your application is ready to fill out. Click below whenever you\'re ready.' },
  offer:         { label: 'Offer waiting',        message: 'You have an offer ready to review. Click below to read it and let us know your decision.' },
  contract:      { label: 'Contract ready',       message: 'Your contract is ready to sign. Please review it carefully and add your signature below.' },
  hired:         { label: 'Hired!',               message: "You're on the team! We'll be in touch soon with everything you need." },
  not_advancing: { label: 'Application closed',  message: "Thank you for your interest. We've moved forward with other candidates at this time." },
  withdrawn:     { label: 'Withdrawn',            message: 'Your application has been withdrawn.' },
}

export default function CandidatePortal() {
  const navigate = useNavigate()

  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  // Documents
  const [docs, setDocs]                   = useState([])
  const [pipelineRecordId, setPipelineRecordId] = useState(null)
  const [uploading, setUploading]         = useState({}) // { [docId]: true }

  useEffect(() => {
    let loaded = false

    async function loadData() {
      if (loaded) return
      loaded = true
      const { data, error } = await supabase.rpc('get_my_candidate_data')
      if (error || data?.error) { navigate('/candidate/login'); return }
      setData(data)
      setLoading(false)

      // Load documents in background
      const { data: docsData } = await supabase.rpc('get_my_documents')
      if (docsData && !docsData.error) {
        setPipelineRecordId(docsData.pipeline_record_id)
        setDocs(docsData.documents ?? [])
      }
    }

    // onAuthStateChange fires after magic link tokens are exchanged — don't
    // redirect on null here because PKCE code exchange may still be in flight.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) loadData()
      else if (event === 'SIGNED_OUT') navigate('/candidate/login')
    })

    // Fallback: if nothing fires within 3s, no valid session exists
    const timeout = setTimeout(() => { if (!loaded) navigate('/candidate/login') }, 3000)

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    navigate('/candidate/login')
  }

  async function uploadFile(doc, file) {
    if (!file || !pipelineRecordId) return
    if (file.size > 10 * 1024 * 1024) { alert('File must be under 10 MB.'); return }

    setUploading(prev => ({ ...prev, [doc.id]: true }))

    const ext      = file.name.split('.').pop()
    const safeName = `${Date.now()}.${ext}`
    const path     = `${pipelineRecordId}/${doc.id}/${safeName}`

    const { error: uploadError } = await supabase.storage
      .from('candidate-documents')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      alert('Upload failed. Please try again.')
      setUploading(prev => ({ ...prev, [doc.id]: false }))
      return
    }

    const { data: rpcData } = await supabase.rpc('submit_document', {
      p_document_id: doc.id,
      p_file_path:   path,
      p_file_name:   file.name,
      p_file_size:   file.size,
    })

    if (rpcData?.success) {
      setDocs(prev => prev.map(d =>
        d.id === doc.id
          ? { ...d, submitted: true, file_name: file.name, file_path: path }
          : d
      ))
    }

    setUploading(prev => ({ ...prev, [doc.id]: false }))
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading...</p>
    </div>
  )

  const stage = data?.stage
  const info  = STAGE_INFO[stage] ?? { label: stage, message: '' }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {data?.first_name ? `Hi, ${data.first_name}` : 'Your application'}
            </h1>
            {data?.org_name && (
              <p className="text-sm text-gray-400 mt-0.5">
                {data.org_name}{data?.cycle_name ? ` · ${data.cycle_name}` : ''}
              </p>
            )}
          </div>
          <button onClick={signOut} disabled={signingOut}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1">
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>

        {/* Status card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
          <div className="flex items-center gap-2.5 mb-2">
            <StatusDot stage={stage} />
            <span className="text-sm font-semibold text-gray-900">{info.label}</span>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">{info.message}</p>
        </div>

        {/* Stage-specific action */}
        {stage === 'application' && data?.application_token && (
          <a
            href={`/application/${data.application_token}`}
            className="block w-full text-center bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-sm"
          >
            Fill out your application →
          </a>
        )}

        {stage === 'offer' && data?.offer?.acceptance_token && !['accepted', 'declined'].includes(data.offer.status) && (
          <a
            href={`/offer/${data.offer.acceptance_token}`}
            className="block w-full text-center bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-sm"
          >
            Review and respond to your offer →
          </a>
        )}

        {stage === 'contract' && (
          <a
            href="/contract"
            className="block w-full text-center bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-sm"
          >
            Review and sign your contract →
          </a>
        )}

        {stage === 'offer' && data?.offer?.status === 'accepted' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-sm font-semibold text-green-800">You've accepted your offer ✓</p>
          </div>
        )}

        {stage === 'offer' && data?.offer?.status === 'declined' && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-sm text-gray-500">You declined this offer.</p>
          </div>
        )}

        {stage === 'hired' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-sm font-semibold text-green-800">Welcome to the team! 🎉</p>
          </div>
        )}

        {/* Documents section — shown when there are required docs */}
        {docs.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Required documents</h2>
            <div className="space-y-3">
              {docs.map(doc => (
                <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                    {doc.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{doc.description}</p>
                    )}
                    {doc.submitted && doc.file_name && (
                      <p className="text-xs text-green-600 mt-1 truncate">↑ {doc.file_name}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {doc.submitted ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Uploaded
                      </span>
                    ) : (
                      <label className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                        uploading[doc.id]
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}>
                        {uploading[doc.id] ? 'Uploading...' : 'Upload file'}
                        <input
                          type="file"
                          className="hidden"
                          disabled={uploading[doc.id]}
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) uploadFile(doc, file)
                            e.target.value = ''
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Accepted formats: PDF, JPG, PNG, Word document. Max 10 MB per file.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}

function StatusDot({ stage }) {
  const color = {
    interest:      'bg-gray-400',
    interview:     'bg-blue-400',
    application:   'bg-blue-600',
    offer:         'bg-green-500',
    contract:      'bg-purple-500',
    hired:         'bg-green-600',
    not_advancing: 'bg-gray-300',
    withdrawn:     'bg-gray-300',
  }[stage] ?? 'bg-gray-400'

  return <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`} />
}
