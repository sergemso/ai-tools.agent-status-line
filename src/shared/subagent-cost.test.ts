import { test, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { subagentCostUsd, addSubagentCost } from './subagent-cost.js'
import type { PriceTable } from './types.js'
import type { UnifiedStatusInput } from './unified-model.js'

const prices: PriceTable = { models: { 'Claude Haiku 5.5': { in: 1, out: 5 }, 'Claude Opus 5.5': { in: 4, out: 20 } } }

let dir: string
let transcript: string
const sessionId = 'sess-1'

const line = (id: string, model: string, usage: Record<string, unknown>) =>
  JSON.stringify({ type: 'assistant', message: { id, model, usage } })

function writeAgent(name: string, lines: string[]) {
  const sub = join(dir, sessionId, 'subagents')
  mkdirSync(sub, { recursive: true })
  writeFileSync(join(sub, `${name}.jsonl`), lines.join('\n') + '\n')
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'subcost-'))
  transcript = join(dir, `${sessionId}.jsonl`)
  writeFileSync(transcript, '')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

test('no subagents directory gives zero', async () => {
  expect(await subagentCostUsd(transcript, sessionId, prices)).toBe(0)
})

test('prices input, output, cache read and cache write per model', async () => {
  writeAgent('agent-a', [
    line('m1', 'claude-haiku-5-5', {
      input_tokens: 1_000_000, output_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
      cache_creation_input_tokens: 2_000_000,
      cache_creation: { ephemeral_5m_input_tokens: 1_000_000, ephemeral_1h_input_tokens: 1_000_000 },
    }),
  ])
  // 1 + 5 + 0.1 + 1.25 + 2
  expect(await subagentCostUsd(transcript, sessionId, prices)).toBeCloseTo(9.35, 5)
})

test('counts a message once even when its usage is repeated across lines', async () => {
  const l = line('m1', 'claude-opus-5-5', { input_tokens: 1_000_000, output_tokens: 0 })
  writeAgent('agent-a', [l, l])
  expect(await subagentCostUsd(transcript, sessionId, prices)).toBeCloseTo(4, 5)
})

test('sums across several subagents and skips unknown models and junk lines', async () => {
  writeAgent('agent-a', [line('m1', 'claude-haiku-5-5', { input_tokens: 1_000_000 }), 'not json'])
  writeAgent('agent-b', [line('m2', 'claude-opus-5-5', { output_tokens: 1_000_000 }), line('m3', 'mystery-model', { input_tokens: 9e9 })])
  expect(await subagentCostUsd(transcript, sessionId, prices)).toBeCloseTo(21, 5)
})

test('addSubagentCost adds to the reported session cost', async () => {
  writeAgent('agent-a', [line('m1', 'claude-haiku-5-5', { input_tokens: 1_000_000 })])
  const input = { sessionId, cost: { sessionCostUsd: 0.5, totalCostUsd: 0.5, currency: 'USD' } } as UnifiedStatusInput
  const out = await addSubagentCost(input, transcript, prices)
  expect(out.cost.sessionCostUsd).toBeCloseTo(1.5, 5)
  expect(out.cost.totalCostUsd).toBeCloseTo(1.5, 5)
})
