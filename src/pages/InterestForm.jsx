import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const RESPONSE_OPTIONS = [
  { value: 'agree', label: 'Agree' },
  { value: 'neither', label: 'Neither' },
  { value: 'disagree', label: 'Disagree' },
]

const EMPTY_IDENTITY = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
}

export default function InterestForm() {
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [identity, setIdentity] = useState(EMPTY_IDENTITY)
  const [responses, setResponses] = useState({})

  useEffect(() => {
    supabase
      .from('interest_forms')
      .select('*')
      .eq('is_active', true)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setError('This form is not currently available.')
        else setForm(data)
        setLoading(false)
      })
  }, [])

  function setField(field, value) {
    setIdentity(prev => ({ ...prev, [field]: value }))
  }

  function setResponse(questionId, value) {
    setResponses(prev => ({ ...prev, [questionId]: value }))
  }

  function validate() {
    const { firstName, lastName, email, phone, dateOfBirth } = identity
    if (!firstName || !lastName || !email || !phone || !dateOfBirth)
      return 'Please fill out all contact fields.'
    if (!email.includes('@'))
      return 'Please enter a valid email address.'
    const unanswered = (form?.questions ?? []).filter(q => !responses[q.id])
    if (unanswered.length > 0)
      return 'Please answer all questions before submitting.'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setSubmitting(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('submit_interest_form', {
      p_first_name:       identity.firstName,
      p_last_name:        identity.lastName,
      p_email:            identity.email,
      p_phone:            identity.phone,
      p_date_of_birth:    identity.dateOfBirth,
      p_interest_form_id: form.id,
      p_responses:        responses,
    })

    setSubmitting(false)

    if (rpcError) {
      setError('Something went wrong. Please try again.')
      return
    }

    if (data?.error === 'already_applied') {
      setError('It looks like you already submitted an interest form for this season. Check your email for next steps.')
      return
    }

    if (data?.error === 'no_active_cycle') {
      setError('Applications are not currently open. Please check back later.')
      return
    }

    navigate('/schedule', { state: { firstName: identity.firstName } })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <p className="text-gray-500 text-center">{error}</p>
      </div>
    )
  }

  const questions = [...(form.questions ?? [])].sort((a, b) => a.order - b.order)

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Camp Achva</h1>
          <p className="text-gray-500 mt-1 text-sm">Staff Interest Form</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">

          {/* Intro text */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
            <p className="text-blue-900 text-sm leading-relaxed">{form.intro_text}</p>
          </div>

          {/* Identity fields */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">About you</h2>

            <div className="grid grid-cols-2 gap-4">
              <Field label="First name">
                <input
                  type="text"
                  value={identity.firstName}
                  onChange={e => setField('firstName', e.target.value)}
                  className={inputClass}
                  autoComplete="given-name"
                />
              </Field>
              <Field label="Last name">
                <input
                  type="text"
                  value={identity.lastName}
                  onChange={e => setField('lastName', e.target.value)}
                  className={inputClass}
                  autoComplete="family-name"
                />
              </Field>
            </div>

            <Field label="Email address">
              <input
                type="email"
                value={identity.email}
                onChange={e => setField('email', e.target.value)}
                className={inputClass}
                autoComplete="email"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Phone number">
                <input
                  type="tel"
                  value={identity.phone}
                  onChange={e => setField('phone', e.target.value)}
                  className={inputClass}
                  autoComplete="tel"
                />
              </Field>
              <Field label="Date of birth">
                <input
                  type="date"
                  value={identity.dateOfBirth}
                  onChange={e => setField('dateOfBirth', e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            {questions.map((question, index) => (
              <div key={question.id} className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-gray-900 text-sm leading-relaxed mb-4">
                  <span className="text-gray-400 font-medium mr-2">{index + 1}.</span>
                  {question.statement}
                </p>
                <div className="flex gap-2">
                  {RESPONSE_OPTIONS.map(option => {
                    const selected = responses[question.id] === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setResponse(question.id, option.value)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                          selected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {submitting ? 'Submitting...' : 'Submit Interest Form'}
          </button>

        </form>
      </div>
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

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
