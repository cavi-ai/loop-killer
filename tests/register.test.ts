import type { On, SessionMessage } from 'claude-code'
import { expect, test, type Engine } from 'claude-code/testing'

const PROMPT = 'Stop hook feedback:\n[the goal is not met yet]: keep working.'
const REMINDER = '<system-reminder>\nThe output style is active.\n</system-reminder>'

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

type Block = { type: string; [field: string]: unknown }
type Message = { role: 'user' | 'assistant'; content: Block[] }

const text = (value: string): Block => ({ type: 'text', text: value })
const thinking: Block = { type: 'thinking', thinking: 'Deciding what to say.' }
const toolUse: Block = { type: 'tool_use', id: 'toolu_1', name: 'Bash', input: { command: 'ls' } }

const user = (...texts: string[]): Message => ({ role: 'user', content: texts.map(text) })
const toolResult: Message = { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'ok' }] }
/** A reply that thinks first, as a model with extended thinking answers; `withTool` adds a tool call. */
const reply = (value: string, withTool = false): Message => ({
  role: 'assistant',
  content: [thinking, text(value), ...(withTool ? [toolUse] : [])],
})

/** A conversation that ends in one re-prompt turn per entry; `true` marks a turn that used a tool. */
const spin = (replies: readonly (string | [string, true])[]): Message[] => [
  user('Ship the release.'),
  reply('Starting.'),
  ...replies.flatMap(r => {
    const [value, withTool] = typeof r === 'string' ? [r, false] : r
    return [user(REMINDER, PROMPT), reply(value, withTool), ...(withTool ? [toolResult] : [])]
  }),
]

const quiet: Message[] = [user('Ship the release.'), reply('Starting.')]

const isHidden = (message: Message) =>
  message.role === 'user'
  && message.content.every(b => b.type === 'text' && /^(<system-reminder>|Stop hook feedback:)/.test(String(b.text)))

/**
 * The rows `session.messages()` reports for the same conversation, as Claude Code builds them:
 * re-prompts and reminders left out, and each assistant block its own row.
 */
const rowsOf = (messages: readonly Message[]): SessionMessage[] =>
  messages.filter(m => !isHidden(m)).flatMap((m): SessionMessage[] => m.role === 'user'
    ? [{ role: 'user', text: m.content.filter(b => b.type === 'text').map(b => String(b.text)).join('\n'), toolUses: [] }]
    : m.content.map(b => ({
        role: 'assistant',
        text: b.type === 'text' ? String(b.text) : '',
        toolUses: b.type === 'tool_use'
          ? [{ tool_use_id: String(b.id), tool: String(b.name), input: b.input as Record<string, unknown> }]
          : [],
      })))

