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

/** The trailing run of (re-prompt, reply) pairs with no tool work, newest first. */
const trailingSpin = (messages: readonly Msg[]) => {
  const replies: string[] = []
  let i = messages.length - 1
  while (i >= 1) {
    const reply = messages[i], prompt = messages[i - 1]
    if (reply.role !== 'assistant' || prompt.role !== 'user') break
    if (!REPROMPT.test(prompt.text.trim())) break
    if ((reply.toolUses?.length ?? 0) > 0) break
    replies.push(reply.text)
    i -= 2
  }
  return replies
}

const allSimilar = (replies: string[]) => {
  for (let k = 1; k < replies.length; k++) if (similarity(replies[k - 1], replies[k]) < SIMILAR) return false
  return true
}

export const register: Register = on => {
  // At most one kill per 10 main-loop turns; -Infinity lets the first one through.
  let killedAt = -Infinity
  let turns = 0

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    turns++
    const messages = (await $.session.messages()) as readonly Msg[]
    const replies = trailingSpin(messages)
    const spinning = (replies.length >= SAME_REPLY_TURNS && allSimilar(replies)) || replies.length >= IDLE_TURNS
    if (!spinning || turns - killedAt < 10) return next(e)
    killedAt = turns
    const why = `loop-killer: ${replies.length} re-prompt turns with no tool work and the same reply; goal cleared.`
    try {
      await $.command.run({ command: 'goal', args: 'clear' })
      $.ui.toast(why)
      $.ui.log(why)
    } catch (error) {
      $.ui.log(`loop-killer: could not clear the goal: ${String(error)}`)
    }
    const done = await next(e)
    return { ...done, text: `${done.text}\n\n${why}` }
  })
}
