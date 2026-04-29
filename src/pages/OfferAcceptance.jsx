import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function OfferAcceptance() {
  const { token } = useParams()

  const [offer, setOffer]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [responding, setResponding] = useState(null) // 'accept' | 'decline'
  const [done, setDone]         = useState(null)     // 'accepted' | 'declined'
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false)

  useEffect(() => {
    supabase.rpc('get_offer_by_token', { p_token: token }).then(({ data, error }) => {
      if (error || !data || data.error === 'invalid_token') {
        setError('This offer link is invalid or has expired.')
      } else if (data.error === 'already_responded') {
        setError('already_responded')
      } else {
        setOffer(data)
        if (data.status === 'accepted') setDone('accepted')
        if (data.status === 'declined') setDone('declined')
      }
      setLoading(false)
    })
  }, [token])

  async function respond(response) {
    setResponding(response)
    const { data } = await supabase.rpc('respond_to_offer', { p_token: token, p_response: response })
    setResponding(null)
    if (data?.success) {
      setDone(response === 'accept' ? 'accepted' : 'declined')
    } else {
      setError('Something went wrong. Please try again.')
    }
  }

  if (loading) return (
    <Shell orgName="">
      <p className="text-gray-400 text-sm text-center">Loading...</p>
    </Shell>
  )

  if (error && error !== 'already_responded') return (
    <Shell orgName="">
      <div className="text-center">
        <p className="text-lg font-semibold text-gray-900 mb-2">Link not found</p>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    </Shell>
  )

  if (done === 'accepted') return (
    <Shell orgName={offer?.org_name}>
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Offer accepted!</h2>
        <p className="text-sm text-gray-500">
          We're thrilled to have you on the team{offer?.org_name ? ` at ${offer.org_name}` : ''}. You'll hear from us soon with next steps.
        </p>
        {offer?.accepted_at && (
          <p className="text-xs text-gray-400 mt-3">
            Accepted on {new Date(offer.accepted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>
    </Shell>
  )

  if (done === 'declined') return (
    <Shell orgName={offer?.org_name}>
      <div className="text-center py-4">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Offer declined</h2>
        <p className="text-sm text-gray-500">
          We understand, and wish you all the best. Thank you for your time and interest{offer?.org_name ? ` in ${offer.org_name}` : ''}.
        </p>
      </div>
    </Shell>
  )

  return (
    <Shell orgName={offer?.org_name}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Your offer</h1>
        <p className="text-sm text-gray-500">
          Hi {offer?.candidate_name?.split(' ')[0]} — please review your offer letter below and let us know your decision.
        </p>
      </div>

      {/* Offer letter */}
      <div className="border border-gray-200 rounded-xl p-6 bg-gray-50 mb-6"
           dangerouslySetInnerHTML={{ __html: offer?.offer_letter_html }} />

      {/* Actions */}
      {!showDeclineConfirm ? (
        <div className="flex gap-3">
          <button
            onClick={() => respond('accept')}
            disabled={!!responding}
            className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {responding === 'accept' ? 'Accepting...' : 'Accept offer'}
          </button>
          <button
            onClick={() => setShowDeclineConfirm(true)}
            disabled={!!responding}
            className="px-5 py-3 rounded-xl font-medium text-gray-500 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Decline
          </button>
        </div>
      ) : (
        <div className="border border-red-200 rounded-xl p-5 bg-red-50">
          <p className="text-sm font-semibold text-red-800 mb-1">Are you sure you want to decline?</p>
          <p className="text-xs text-red-600 mb-4">This action can't be undone.</p>
          <div className="flex gap-2">
            <button
              onClick={() => respond('decline')}
              disabled={!!responding}
              className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {responding === 'decline' ? 'Declining...' : 'Yes, decline'}
            </button>
            <button
              onClick={() => setShowDeclineConfirm(false)}
              className="text-sm text-gray-500 hover:text-gray-800 px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Shell>
  )
}

function Shell({ orgName, children }) {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {orgName && (
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">{orgName}</h1>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
