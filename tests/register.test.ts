import type { On, SessionMessage } from 'claude-code'
import { expect, test, type Engine } from 'claude-code/testing'

const PROMPT = 'Stop hook feedback: the goal is not met yet, keep working.'

const SIMILAR = [
  'Waiting on the owner to finish the remaining step before the goal can complete.',
  'Waiting on the owner to finish the remaining step before the goal can complete today.',
  'Waiting on the owner to finish the remaining step before the goal can complete now.',
]

const DISSIMILAR = [
  'The build is still running on the remote host.',
  'Rain is expected tomorrow across the northern provinces.',
  'Invoice totals match the ledger for every quarter.',
  'Three candidates remain on the shortlist after interviews.',
  'The garden fence needs fresh paint before winter arrives.',
  'Bread dough rises faster in a warm kitchen overnight.',
]

const user = (text: string): SessionMessage => ({ role: 'user', text, toolUses: [] })
const reply = (text: string, withTool = false): SessionMessage => ({
  role: 'assistant',
  text,
  toolUses: withTool ? [{ tool_use_id: 'toolu_1', tool: 'Bash', input: { command: 'ls' } }] : [],
})

/** A conversation that ends in one re-prompt turn per entry; `true` marks a turn that used a tool. */
const spin = (replies: readonly (string | [string, true])[]): SessionMessage[] => [
  user('Ship the release.'),
  reply('Starting.'),
  ...replies.flatMap(r => {
    const [text, withTool] = typeof r === 'string' ? [r, false] : r
    return [user(PROMPT), reply(text, withTool)]
  }),
]

const quiet: SessionMessage[] = [user('Ship the release.'), reply('Starting.')]

/** Stands in for the engine beneath the plugin; `calls` collects what the plugin asked it to do. */
const engine = (on: On, rows: SessionMessage[]) => {
  const state = { rows }
  const calls = { commands: [] as string[], toasts: [] as string[] }
  on('session.messages', () => ({ value: state.rows }))
  on('command.run', (_, e) => {
    calls.commands.push(`${e.command} ${e.args}`)
    return {}
  })
  on('ui.toast', (_, e) => {
    calls.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.log', () => ({ value: undefined }))
  on('turn.complete', () => ({ text: 'answer' }))
  return { state, calls }
}

let turn = 0
const complete = ($: Engine, agentId?: string) =>
  $.turn.complete({
    answer: 'answer',
    durationMs: 1,
    isAborted: false,
    turnId: `turn-${++turn}`,
    reason: 'answer',
    ...(agentId === undefined ? {} : { agentId }),
  })

test('clears the goal after 3 similar re-prompt replies with no tool work', async ($, on) => {
  const { state, calls } = engine(on, quiet)
  await complete($)
  await complete($)
  state.rows = spin(SIMILAR)
  const done = await complete($)
  expect(calls.commands).toEqual(['goal clear'])
  expect(calls.toasts).toHaveLength(1)
  expect(done.text).toContain('goal cleared')
})

test('clears the goal after 6 dissimilar re-prompt replies with no tool work', async ($, on) => {
  const { calls } = engine(on, spin(DISSIMILAR))
  await complete($)
  expect(calls.commands).toEqual(['goal clear'])
})

test('leaves the goal alone below the thresholds', async ($, on) => {
  const { state, calls } = engine(on, spin(SIMILAR.slice(0, 2)))
  await complete($)
  state.rows = spin(DISSIMILAR.slice(0, 5))
  await complete($)
  expect(calls.commands).toEqual([])
})

test('a reply with a tool use breaks the run', async ($, on) => {
  const { state, calls } = engine(on, spin([SIMILAR[0]!, [SIMILAR[1]!, true], SIMILAR[2]!]))
  await complete($)
  state.rows = spin([...DISSIMILAR.slice(0, 3).map((r): [string, true] => [r, true]), ...DISSIMILAR.slice(3)])
  await complete($)
  expect(calls.commands).toEqual([])
})

test('a turn that is not a re-prompt breaks the run', async ($, on) => {
  const rows = spin(SIMILAR)
  rows.splice(4, 1, user('Please also update the changelog.'))
  const { calls } = engine(on, rows)
  await complete($)
  expect(calls.commands).toEqual([])
})

test('ignores a subagent turn', async ($, on) => {
  const { calls } = engine(on, spin(SIMILAR))
  const done = await complete($, 'agent-1')
  expect(calls.commands).toEqual([])
  expect(done.text).toBe('answer')
})

test('allows the first kill on the first turn after load', async ($, on) => {
  const { calls } = engine(on, spin(SIMILAR))
  await complete($)
  expect(calls.commands).toEqual(['goal clear'])
})

test('clears at most once in 10 turns', async ($, on) => {
  const { calls } = engine(on, spin(SIMILAR))
  await complete($)
  for (let i = 0; i < 9; i++) await complete($)
  expect(calls.commands).toEqual(['goal clear'])
  await complete($)
  expect(calls.commands).toEqual(['goal clear', 'goal clear'])
})
