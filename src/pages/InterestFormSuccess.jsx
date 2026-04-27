import { useLocation } from 'react-router-dom'

export default function InterestFormSuccess() {
  const { state } = useLocation()
  const firstName = state?.firstName || 'there'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 shadow-sm">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            You're all set, {firstName}!
          </h1>
          <p className="text-gray-500 leading-relaxed text-sm">
            Your interest form has been received. You're guaranteed an interview —
            we'll be in touch soon to schedule it.
          </p>
        </div>
      </div>
    </div>
  )
}
