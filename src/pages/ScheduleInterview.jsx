import { useLocation } from 'react-router-dom'

const BOOKING_URL = 'https://outlook.office.com/book/PozezJewishCommunityCenter@jccnv.org/?ismsaljsauthenabled'

export default function ScheduleInterview() {
  const { state } = useLocation()
  const firstName = state?.firstName

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">
            {firstName ? `Thanks, ${firstName}!` : 'You\'re all set!'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Schedule your interview below — pick whatever time works best for you.
          </p>
        </div>
      </div>

      {/* Booking iframe */}
      <div className="flex-1">
        <iframe
          src={BOOKING_URL}
          title="Schedule your interview"
          width="100%"
          style={{ height: 'calc(100vh - 89px)', border: 'none', display: 'block' }}
          scrolling="yes"
        />
      </div>
    </div>
  )
}
