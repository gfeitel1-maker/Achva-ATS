// Central pipeline stage config. Four stages + two terminal states.
// To add configurable pipelines in v2, replace this with a database read.

export const STAGES = {
  interest:      { label: 'Interest',      color: 'gray',  order: 1 },
  interview:     { label: 'Interview',     color: 'blue',  order: 2 },
  application:   { label: 'Application',   color: 'cyan',  order: 3 },
  offer:         { label: 'Offer',         color: 'green', order: 4 },
  hired:         { label: 'Hired',         color: 'green', order: 5 },
  not_advancing: { label: 'Not Advancing', color: 'red',   order: 6 },
  withdrawn:     { label: 'Withdrawn',     color: 'red',   order: 7 },
}

// Linear flow — one step forward, one step back.
export const STAGE_FLOW = ['interest', 'interview', 'application', 'offer', 'hired']

export function nextStage(current) {
  const i = STAGE_FLOW.indexOf(current)
  return i >= 0 && i < STAGE_FLOW.length - 1 ? STAGE_FLOW[i + 1] : null
}

export function prevStage(current) {
  const i = STAGE_FLOW.indexOf(current)
  return i > 0 ? STAGE_FLOW[i - 1] : null
}

export function isTerminal(stage) {
  return stage === 'not_advancing' || stage === 'withdrawn'
}

export function daysInStage(stageEnteredAt) {
  return Math.max(0, Math.floor((Date.now() - new Date(stageEnteredAt)) / 86400000))
}

export function getInitials(firstName, lastName) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase()
}
