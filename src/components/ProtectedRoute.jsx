import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children }) {
  const { session } = useAuth()
  if (session === undefined) return null // still resolving session
  if (!session) return <Navigate to="/login" replace />
  return children
}
