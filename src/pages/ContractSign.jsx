import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ContractSign() {
  const navigate = useNavigate()

  const [contract, setContract] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  // Signature flow
  const [agreed, setAgreed]           = useState(false)
  const [sigName, setSigName]         = useState('')
  const [signing, setSigning]         = useState(false)
  const [signError, setSignError]     = useState(null)
  const [signed, setSigned]           = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/candidate/login'); return }

      const { data, error: rpcError } = await supabase.rpc('get_my_contract')

      if (rpcError || data?.error) {
        const msg = data?.error
        if (msg === 'no_contract') setError('No contract has been generated for you yet. Check back soon.')
        else if (msg === 'not_found' || msg === 'no_record') { navigate('/candidate/login'); return }
        else setError('Something went wrong loading your contract.')
        setLoading(false)
        return
      }

      if (data.status === 'signed') setSigned(true)
      setContract(data)
      setLoading(false)
    }
    load()
  }, [])

  async function handleSign(e) {
    e.preventDefault()
    if (!sigName.trim()) { setSignError('Please type your full name to sign.'); return }
    if (!agreed)         { setSignError('Please confirm you have read the contract.'); return }

    setSigning(true)
    setSignError(null)

    const { data, error: rpcError } = await supabase.rpc('sign_contract', {
      p_contract_id:    contract.id,
      p_signature_name: sigName.trim(),
    })

    setSigning(false)

    if (rpcError || data?.error) {
      setSignError('Something went wrong. Please try again.')
      return
    }

    setSigned(true)
  }

  // ── Loading ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading your contract...</p>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────
  if (error || !contract) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <p className="text-gray-500 text-sm mb-4">{error ?? 'Contract not found.'}</p>
          <a href="/candidate" className="text-blue-600 text-sm hover:underline">← Back to your portal</a>
        </div>
      </div>
    )
  }

  // ── Signed confirmation ───────────────────────────────────────
  if (signed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Contract signed!</h1>
          <p className="text-gray-500 text-sm mb-8">
            {contract.org_name
              ? `Welcome to the ${contract.org_name} team. We'll be in touch soon with next steps.`
              : "You're all set. We'll be in touch soon with next steps."}
          </p>
          <a href="/candidate"
            className="inline-block bg-blue-600 text-white py-3 px-8 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-sm">
            Back to your portal
          </a>
        </div>
      </div>
    )
  }

  // ── Contract view + signature ─────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Your contract</h1>
            {contract.org_name && (
              <p className="text-sm text-gray-400 mt-0.5">{contract.org_name}</p>
            )}
          </div>
          <a href="/candidate" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← Portal
          </a>
        </div>

        {/* Contract body */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
          <div
            className="prose prose-sm max-w-none text-gray-800 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: contract.rendered_html }}
          />
        </div>

        {/* Signature section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Sign this contract</h2>
          <p className="text-sm text-gray-400 mb-5">
            By typing your full name below you are indicating your agreement to all terms above.
          </p>

          <form onSubmit={handleSign} className="space-y-4">
            {/* Read confirmation */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-sm text-gray-600 leading-relaxed group-hover:text-gray-800 transition-colors">
                I have read and understand all terms of this contract.
              </span>
            </label>

            {/* Signature name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Full name (your legal signature)
              </label>
              <input
                type="text"
                value={sigName}
                onChange={e => setSigName(e.target.value)}
                placeholder="Type your full name"
                disabled={!agreed}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                style={{ fontFamily: 'Georgia, serif', fontSize: '16px' }}
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Signed on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            {signError && <p className="text-sm text-red-600">{signError}</p>}

            <button
              type="submit"
              disabled={signing || !agreed || !sigName.trim()}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {signing ? 'Signing...' : 'Submit signature →'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
