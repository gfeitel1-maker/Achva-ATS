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

  useEffect(() => {
    let settled = false

    async function handleSession(session) {
      if (settled) return
      if (!session) {
        settled = true
        navigate('/candidate/login')
        return
      }
      settled = true
      const { data, error } = await supabase.rpc('get_my_candidate_data')
      if (error || data?.error) { navigate('/candidate/login'); return }
      setData(data)
      setLoading(false)
    }

    // onAuthStateChange fires after the client processes magic link tokens in
    // the URL — more reliable than getSession() for handling link callbacks.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    navigate('/candidate/login')
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
