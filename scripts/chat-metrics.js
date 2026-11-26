import { createInterface } from 'node:readline'

let chatRequests = 0
let chatTimeouts = 0
let cancelled = 0
let geminiAttempts = 0
let geminiTimeouts = 0
const firstCards = []

// Accept plain server logs and both Vercel CLI JSON formats.
for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  let entry
  try {
    const record = JSON.parse(line)
    const message = record?.data?.message ?? record?.message
    entry = typeof message === 'string' ? JSON.parse(message) : record
  } catch {
    continue
  }

  if (entry?.event === 'chat_request') {
    if (entry.outcome === 'cancelled') {
      cancelled += 1
      continue
    }
    chatRequests += 1
    if (entry.outcome === 'timeout') chatTimeouts += 1
    if (Number.isFinite(entry.firstCardsMs)) firstCards.push(entry.firstCardsMs)
  }
  if (entry?.event === 'provider_request' && entry.provider === 'Gemini') {
    geminiAttempts += 1
    if (entry.status === 504) geminiTimeouts += 1
  }
}

firstCards.sort((a, b) => a - b)
const percentile = fraction => firstCards[Math.ceil(firstCards.length * fraction) - 1] ?? null
const rate = (timeouts, total) => total ? Math.round(10_000 * timeouts / total) / 100 : null
console.log(JSON.stringify({
  chat: { requests: chatRequests, timeouts: chatTimeouts, timeoutRatePercent: rate(chatTimeouts, chatRequests), cancelled },
  firstCardsMs: { samples: firstCards.length, p50: percentile(0.5), p95: percentile(0.95) },
  gemini: { attempts: geminiAttempts, timeouts: geminiTimeouts, timeoutRatePercent: rate(geminiTimeouts, geminiAttempts) }
}, null, 2))
