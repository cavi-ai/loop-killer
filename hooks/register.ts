import type { Register } from 'claude-code'

// The text a stop hook's re-prompt opens with.
const REPROMPT = /^(Stop hook feedback:|\[?Stop hook\b|Hook re-prompted)/i
// Spinning: this many trailing re-prompt turns whose replies say the same thing with no tool work ...
const SAME_REPLY_TURNS = 3
// ... or this many trailing re-prompt turns with no tool work at all, whatever the replies say.
const IDLE_TURNS = 6
const SIMILAR = 0.6

type Block = { type: string; [field: string]: unknown }
type Message = { role: string; content: readonly Block[] }

// Words are runs of letters or digits in any script, three or more characters long.
const words = (text: string) => new Set(
  text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter(w => [...w].length > 2),
)

const similarity = (a: string, b: string) => {
  const wa = words(a), wb = words(b)
  if (wa.size === 0 && wb.size === 0) return a.trim() === b.trim() ? 1 : 0
  let shared = 0
  for (const w of wa) if (wb.has(w)) shared++
  return shared / (wa.size + wb.size - shared || 1)
}

const texts = (message: Message) =>
  message.content.flatMap(b => (b.type === 'text' && typeof b.text === 'string' ? [b.text] : []))

// Any tool call: tool_use, server_tool_use, mcp_tool_use.
const usesTools = (message: Message) => message.content.some(b => b.type.endsWith('tool_use'))

const isReprompt = (message: Message) =>
  message.role === 'user' && texts(message).some(t => REPROMPT.test(t.trim()))

/**
 * The trailing (re-prompt, reply) pairs with no tool work, newest first, read from the Messages
 * API form: it keeps each re-prompt and each reply whole, which the rows view does not.
 */
const trailingSpin = (messages: readonly Message[]) => {
  const replies: string[] = []
  for (let i = messages.length - 1; i >= 1; i -= 2) {
    const reply = messages[i]!, prompt = messages[i - 1]!
    if (reply.role !== 'assistant' || usesTools(reply) || !isReprompt(prompt)) break
    replies.push(texts(reply).join('\n'))
  }
  return replies
}

const allSimilar = (replies: string[]) => replies.every((reply, k) => k === 0 || similarity(replies[k - 1]!, reply) >= SIMILAR)

export const register: Register = on => {
  on('turn.complete', async ($, e, next) => {
    // A subagent's turn, or one the person interrupted or an error ended, may not have added a
    // reply: its trailing run is not new.
    if (e.agentId !== undefined || e.reason !== 'answer') return next(e)
    const replies = trailingSpin(await $.session.messages({ as: 'api' }))
    const same = replies.length >= SAME_REPLY_TURNS && allSimilar(replies)
    if (!(same || replies.length >= IDLE_TURNS)) return next(e)
    const run = `loop-killer: ${replies.length} re-prompt turns with no tool work${same ? ' and the same reply' : ''}`
    let why: string
    try {
      await $.command.run({ command: 'goal', args: 'clear' })
      why = `${run}; goal cleared.`
    } catch (error) {
      why = `${run}; could not clear the goal: ${String(error)}`
    }
    $.ui.toast(why)
    $.ui.log(why)
    const done = await next(e)
    return { ...done, text: `${done.text}\n\n${why}` }
  })
}
