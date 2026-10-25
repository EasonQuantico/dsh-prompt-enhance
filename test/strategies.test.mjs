import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MODES,
  FOCUSES,
  VARIANT_IDS,
  FOCUS_IDS,
  METHODOLOGIES,
  FOCUS_RULES,
  OUTPUT_CONTRACT,
  VARIANT_RULES,
  methodologyById,
  methodologyCatalogue,
  selectMethodology,
  buildSystemPrompt,
} from '../strategies.js'

const METHODOLOGY_IDS = ['superpower', 'langgpt', 'aishort', 'prompt-optimizer']

test('two modes, four variants, labels are localised', () => {
  assert.deepEqual(
    MODES.map((mode) => mode.id),
    ['code', 'creative'],
  )
  assert.deepEqual(
    MODES.map((mode) => mode.variants.map((variant) => variant.id)),
    [
      ['code-read', 'code-only'],
      ['creative-rich', 'creative-structure'],
    ],
  )
  assert.deepEqual(VARIANT_IDS, ['code-read', 'code-only', 'creative-rich', 'creative-structure'])

  for (const mode of MODES) {
    assert.ok(mode.label, `mode ${mode.id} needs a label`)
    for (const variant of mode.variants) {
      assert.ok(variant.label, `variant ${variant.id} needs a label`)
      assert.ok(variant.hint, `variant ${variant.id} needs a hint`)
    }
  }
})

test('code modes expose exactly two focus areas', () => {
  assert.deepEqual(FOCUS_IDS, ['framework', 'security'])
  assert.deepEqual(
    FOCUSES.map((focus) => focus.id),
    FOCUS_IDS,
  )
  for (const focus of FOCUSES) {
    assert.ok(focus.label && focus.hint)
    assert.ok(Array.isArray(FOCUS_RULES[focus.id]) && FOCUS_RULES[focus.id].length > 0)
  }
})

