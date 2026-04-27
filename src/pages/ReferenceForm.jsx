import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const FALLBACK_QUESTIONS = [
  { id: 'capacity',     label: 'In what capacity do you know this person?', type: 'text' },
  { id: 'character',    label: 'How would you describe their character and work ethic?', type: 'textarea' },
  { id: 'youth',        label: 'How do they interact with young people or in a team setting?', type: 'textarea' },
  { id: 'challenge',    label: 'Can you describe how they handle responsibility or a difficult situation?', type: 'textarea' },
  { id: 'recommend',    label: 'Would you recommend them for a role working with youth at an overnight camp?', type: 'select',
    options: ['Strongly recommend', 'Recommend', 'Recommend with reservations', 'Would not recommend'] },
  { id: 'anything_else', label: "Is there anything else you'd like us to know?", type: 'textarea', optional: true },
]

export default function ReferenceForm() {
  const { token } = useParams()
  const navigate  = useNavigate()

  const [info, setInfo]           = useState(null)
  const [questions, setQuestions] = useState(FALLBACK_QUESTIONS)
  const [error, setError]         = useState(null)
  const [loading, setLoading]     = useState(true)
  const [answers, setAnswers]     = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc('get_reference_by_token', { p_token: token })
      if (error || data?.error) {
        setError(data?.error ?? 'invalid_token')
      } else {
        setInfo(data)
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          const qs = [...data.questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          setQuestions(qs)
        }
      }
      setLoading(false)
    }
    load()
  }, [token])

  function set(id, value) {
    setAnswers(prev => ({ ...prev, [id]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    const { data } = await supabase.rpc('submit_reference_response', {
      p_token:    token,
      p_response: answers,
    })
    if (data?.success) {
      navigate('/reference/success')
    } else {
      setError(data?.error ?? 'Something went wrong.')
      setSubmitting(false)
    }
  }

  const required = questions.filter(q => !q.optional)
  const allAnswered = required.every(q =>
    q.type === 'select'
      ? !!answers[q.id]
      : (answers[q.id] ?? '').trim().length > 0
  )

  if (loading) return <Shell><p className="text-gray-400 text-sm">Loading...</p></Shell>

  if (error === 'already_submitted') return (
    <Shell>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Already submitted</h1>
      <p className="text-gray-500 text-sm">We already have your reference on file. Thank you!</p>
    </Shell>
  )

  if (error) return (
    <Shell>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Link not found</h1>
      <p className="text-gray-500 text-sm">This reference link is invalid or has expired.</p>
    </Shell>
  )

  return (
    <Shell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Reference for {info.candidate_name}
        </h1>
        <p className="text-sm text-gray-500">
          Hi {info.reference_name} — thanks for taking a few minutes to share your thoughts.
          {info.reference_relationship && ` Your response as ${info.reference_name}'s ${info.reference_relationship} means a lot.`}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {questions.map(q => (
          <div key={q.id}>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              {q.label}
              {q.optional && <span className="text-gray-400 font-normal ml-1">(optional)</span>}
            </label>
            {q.type === 'text' && (
              <input
                type="text"
                value={answers[q.id] ?? ''}
                onChange={e => set(q.id, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            {q.type === 'textarea' && (
              <textarea
                value={answers[q.id] ?? ''}
                onChange={e => set(q.id, e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            )}
            {q.type === 'select' && (
              <div className="flex flex-col gap-2">
                {q.options.map(opt => (
                  <label key={opt} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="radio"
                      name={q.id}
                      value={opt}
                      checked={answers[q.id] === opt}
                      onChange={() => set(q.id, opt)}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}

        <button
          type="submit"
          disabled={submitting || !allAnswered}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Submitting...' : 'Submit reference'}
        </button>
      </form>
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-16">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        {children}
      </div>
    </div>
  )
}
