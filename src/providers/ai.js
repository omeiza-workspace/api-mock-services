import { MockService, json } from '../harness.js'

/**
 * The AI providers.
 *
 * OpenAI and Anthropic, answered the way they answer — so an app can be
 * tested offline, for nothing, and without a key.
 *
 * The answers are made up, but the shapes are the real ones: the same
 * fields, the same names, the same meaning. A test that checks what the app
 * did with the answer works against the mock as it does against the real
 * thing.
 */

/** A random id, so every answer looks like a new one. */
const randomId = () => Math.random().toString(36).slice(2, 12)

/** The time the provider would say it made the answer. */
const now = () => Math.floor(Date.now() / 1000)

/** How many words are in this text — at least one, so the counts are never zero. */
const countWords = (text) => {
  const words = String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  return Math.max(1, words.length)
}

/** The text of a message, whether it was sent as a string or as parts. */
const textOf = (message) => {
  const content = message?.content

  if (typeof content === 'string') return content

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part?.type === 'text' && typeof part.text === 'string') return part.text

        return ''
      })
      .filter(Boolean)
      .join(' ')
  }

  return ''
}

/** The last thing the user said, if they said anything. */
const lastUserText = (messages) => {
  if (!Array.isArray(messages)) return ''

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]

    if (message?.role === 'user') return textOf(message)
  }

  return ''
}

/** Everything that was sent, as one piece of text. */
const wholePrompt = (messages) => {
  if (!Array.isArray(messages)) return ''

  return messages.map((message) => textOf(message)).join(' ')
}

/**
 * What the mock says back.
 *
 * A test can set `service.state.reply` to say exactly what it wants. If it
 * does not, a question that mentions JSON gets a JSON answer, and anything
 * else gets an answer that repeats the question — so a test can see the
 * reply was built from the prompt.
 */
const replyTo = (service, prompt) => {
  const chosen = service.state.reply

  if (typeof chosen === 'string' && chosen.length > 0) return chosen

  if (prompt && /\bjson\b/i.test(prompt)) {
    return JSON.stringify({ mock: true, prompt })
  }

  if (!prompt) return 'Mock reply.'

  return `Mock reply: ${prompt}`
}

/** The answer, a piece at a time, the way a streamed answer arrives. */
const streamTheAnswer = (res, { id, created, model, reply }) => {
  res.statusCode = 200
  res.setHeader('content-type', 'text/event-stream')
  res.setHeader('cache-control', 'no-cache')
  res.setHeader('connection', 'keep-alive')

  const chunk = (delta, finishReason) => ({
    id,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  })

  const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`)

  // Split on the spaces, and keep them, so the pieces put back together
  // make the answer exactly as it was.
  const pieces = String(reply)
    .split(/(\s+)/)
    .filter(Boolean)

  for (const piece of pieces) {
    send(chunk({ role: 'assistant', content: piece }, null))
  }

  send(chunk({}, 'stop'))
  res.write('data: [DONE]\n\n')
  res.end()
}

/**
 * OpenAI and Anthropic, in one mock.
 *
 * The models, the chat, the messages and the embeddings — the calls an app
 * makes. Set `service.state.reply` to choose what the answer says; leave it
 * alone and the answer is built from the question.
 */
export function createOpenAIMock() {
  const service = new MockService('openai')

  /** What the answer says, when a test wants it to say something exact. */
  service.state.reply = ''

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'openai-mock' })
  })

  service.on('GET', '/v1/models', (req, res) => {
    const created = now()

    json(res, 200, {
      object: 'list',
      data: [
        { id: 'gpt-4o-mini', object: 'model', created, owned_by: 'mock' },
        { id: 'gpt-4o', object: 'model', created, owned_by: 'mock' },
      ],
    })
  })

  service.on('POST', '/v1/chat/completions', (req, res) => {
    const body = req.json ?? {}
    const model = body.model ?? 'gpt-4o-mini'
    const messages = Array.isArray(body.messages) ? body.messages : []
    const prompt = wholePrompt(messages)
    const reply = replyTo(service, lastUserText(messages))

    const id = `chatcmpl-${randomId()}`
    const created = now()

    const promptTokens = countWords(prompt)
    const completionTokens = countWords(reply)

    // A streamed answer is the same answer, a piece at a time.
    if (body.stream === true) {
      streamTheAnswer(res, { id, created, model, reply })
      return
    }

    json(res, 200, {
      id,
      object: 'chat.completion',
      created,
      model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: reply },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
    })
  })

  service.on('POST', '/v1/messages', (req, res) => {
    const body = req.json ?? {}
    const model = body.model ?? 'claude-3-5-sonnet'
    const messages = Array.isArray(body.messages) ? body.messages : []
    const prompt = wholePrompt(messages)
    const reply = replyTo(service, lastUserText(messages))

    json(res, 200, {
      id: `msg_${randomId()}`,
      type: 'message',
      role: 'assistant',
      model,
      content: [{ type: 'text', text: reply }],
      stop_reason: 'end_turn',
      usage: {
        input_tokens: countWords(prompt),
        output_tokens: countWords(reply),
      },
    })
  })

  service.on('POST', '/v1/embeddings', (req, res) => {
    const body = req.json ?? {}
    const model = body.model ?? 'text-embedding-3-small'
    const input = Array.isArray(body.input) ? body.input.join(' ') : (body.input ?? '')
    const tokens = countWords(input)

    json(res, 200, {
      object: 'list',
      data: [
        {
          object: 'embedding',
          index: 0,
          embedding: [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08],
        },
      ],
      model,
      usage: { prompt_tokens: tokens, total_tokens: tokens },
    })
  })

  return service
}