test('four methodologies carry source, licence and principles', () => {
  assert.deepEqual(
    METHODOLOGIES.map((item) => item.id),
    METHODOLOGY_IDS,
  )
  for (const item of METHODOLOGIES) {
    assert.ok(item.label, `${item.id} label`)
    assert.ok(item.summary, `${item.id} summary`)
    assert.match(item.source, /github\.com\//, `${item.id} should credit a repository`)
    assert.ok(item.license, `${item.id} licence`)
    assert.ok(Array.isArray(item.principles) && item.principles.length >= 2, `${item.id} principles`)
    assert.ok(Array.isArray(item.keywords) && item.keywords.length >= 2, `${item.id} keywords`)
    assert.ok(item.codeSystem && item.codeSystem.length > 20, `${item.id} code fragment`)
    assert.ok(item.creativeSystem && item.creativeSystem.length > 20, `${item.id} creative fragment`)
  }
})

test('methodology lookup and catalogue stay in sync', () => {
  for (const id of METHODOLOGY_IDS) assert.equal(methodologyById(id)?.id, id)
  assert.equal(methodologyById('nope'), undefined)

  const catalogue = methodologyCatalogue()
  assert.equal(catalogue[0].id, 'auto')
  assert.equal(catalogue.length, METHODOLOGY_IDS.length + 1)
  for (const entry of catalogue.slice(1)) {
    assert.ok(entry.source && entry.license)
    assert.ok(Array.isArray(entry.principles))
    // Fragment text is host-only: the catalogue must not leak it to the browser.
    assert.equal('codeSystem' in entry, false)
    assert.equal('creativeSystem' in entry, false)
  }
})

test('explicit methodology request wins', () => {
  const choice = selectMethodology({
    mode: 'code',
    variant: 'code-read',
    focus: ['framework'],
    prompt: '重构批量重命名工具',
    requested: 'aishort',
  })
  assert.equal(choice.id, 'aishort')
  assert.match(choice.reason, /选择/)
})

test('unknown methodology falls back to automatic scoring', () => {
  const choice = selectMethodology({
    mode: 'code',
    variant: 'code-read',
    focus: ['security'],
    prompt: '重构批量重命名工具',
    requested: 'removed-in-v2',
  })
  assert.ok(METHODOLOGY_IDS.includes(choice.id))
  assert.match(choice.reason, /自动选择/)
})

test('automatic scoring matches each variant', () => {
  const cases = [
    ['code-read', ['security'], '把批量重命名图片的桌面小工具补全', 'superpower'],
    ['code-only', ['framework'], '做一个上传报销单自动提取金额的网页', 'prompt-optimizer'],
    ['creative-rich', [], '写一个雨夜咖啡馆的短片开头', 'langgpt'],
    ['creative-structure', [], '十二集悬疑剧的分集大纲', 'superpower'],
  ]

  for (const [variant, focus, prompt, expected] of cases) {
    const choice = selectMethodology({ mode: variant.startsWith('code') ? 'code' : 'creative', variant, focus, prompt })
    assert.equal(choice.id, expected, `${variant} should pick ${expected}, got ${choice.id}`)
  }
})

test('system prompt carries variant rules, focus rules and the output contract', () => {
  const promptText = '把批量重命名图片的桌面小工具补全'
  const text = buildSystemPrompt({
    mode: 'code',
    variant: 'code-read',
    focus: ['framework', 'security'],
    methodology: methodologyById('superpower'),
    methodologyReason: '测试理由',
    promptText,
  })

  assert.ok(text.includes(VARIANT_RULES['code-read'][0]))
  assert.ok(text.includes('开发框架维度必须覆盖'))
  assert.ok(text.includes('安全维度必须覆盖'))
  assert.ok(text.includes(OUTPUT_CONTRACT.split('\n')[0]))
  assert.ok(text.includes('不是让你现在去执行用户的任务'))
  assert.ok(text.includes('测试理由'))
  assert.ok(text.includes('用户原提示词语言：中文'))
})

test('code variants without a focus fall back to the framework axis', () => {
  const text = buildSystemPrompt({ mode: 'code', variant: 'code-only', promptText: '做个 CLI 工具' })
  assert.ok(text.includes('开发框架维度必须覆盖'))
  assert.equal(text.includes('安全维度必须覆盖'), false)
})

test('output language follows the draft language', () => {
  const english = buildSystemPrompt({ mode: 'creative', variant: 'creative-rich', promptText: 'write a rainy cafe scene' })
  assert.ok(english.includes('用户原提示词语言：English'))
  assert.ok(english.includes(VARIANT_RULES['creative-rich'][0]))
})

test('unknown variant degrades to the code-only rules', () => {
  const text = buildSystemPrompt({ mode: 'code', variant: 'from-the-future', promptText: 'x' })
  assert.ok(text.includes(VARIANT_RULES['code-only'][0]))
})

test('workspace digest is framed as read-only evidence', () => {
  const digest = {
    root: '/repo/demo',
    cwd: '/repo/demo',
    fileCount: 3,
    totalBytes: 2048,
    truncated: false,
    files: ['package.json', 'src/app.js'],
    manifest: 'name: demo-app\nversion: 1.0.0',
    tree: ['src/', '  app.js', 'package.json'],
    excerpts: [{ path: 'src/app.js', text: 'export function run(input) {}' }],
    security: {
      scanned: 2,
      findings: [{ rule: 'dangerous-eval', path: 'src/app.js', line: 2, snippet: 'eval(input)' }],
    },
  }

  const text = buildSystemPrompt({
    mode: 'code',
    variant: 'code-read',
    focus: ['security'],
    methodology: methodologyById('prompt-optimizer'),
    promptText: '补全这个项目',
    digest,
  })

  assert.ok(text.includes('## 工作区摘要'))
  assert.ok(text.includes('只读证据'))
  assert.ok(text.includes('根目录：/repo/demo'))
  assert.ok(text.includes('文件统计：共 3 个文件'))
  assert.ok(text.includes('#### src/app.js'))
  assert.ok(text.includes('dangerous-eval @ src/app.js:2'))
  assert.ok(text.includes('参考 https://github.com/linshenkx/prompt-optimizer'))
})

test('empty scan result says so instead of claiming safety', () => {
  const text = buildSystemPrompt({
    mode: 'code',
    variant: 'code-read',
    focus: ['framework'],
    promptText: '补全这个项目',
    digest: { root: '/repo', fileCount: 0, totalBytes: 0, files: [], security: { scanned: 0, findings: [] } },
  })
  assert.ok(text.includes('未命中内置启发式规则'))
  assert.ok(text.includes('不代表没有风险'))
})
