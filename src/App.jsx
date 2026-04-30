import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CandidateDetail from './pages/CandidateDetail'
import InterestForm from './pages/InterestForm'
import InterestFormSuccess from './pages/InterestFormSuccess'
import ApplicationForm from './pages/ApplicationForm'
import ApplicationSuccess from './pages/ApplicationSuccess'
import ReferenceForm from './pages/ReferenceForm'
import ReferenceSuccess from './pages/ReferenceSuccess'
import ScheduleInterview from './pages/ScheduleInterview'
import OfferAcceptance from './pages/OfferAcceptance'
import CandidateLogin from './pages/CandidateLogin'
import CandidatePortal from './pages/CandidatePortal'
import Settings from './pages/Settings'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public — candidate-facing */}
          <Route path="/apply" element={<InterestForm />} />
          <Route path="/apply/success" element={<InterestFormSuccess />} />
          <Route path="/schedule" element={<ScheduleInterview />} />
          <Route path="/application/:token" element={<ApplicationForm />} />
          <Route path="/application/success" element={<ApplicationSuccess />} />
          <Route path="/reference/:token" element={<ReferenceForm />} />
          <Route path="/reference/success" element={<ReferenceSuccess />} />
          <Route path="/offer/:token" element={<OfferAcceptance />} />
          <Route path="/candidate/login" element={<CandidateLogin />} />
          <Route path="/candidate" element={<CandidatePortal />} />

          {/* Auth */}
          <Route path="/login" element={<Login />} />

          {/* Hiring manager — protected */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/candidates/:id" element={<ProtectedRoute><CandidateDetail /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
