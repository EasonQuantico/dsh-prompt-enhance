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
  DEPTHS,
  DEPTH_IDS,
  METHODOLOGY_LENGTH,
  docOutputRule,
  depthBudget,
  methodologyById,
  methodologyCatalogue,
  selectMethodology,
  buildSystemPrompt,
} from '../strategies.js'

const METHODOLOGY_IDS = ['superpower', 'langgpt', 'aishort', 'prompt-optimizer']

test('three modes, six variants, labels are localised', () => {
  assert.deepEqual(
    MODES.map((mode) => mode.id),
    ['code', 'creative', 'doc'],
  )
  assert.deepEqual(
    MODES.map((mode) => mode.variants.map((variant) => variant.id)),
    [
      ['code-read', 'code-only'],
      ['creative-rich', 'creative-structure'],
      ['doc-fill', 'doc-draft'],
    ],
  )
  assert.deepEqual(VARIANT_IDS, ['code-read', 'code-only', 'creative-rich', 'creative-structure', 'doc-fill', 'doc-draft'])

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

test('doc variants route to a structural methodology', () => {
  const fill = selectMethodology({ mode: 'doc', variant: 'doc-fill', prompt: '把安装章节补全，保持表格列与编号不变' })
  assert.equal(fill.id, 'langgpt')

  const draft = selectMethodology({ mode: 'doc', variant: 'doc-draft', prompt: '写一份季度复盘' })
  assert.equal(draft.id, 'langgpt')

  const evidence = selectMethodology({ mode: 'doc', variant: 'doc-fill', prompt: '补充指标数据与引用出处' })
  assert.equal(evidence.id, 'prompt-optimizer')

  for (const variant of ['doc-fill', 'doc-draft']) {
    const choice = selectMethodology({ mode: 'doc', variant, requested: 'aishort' })
    assert.equal(choice.id, 'aishort')
  }
})

test('every methodology carries a document fragment but the catalogue hides it', () => {
  for (const item of METHODOLOGIES) {
    assert.equal(typeof item.docSystem, 'string')
    assert.ok(item.docSystem.length > 40, `${item.id} needs a document fragment`)
  }
  const catalogue = methodologyCatalogue()
  assert.equal(catalogue[0].id, 'auto')
  for (const entry of catalogue.slice(1)) {
    assert.equal('docSystem' in entry, false)
    assert.equal('codeSystem' in entry, false)
    assert.equal('creativeSystem' in entry, false)
  }
})

test('document digest is framed as read-only evidence', () => {
  const methodology = methodologyById('langgpt')
  const digest = {
    kind: 'document',
    root: '/workspace/demo',
    path: 'docs/guide.md',
    ext: 'md',
    chars: 120,
    lines: 12,
    headings: [
      { level: 1, text: '安装指南', line: 1 },
      { level: 2, text: '在线安装', line: 5 },
    ],
    format: { headingStyle: 'Markdown ATX（#）', maxDepth: 2, tables: 1, codeBlocks: 1, orderedLists: 0, unorderedLists: 2, links: 1, bold: 0, frontMatter: false, numbering: '1. / 1.1', avgParagraph: 40 },
    text: '# 安装指南\n\n## 在线安装\n\n运行安装命令。\n',
    truncated: false,
    candidates: [
      { path: 'README.md', chars: 300 },
      { path: 'docs/api.md', chars: 420 },
    ],
  }
  const system = buildSystemPrompt({
    mode: 'doc',
    variant: 'doc-fill',
    methodology,
    methodologyReason: '文档补写场景下 LangGPT 的结构化手法最贴合（自动选择）',
    promptText: '给安装指南补上离线安装',
    digest,
  })

  assert.ok(system.includes('本次增强：文档类 / doc-fill'))
  assert.ok(system.includes(`${methodology.docSystem.slice(0, 24)}`))
  assert.ok(system.includes('## 文档摘要'))
  assert.ok(system.includes('### 现有框架（标题大纲）'))
  assert.ok(system.includes('### 格式特征'))
  assert.ok(system.includes('### 工作区里的其他文档'))
  assert.ok(system.includes('## 在线安装'))
  assert.ok(system.includes('文档类补充要求'))
  assert.ok(system.includes('只读证据'))
  assert.equal(system.includes('## 工作区摘要'), false)
  assert.equal(system.includes('开发框架维度必须覆盖'), false)
  assert.equal(system.includes('安全维度必须覆盖'), false)
})

/* ------------------------------------------------------------------ */
/* depth levels                                                       */
/* ------------------------------------------------------------------ */

test('three depth levels all scale from the superpower yardstick', () => {
  assert.deepEqual(DEPTH_IDS, ['concise', 'default', 'thorough'])
  for (const entry of DEPTHS) {
    assert.equal(typeof entry.label, 'string')
    assert.ok(entry.hint.length > 0, `${entry.id} needs a hint`)
  }

  assert.equal(depthBudget({ depth: 'thorough', methodologyId: 'superpower' }), 4200)
  assert.equal(depthBudget({ depth: 'concise', methodologyId: 'superpower' }), 1428)

  for (const id of METHODOLOGY_IDS) {
    const concise = depthBudget({ depth: 'concise', methodologyId: id })
    const standard = depthBudget({ depth: 'default', methodologyId: id })
    const thorough = depthBudget({ depth: 'thorough', methodologyId: id })
    assert.ok(concise < standard && standard < thorough, `${id} must grow with the depth level`)
    assert.equal(thorough, Math.round(4200 * METHODOLOGY_LENGTH[id]))
  }

  // A level means the same percentile for every methodology, so a shorter
  // house style never overshoots the longer one at the same level.
  for (const depth of DEPTH_IDS) {
    const superpower = depthBudget({ depth, methodologyId: 'superpower' })
    const aishort = depthBudget({ depth, methodologyId: 'aishort' })
    assert.ok(aishort < superpower)
  }

  assert.equal(depthBudget({ depth: 'nonsense' }), depthBudget({ depth: 'default' }))
  assert.ok(depthBudget({ methodologyId: 'unknown-house' }) > 0)
})

test('the depth level rewrites the budget inside the system prompt', () => {
  const base = {
    mode: 'code',
    variant: 'code-read',
    focus: ['framework'],
    methodology: methodologyById('superpower'),
    methodologyReason: '自动选择',
    promptText: '把批量重命名图片的小工具补全',
  }

  const concise = buildSystemPrompt({ ...base, depth: 'concise' })
  const standard = buildSystemPrompt({ ...base, depth: 'default' })
  const thorough = buildSystemPrompt({ ...base, depth: 'thorough' })

  assert.ok(concise.includes('篇幅档位：简洁'))
  assert.ok(concise.includes('1428'))
  assert.ok(standard.includes('篇幅档位：默认'))
  assert.ok(standard.includes('2688'))
  assert.ok(thorough.includes('篇幅档位：严谨'))
  assert.ok(thorough.includes('4200'))

  // The instruction text grows slightly at the short end (it explains what to
  // drop first), so compare the budgets it quotes rather than the raw length.
  const quoted = (text) => Number(/硬上限 (\d+) 字/.exec(text)[1])
  assert.ok(quoted(concise) < quoted(standard) && quoted(standard) < quoted(thorough))
  // Shorter levels tell the model which methodology parts to drop first;
  // the thorough level has nothing to cut.
  assert.ok(concise.includes('先合并计划步骤'))
  assert.equal(thorough.includes('先合并计划步骤'), false)
})

test('a missing depth behaves like the default band', () => {
  const base = {
    mode: 'creative',
    variant: 'creative-rich',
    methodology: methodologyById('langgpt'),
    methodologyReason: '自动选择',
    promptText: '写一个雨夜咖啡馆的短片开头',
  }
  assert.equal(buildSystemPrompt(base), buildSystemPrompt({ ...base, depth: 'default' }))
  assert.equal(buildSystemPrompt({ ...base, depth: 'nonsense' }), buildSystemPrompt({ ...base, depth: 'default' }))
})

test('the document budget follows the same yardstick', () => {
  const langgpt = methodologyById('langgpt')
  const digest = {
    kind: 'document',
    root: '/tmp/fixture',
    cwd: '/tmp/fixture',
    path: 'README.md',
    chars: 1200,
    lines: 40,
    truncated: false,
    headings: [{ level: 1, text: '安装', line: 1 }],
    format: {},
    documents: [],
    text: '# 安装\n',
  }

  for (const depth of DEPTH_IDS) {
    const budget = depthBudget({ depth, methodologyId: 'langgpt' })
    const system = buildSystemPrompt({
      mode: 'doc',
      variant: 'doc-fill',
      methodology: langgpt,
      methodologyReason: '文档补写场景下 LangGPT 的结构化手法最贴合（自动选择）',
      promptText: '给安装指南补上离线安装',
      digest,
      depth,
    })
    assert.ok(system.includes(`整体不超过 ${budget} 字`), `${depth} should quote its own document budget`)
    assert.ok(system.includes(docOutputRule(budget)))
  }
})