/** Stands in for the engine beneath the plugin; `calls` collects what the plugin asked it to do. */
const engine = (on: On, messages: Message[], failClear = false) => {
  const state = { messages }
  const calls = { commands: [] as string[], toasts: [] as string[] }
  on('session.messages', (_, e) => ({ value: e.as === 'api' ? state.messages : rowsOf(state.messages) }))
  on('command.run', (_, e) => {
    calls.commands.push(`${e.command} ${e.args}`)
    if (failClear) throw new Error('no active goal')
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
const complete = ($: Engine, options: { agentId?: string; reason?: 'answer' | 'aborted' | 'error' } = {}) =>
  $.turn.complete({
    answer: 'answer',
    durationMs: 1,
    isAborted: options.reason === 'aborted',
    turnId: `turn-${++turn}`,
    reason: options.reason ?? 'answer',
    ...(options.agentId === undefined ? {} : { agentId: options.agentId }),
  })

test('clears the goal after 3 similar re-prompt replies with no tool work', async ($, on) => {
  const { state, calls } = engine(on, quiet)
  await complete($)
  await complete($)
  state.messages = spin(SIMILAR)
  const done = await complete($)
  expect(calls.commands).toEqual(['goal clear'])
  expect(calls.toasts).toHaveLength(1)
  expect(done.text).toContain('3 re-prompt turns with no tool work and the same reply; goal cleared.')
})

test('clears the goal after 6 dissimilar re-prompt replies with no tool work', async ($, on) => {
  const { calls } = engine(on, spin(DISSIMILAR))
  const done = await complete($)
  expect(calls.commands).toEqual(['goal clear'])
  expect(done.text).toContain('6 re-prompt turns with no tool work; goal cleared.')
  expect(done.text).not.toContain('same reply')
})

test('reports a failed clear instead of claiming the goal was cleared', async ($, on) => {
  const { calls } = engine(on, spin(SIMILAR), true)
  const done = await complete($)
  expect(calls.commands).toEqual(['goal clear'])
  expect(calls.toasts).toHaveLength(1)
  expect(done.text).toContain('could not clear the goal')
  expect(done.text).not.toContain('goal cleared')
})

test('leaves the goal alone below the thresholds', async ($, on) => {
  const { state, calls } = engine(on, spin(SIMILAR.slice(0, 2)))
  await complete($)
  state.messages = spin(DISSIMILAR.slice(0, 5))
  await complete($)
  expect(calls.commands).toEqual([])
})

test('an answer that interleaves thinking and text is not a loop', async ($, on) => {
  const long: Message = { role: 'assistant', content: DISSIMILAR.flatMap(value => [thinking, text(value)]) }
  const { calls } = engine(on, [user('Explain the release.'), long])
  await complete($)
  expect(calls.commands).toEqual([])
})

test('a reply with a tool use breaks the run', async ($, on) => {
  const { state, calls } = engine(on, spin([SIMILAR[0]!, [SIMILAR[1]!, true], SIMILAR[2]!]))
  await complete($)
  state.messages = spin([...DISSIMILAR.slice(0, 3).map((r): [string, true] => [r, true]), ...DISSIMILAR.slice(3)])
  await complete($)
  expect(calls.commands).toEqual([])
})

test('a turn that is not a re-prompt breaks the run', async ($, on) => {
  const messages = spin(SIMILAR)
  messages.splice(4, 1, user('Please also update the changelog.'))
  const { calls } = engine(on, messages)
  await complete($)
  expect(calls.commands).toEqual([])
})

test('replies in another script that differ are not the same reply', async ($, on) => {
  const { calls } = engine(on, spin(['ビルドはまだ実行中です', '請求書の合計は一致しています', '庭の柵は塗り直しが必要です']))
  await complete($)
  expect(calls.commands).toEqual([])
})

test('near-identical replies in another alphabet are the same reply', async ($, on) => {
  const { calls } = engine(on, spin([
    'Сборка ещё идёт на удалённом сервере',
    'Сборка ещё идёт на удалённом сервере сейчас',
    'Сборка ещё идёт на удалённом сервере сегодня',
  ]))
  const done = await complete($)
  expect(calls.commands).toEqual(['goal clear'])
  expect(done.text).toContain('3 re-prompt turns with no tool work and the same reply')
})

test('short replies with no words count as the same reply only when equal', async ($, on) => {
  const { state, calls } = engine(on, spin(['OK.', 'No.', 'Hm.']))
  await complete($)
  expect(calls.commands).toEqual([])
  state.messages = spin(['OK.', 'OK.', 'OK.'])
  await complete($)
  expect(calls.commands).toEqual(['goal clear'])
})

test('ignores a subagent turn', async ($, on) => {
  const { calls } = engine(on, spin(SIMILAR))
  const done = await complete($, { agentId: 'agent-1' })
  expect(calls.commands).toEqual([])
  expect(done.text).toBe('answer')
})

test('an interrupted or failed turn leaves the goal alone', async ($, on) => {
  const { calls } = engine(on, spin(SIMILAR))
  await complete($, { reason: 'aborted' })
  await complete($, { reason: 'error' })
  expect(calls.commands).toEqual([])
})

test('allows the first kill on the first turn after load', async ($, on) => {
  const { calls } = engine(on, spin(SIMILAR))
  await complete($)
  expect(calls.commands).toEqual(['goal clear'])
})

test('clears a later loop without waiting 10 turns', async ($, on) => {
  const { state, calls } = engine(on, spin(SIMILAR))
  await complete($)
  state.messages = [...state.messages, user('Set a new goal.'), reply('Working on it.')]
  await complete($)
  state.messages = [...state.messages, ...SIMILAR.flatMap(value => [user(PROMPT), reply(value)])]
  await complete($)
  expect(calls.commands).toEqual(['goal clear', 'goal clear'])
})
