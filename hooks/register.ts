import type { Register } from 'claude-code'

// A turn the engine started from a stop hook's feedback, not from a person.
const REPROMPT = /^(Stop hook feedback:|\[?Stop hook\b|Hook re-prompted)/i
// Spinning: this many trailing re-prompt turns whose replies say the same thing with no tool work ...
const SAME_REPLY_TURNS = 3
// ... or this many trailing re-prompt turns with no tool work at all, whatever the replies say.
const IDLE_TURNS = 6
const SIMILAR = 0.6

type Msg = { role: string; text: string; toolUses?: readonly unknown[] }

const words = (text: string) => new Set(text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 2))

const similarity = (a: string, b: string) => {
  const wa = words(a), wb = words(b)
  if (wa.size === 0 && wb.size === 0) return 1
  let shared = 0
  for (const w of wa) if (wb.has(w)) shared++
  return shared / (wa.size + wb.size - shared || 1)
}

/**
 * The trailing replies to re-prompts with no tool work, newest first. The engine keeps a stop
 * hook's re-prompt out of the conversation, so a reply that directly follows another assistant
 * message answered one; a re-prompt that does appear as a user message counts the same.
 */
const trailingSpin = (messages: readonly Msg[]) => {
  const replies: string[] = []
  for (let i = messages.length - 1; i >= 1; i--) {
    const reply = messages[i], before = messages[i - 1]
    if (reply?.role !== 'assistant' || (reply.toolUses?.length ?? 0) > 0) break
    const reprompted = before?.role === 'assistant'
      || (before?.role === 'user' && REPROMPT.test(before.text.trim()))
    if (!reprompted) break
    replies.push(reply.text)
    if (before.role === 'user') i--
  }
  return replies
}

const allSimilar = (replies: string[]) => replies.every((reply, k) => k === 0 || similarity(replies[k - 1]!, reply) >= SIMILAR)

export const register: Register = on => {
  // At most one kill per 10 main-loop turns; -Infinity lets the first one through.
  let killedAt = -Infinity
  let turns = 0

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    turns++
    const messages = (await $.session.messages()) as readonly Msg[]
    const replies = trailingSpin(messages)
    const same = replies.length >= SAME_REPLY_TURNS && allSimilar(replies)
    if (!(same || replies.length >= IDLE_TURNS) || turns - killedAt < 10) return next(e)
    killedAt = turns
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
