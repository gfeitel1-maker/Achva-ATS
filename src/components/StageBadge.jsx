import { STAGES } from '../lib/stages'

const COLOR_CLASSES = {
  gray:   'bg-gray-100 text-gray-600 border-gray-300',
  blue:   'bg-blue-50 text-blue-700 border-blue-300',
  cyan:   'bg-cyan-50 text-cyan-700 border-cyan-300',
  amber:  'bg-amber-50 text-amber-700 border-amber-300',
  purple: 'bg-purple-50 text-purple-700 border-purple-300',
  green:  'bg-green-50 text-green-700 border-green-300',
  pink:   'bg-pink-50 text-pink-700 border-pink-300',
  red:    'bg-red-50 text-red-600 border-red-300',
}

export default function StageBadge({ stage }) {
  const config = STAGES[stage]
  if (!config) return null
  const colorClass = COLOR_CLASSES[config.color] ?? COLOR_CLASSES.gray
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${colorClass}`}>
      {config.label}
    </span>
  )
}
