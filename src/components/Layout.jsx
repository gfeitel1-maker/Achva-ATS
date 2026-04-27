import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Layout({ children }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '??'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-[#0D2B3E] text-white px-6 h-12 flex items-center gap-6 flex-shrink-0">
        <span className="font-bold text-sm tracking-wide">Camp ATS</span>
        <div className="flex gap-5 ml-2">
          <NavLink to="/" active={location.pathname === '/'}>Dashboard</NavLink>
          <NavLink to="/settings" active={location.pathname === '/settings'}>Forms</NavLink>
        </div>
        <div className="ml-auto">
          <button
            onClick={handleSignOut}
            className="w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-400 flex items-center justify-center text-xs font-bold transition-colors"
            title={`Signed in as ${user?.email} — click to sign out`}
          >
            {initials}
          </button>
        </div>
      </nav>
      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        {children}
      </main>
    </div>
  )
}

function NavLink({ to, children, active }) {
  return (
    <Link
      to={to}
      className={`text-sm font-medium pb-0.5 transition-colors ${
        active
          ? 'text-white border-b-2 border-blue-400'
          : 'text-slate-300 hover:text-white'
      }`}
    >
      {children}
    </Link>
  )
}
