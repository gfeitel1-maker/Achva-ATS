import { useLocation } from 'react-router-dom'

const BOOKING_URL = 'https://outlook.office.com/book/PozezJewishCommunityCenter@jccnv.org/?ismsaljsauthenabled'

export default function ScheduleInterview() {
  const { state } = useLocation()
  const firstName = state?.firstName

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">

        {/* Check mark */}
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {firstName ? `Thanks, ${firstName}!` : 'You\'re all set!'}
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          Your interest form has been submitted. The last step is to schedule your interview — pick whatever time works best for you.
        </p>

        <a
          href={BOOKING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-sm"
        >
          Schedule your interview →
        </a>

        <p className="text-xs text-gray-400 mt-4">
          Opens in a new tab. You can close this page after scheduling.
        </p>

        <p className="text-xs text-gray-400 mt-6">
          Check your email for a link to your applicant portal, or{' '}
          <a href="/candidate/login" className="text-blue-500 hover:underline">log in here</a>
          {' '}to track your application status.
        </p>
      </div>
    </div>
  )
}
