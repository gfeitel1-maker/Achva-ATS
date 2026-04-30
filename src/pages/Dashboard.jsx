import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import StageBadge from '../components/StageBadge'
import { STAGES, STAGE_FLOW, daysInStage, getInitials } from '../lib/stages'

const SORT_OPTIONS = [
  { value: 'newest',  label: 'Newest first' },
  { value: 'oldest',  label: 'Oldest first' },
  { value: 'az',      label: 'A → Z' },
  { value: 'updated', label: 'Recently updated' },
]

const EMPTY_ADD_FORM = { firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '', position: '' }

export default function Dashboard() {
  const navigate = useNavigate()
  const [cycle, setCycle]             = useState(null)
  const [records, setRecords]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [stageFilter, setStageFilter] = useState(null)
  const [search, setSearch]           = useState('')
  const [sort, setSort]               = useState('newest')
  const [showFilters, setShowFilters] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: cycleData } = await supabase
        .from('hiring_cycles').select('id, name').eq('is_active', true).single()
      if (!cycleData) { setLoading(false); return }
      setCycle(cycleData)

      const { data } = await supabase
        .from('pipeline_records')
        .select('id, candidate_id, current_stage, stage_entered_at, created_at, position, is_returning_staff, candidates(first_name, last_name, email)')
        .eq('hiring_cycle_id', cycleData.id)

      setRecords(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const stageCounts    = useMemo(() => {
    const counts = {}
    records.forEach(r => { counts[r.current_stage] = (counts[r.current_stage] ?? 0) + 1 })
    return counts
  }, [records])

  const returningCount = records.filter(r => r.is_returning_staff).length

  const filtered = useMemo(() => {
    let result = [...records]

    if (stageFilter) result = result.filter(r => r.current_stage === stageFilter)

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(r => {
        const c = r.candidates
        return `${c?.first_name} ${c?.last_name}`.toLowerCase().includes(q) ||
               c?.email?.toLowerCase().includes(q)
      })
    }

    result.sort((a, b) => {
      if (sort === 'newest')  return new Date(b.created_at) - new Date(a.created_at)
      if (sort === 'oldest')  return new Date(a.created_at) - new Date(b.created_at)
      if (sort === 'updated') return new Date(b.stage_entered_at) - new Date(a.stage_entered_at)
      if (sort === 'az') {
        const nameA = `${a.candidates?.last_name} ${a.candidates?.first_name}`.toLowerCase()
        const nameB = `${b.candidates?.last_name} ${b.candidates?.first_name}`.toLowerCase()
        return nameA.localeCompare(nameB)
      }
      return 0
    })

    return result
  }, [records, stageFilter, search, sort])

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{cycle?.name ?? 'Pipeline'}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {records.length} candidate{records.length !== 1 ? 's' : ''} · {returningCount} returning
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search candidates..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <button
            onClick={() => setShowFilters(v => !v)}
            title="Filter by stage"
            className={`p-2.5 rounded-lg border transition-colors ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-600' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2" />
            </svg>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add candidate
          </button>
        </div>
      </div>

      {/* Stage filter chips */}
      {showFilters && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setStageFilter(null)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${!stageFilter ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            All stages
          </button>
          {[...STAGE_FLOW, 'not_advancing'].map(s => (
            <button
              key={s}
              onClick={() => setStageFilter(stageFilter === s ? null : s)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${stageFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {STAGES[s]?.label}{stageCounts[s] ? ` · ${stageCounts[s]}` : ''}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* List header */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">
            {stageFilter ? STAGES[stageFilter]?.label : 'All Candidates'}
            <span className="text-gray-400 font-normal ml-1.5">{filtered.length}</span>
          </span>
          <div className="flex items-center gap-2">
            {stageFilter && (
              <button onClick={() => setStageFilter(null)} className="text-xs text-gray-400 hover:text-gray-600">
                Clear ×
              </button>
            )}
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            {records.length === 0
              ? 'No candidates yet. Share the interest form link to get started.'
              : 'No candidates match your filters.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(record => {
              const c    = record.candidates
              const days = daysInStage(record.stage_entered_at)
              return (
                <div
                  key={record.id}
                  onClick={() => navigate(`/candidates/${record.candidate_id}`)}
                  className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {getInitials(c?.first_name, c?.last_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{c?.first_name} {c?.last_name}</span>
                      {record.is_returning_staff && (
                        <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">returning</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{record.position || '—'}</p>
                  </div>
                  <StageBadge stage={record.current_stage} />
                  <span className={`text-sm font-medium w-8 text-right tabular-nums flex-shrink-0 ${days >= 5 ? 'text-red-500' : 'text-gray-400'}`}>
                    {days}d
                  </span>
                  <span className="text-gray-300 flex-shrink-0">→</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddCandidateModal
          cycleId={cycle?.id}
          onClose={() => setShowAddModal(false)}
          onAdded={record => {
            setRecords(prev => [record, ...prev])
            setShowAddModal(false)
          }}
        />
      )}
    </Layout>
  )
}

/* ── Add Candidate Modal ─────────────────────────────────────── */

function AddCandidateModal({ cycleId, onClose, onAdded }) {
  const navigate = useNavigate()
  const [form, setForm]       = useState(EMPTY_ADD_FORM)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)

  function set(field, value) { setForm(prev => ({ ...prev, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    const { firstName, lastName, email } = form
    if (!firstName || !lastName || !email) { setError('First name, last name, and email are required.'); return }
    if (!email.includes('@')) { setError('Please enter a valid email address.'); return }

    setSaving(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('manually_add_candidate', {
      p_first_name:    firstName,
      p_last_name:     lastName,
      p_email:         email,
      p_phone:         form.phone    || null,
      p_date_of_birth: form.dateOfBirth || null,
      p_position:      form.position || null,
    })

    setSaving(false)

    if (rpcError) { setError('Something went wrong. Please try again.'); return }
    if (data?.error === 'no_active_cycle') { setError('There is no active hiring cycle.'); return }
    if (data?.error === 'already_in_cycle') { setError('This candidate is already in the active cycle.'); return }

    // Build a record shape matching what the dashboard list expects so we can
    // insert it without a full reload.
    onAdded({
      id:               data.record_id,
      candidate_id:     data.candidate_id,
      current_stage:    'interest',
      stage_entered_at: new Date().toISOString(),
      created_at:       new Date().toISOString(),
      position:         form.position || null,
      is_returning_staff: false,
      candidates: {
        first_name: firstName,
        last_name:  lastName,
        email:      email.toLowerCase().trim(),
      },
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Add candidate</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ModalField label="First name *">
              <input type="text" value={form.firstName} onChange={e => set('firstName', e.target.value)}
                className={inputCls} autoFocus autoComplete="given-name" />
            </ModalField>
            <ModalField label="Last name *">
              <input type="text" value={form.lastName} onChange={e => set('lastName', e.target.value)}
                className={inputCls} autoComplete="family-name" />
            </ModalField>
          </div>

          <ModalField label="Email address *">
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              className={inputCls} autoComplete="email" />
          </ModalField>

          <div className="grid grid-cols-2 gap-3">
            <ModalField label="Phone">
              <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                className={inputCls} autoComplete="tel" />
            </ModalField>
            <ModalField label="Date of birth">
              <input type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)}
                className={inputCls} />
            </ModalField>
          </div>

          <ModalField label="Position / role">
            <input type="text" value={form.position} onChange={e => set('position', e.target.value)}
              className={inputCls} placeholder="e.g. Counselor" />
          </ModalField>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Adding...' : 'Add candidate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
