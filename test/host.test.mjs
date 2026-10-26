import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { apply, VERSION } from '../index.js'

/* ------------------------------------------------------------------ */
/* fakes                                                              */
/* ------------------------------------------------------------------ */

function makeContext(options = {}) {
  const routes = []
  const disposers = []
  const logs = []
  const ctx = {
    logger: {
      info: (message) => logs.push(['info', String(message)]),
      warn: (message) => logs.push(['warn', String(message)]),
    },
    llm: {
      stream: (...args) => {
        if (options.stream) return options.stream(...args)
        return (async function* empty() {})()
      },
      listProviders: () => options.providers || [],
    },
    get: (name) => {
      if (name === 'agentDefaultModel') {
        if (options.selection === null) return undefined
        return { currentSelection: () => options.selection ?? { provider: 'session-provider', model: 'session-model' } }
      }
      if (name === 'workspaceRegistry') {
        if (options.projects === null) return undefined
        return { list: () => options.projects ?? [] }
      }
      return undefined
    },
    inject: (services, callback) => {
      assert.deepEqual(services, ['webServer'])
      callback({
        effect: (factory) => {
          const dispose = factory()
          disposers.push(dispose)
          return dispose
        },
        webServer: {
          register: (route) => {
            routes.push(route)
            return () => {
              route.disposed = true
            }
          },
        },
      })
    },
  }
  return { ctx, routes, disposers, logs }
}

function makeRequest(options = {}) {
  const {
    method = 'GET',
    url = '/prompt-enhance/api/state',
    headers = {},
    body,
    remoteAddress = '127.0.0.1',
  } = options

  const request = new EventEmitter()
  request.method = method
  request.url = url
  request.headers = { host: '127.0.0.1:2896', ...headers }
  request.socket = { remoteAddress }

  if (body !== undefined) {
    const payload = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))
    request.headers['content-type'] = request.headers['content-type'] || 'application/json'
    setImmediate(() => {
      request.emit('data', payload)
      request.emit('end')
    })
  }

  return request
}

function makeResponse() {
  const response = {
    statusCode: 0,
    headers: {},
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    chunks: [],
  }
  response.writeHead = (status, headers = {}) => {
    response.statusCode = status
    response.headers = headers
    response.headersSent = true
  }
  response.write = (chunk) => {
    response.chunks.push(String(chunk))
    return true
  }
  response.end = (chunk) => {
    if (chunk) response.chunks.push(String(chunk))
    response.writableEnded = true
  }
  response.text = () => response.chunks.join('')
  response.json = () => JSON.parse(response.text())
  response.sse = () => {
    const events = []
    for (const frame of response.text().split('\n\n')) {
      if (!frame.trim() || frame.startsWith(':') && !frame.includes('event:')) continue
      const name = frame.match(/^event: (.+)$/m)?.[1]
      const raw = frame.match(/^data: (.+)$/m)?.[1]
      if (!name) continue
      events.push({ event: name, data: raw ? JSON.parse(raw) : null })
    }
    return events
  }
  return response
}

function mount(options = {}) {
  const { ctx, routes, disposers, logs } = makeContext(options)
  apply(ctx, {
    provider: 'test-provider',
    model: 'test-model',
    maxPromptChars: 200,
    maxOutputTokens: 128,
    requestTimeoutMs: 5000,
    ...options.config,
  })
  assert.equal(routes.length, 1)
  return { handler: routes[0].handler, route: routes[0], disposers, logs, ctx }
}

async function call(handler, options) {
  const request = makeRequest(options)
  const response = makeResponse()
  await handler(request, response)
  return response
}

async function makeFixture() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-prompt-enhance-test-'))
  await mkdir(join(root, 'src'), { recursive: true })
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: 'fixture-app', version: '1.0.0', scripts: { test: 'node --test' } }, null, 2),
  )
  await writeFile(join(root, 'README.md'), '# fixture\n\nA tiny workspace used by the test suite.\n')
  await writeFile(
    join(root, 'src', 'app.js'),
    [
      "const apiKey = 'sk-live-abcdef1234567890'",
      'export function run(input) {',
      '  eval(input)',
      '}',
      '',
    ].join('\n'),
  )
  return root
}

/* ------------------------------------------------------------------ */
/* registration and guards                                            */
/* ------------------------------------------------------------------ */

test('apply registers one prefix route and exposes its disposer', () => {
  const { route, disposers, logs } = mount()
  assert.equal(route.kind, 'prefix')
  assert.equal(route.path, '/prompt-enhance/api')
  assert.equal(typeof route.handler, 'function')
  assert.equal(disposers.length, 1)
  assert.ok(logs.some(([, message]) => message.includes('mounted /prompt-enhance/api')))

  disposers[0]()
  assert.equal(route.disposed, true)
})

test('non-loopback callers are rejected before routing', async () => {
  const { handler } = mount()
  for (const remoteAddress of ['10.0.0.7', '192.168.1.9', '']) {
    const response = await call(handler, { remoteAddress })
    assert.equal(response.statusCode, 403)
    assert.equal(response.json().error.code, 'forbidden-origin')
  }
})

test('all loopback spellings are accepted', async () => {
  const { handler } = mount()
  for (const remoteAddress of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
    const response = await call(handler, { remoteAddress })
    assert.equal(response.statusCode, 200)
  }
})

test('POST requires same-origin and JSON content type', async () => {
  const { handler } = mount()

  const crossSite = await call(handler, {
    method: 'POST',
    url: '/prompt-enhance/api/presence',
    headers: { 'sec-fetch-site': 'cross-site' },
    body: { event: 'x' },
  })
  assert.equal(crossSite.statusCode, 403)

  const crossOrigin = await call(handler, {
    method: 'POST',
    url: '/prompt-enhance/api/presence',
    headers: { origin: 'http://evil.example' },
    body: { event: 'x' },
  })
  assert.equal(crossOrigin.statusCode, 403)

  const formPost = await call(handler, {
    method: 'POST',
    url: '/prompt-enhance/api/presence',
    headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'text/plain' },
    body: 'event=x',
  })
  assert.equal(formPost.statusCode, 415)
  assert.equal(formPost.json().error.code, 'unsupported-media-type')

  const sameOriginWithOrigin = await call(handler, {
    method: 'POST',
    url: '/prompt-enhance/api/presence',
    headers: { 'sec-fetch-site': 'same-origin', origin: 'http://127.0.0.1:2896' },
    body: { event: 'ok', detail: 'same-origin-with-header' },
  })
  assert.equal(sameOriginWithOrigin.statusCode, 200)
})

test('OPTIONS preflight is answered without CORS wildcards', async () => {
  const { handler } = mount()
  const response = await call(handler, { method: 'OPTIONS' })
  assert.equal(response.statusCode, 204)
  assert.equal(response.headers['access-control-allow-origin'], undefined)
  assert.match(response.headers['access-control-allow-methods'], /GET,POST,OPTIONS/)
})

test('unknown endpoints return 404', async () => {
  const { handler } = mount()
  const response = await call(handler, { url: '/prompt-enhance/api/nope' })
  assert.equal(response.statusCode, 404)
  assert.equal(response.json().error.code, 'not-found')
})

/* ------------------------------------------------------------------ */
/* /state                                                             */
/* ------------------------------------------------------------------ */

test('/state reports the route, workspace and vocabulary', async () => {
  const root = await makeFixture()
  try {
    const { handler } = mount({ projects: [{ root }] })
    const response = await call(handler)
    const body = response.json()

    assert.equal(response.statusCode, 200)
    assert.equal(response.headers['content-type'], 'application/json; charset=utf-8')
    assert.equal(body.ok, true)
    assert.equal(body.version, VERSION)
    assert.equal(body.provider, 'test-provider')
    assert.equal(body.model, 'test-model')
    assert.equal(body.modelSource, 'config')
    assert.equal(body.limits.maxPromptChars, 200)
    assert.equal(body.limits.maxDocumentChars, 16000)
    assert.deepEqual(
      body.modes.map((mode) => mode.id),
      ['code', 'creative', 'doc'],
    )
    assert.equal(body.methodologies.length, 5)
    assert.equal(body.methodologies[0].id, 'auto')
    assert.equal(body.client.beats, 0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('/state falls back to the session default model', async () => {
  const { handler } = mount({ config: { provider: '', model: '' } })
  const body = (await call(handler)).json()
  assert.equal(body.provider, 'session-provider')
  assert.equal(body.model, 'session-model')
})

test('/state survives a missing model route', async () => {
  const { handler } = mount({ config: { provider: '', model: '' }, selection: null, providers: [] })
  const body = (await call(handler)).json()
  assert.equal(body.modelSource, 'none')
  assert.equal(body.provider, '')
})

/* ------------------------------------------------------------------ */
/* /presence                                                          */
/* ------------------------------------------------------------------ */

test('/presence records beats that /state echoes back', async () => {
  const { handler } = mount()
  const post = await call(handler, {
    method: 'POST',
    url: '/prompt-enhance/api/presence',
    headers: { 'sec-fetch-site': 'same-origin' },
    body: { event: 'panel-open', detail: 'code/code-read' },
  })
  assert.equal(post.statusCode, 200)
  assert.deepEqual(post.json(), { ok: true })

  const state = (await call(handler)).json()
  assert.equal(state.client.beats, 1)
  assert.equal(state.client.recent.at(-1).event, 'panel-open')
  assert.equal(state.client.recent.at(-1).detail, 'code/code-read')
})

test('/presence truncates oversized fields', async () => {
  const { handler } = mount()
  await call(handler, {
    method: 'POST',
    url: '/prompt-enhance/api/presence',
    body: { event: 'e'.repeat(120), detail: 'd'.repeat(2000) },
  })
  const beat = (await call(handler)).json().client.recent.at(-1)
  assert.equal(beat.event.length, 40)
  assert.equal(beat.detail.length, 700)
})

/* ------------------------------------------------------------------ */
/* /enhance validation                                                */
/* ------------------------------------------------------------------ */

test('/enhance rejects bad requests with stable error codes', async () => {
  const cases = [
    [{ prompt: '' }, 400, 'empty-prompt'],
    [{ prompt: 'x'.repeat(201), mode: 'code', variant: 'code-only', focus: ['framework'] }, 413, 'prompt-too-long'],
    [{ prompt: 'hi', mode: 'video', variant: 'code-only', focus: ['framework'] }, 400, 'bad-mode'],
    [{ prompt: 'hi', mode: 'code', variant: 'code-something', focus: ['framework'] }, 400, 'bad-variant'],
    [{ prompt: 'hi', mode: 'code', variant: 'creative-rich' }, 400, 'mode-variant-mismatch'],
    [{ prompt: 'hi', mode: 'code', variant: 'code-only', focus: [] }, 400, 'empty-focus'],
    [{ prompt: 'hi', mode: 'code', variant: 'code-only', focus: ['coffee'] }, 400, 'empty-focus'],
    [
      { prompt: 'hi', mode: 'code', variant: 'code-only', focus: ['framework'], methodology: 'removed' },
      400,
      'bad-methodology',
    ],
  ]

  for (const [body, status, code] of cases) {
    const { handler } = mount()
    const response = await call(handler, {
      method: 'POST',
      url: '/prompt-enhance/api/enhance',
      headers: { 'sec-fetch-site': 'same-origin' },
      body,
    })
    assert.equal(response.statusCode, status, `${code} should return ${status}`)
    assert.equal(response.json().error.code, code)
  }
})

test('/enhance returns 503 when no model route exists', async () => {
  const { handler } = mount({ config: { provider: '', model: '' }, selection: null, providers: [] })
  const response = await call(handler, {
    method: 'POST',
    url: '/prompt-enhance/api/enhance',
    headers: { 'sec-fetch-site': 'same-origin' },
    body: { prompt: '补全工具', mode: 'code', variant: 'code-only', focus: ['framework'] },
  })
  assert.equal(response.statusCode, 503)
  assert.equal(response.json().error.code, 'no-model')
})

/* ------------------------------------------------------------------ */
/* /enhance streaming                                                 */
/* ------------------------------------------------------------------ */

function recordingStream(chunks) {
  const calls = []
  const stream = (...args) => {
    calls.push(args[0])
    return (async function* run() {
      for (const chunk of chunks) yield chunk
    })()
  }
  return { stream, calls }
}

test('/enhance streams meta, status, deltas and a tidied result', async () => {
  const root = await makeFixture()
  const { stream, calls } = recordingStream([
    { type: 'reasoning-delta', text: '先分析工作区' },
    { type: 'text-delta', text: '```markdown\n' },
    { type: 'text-delta', text: '以下是增强后的提示词：\n# 任务\n补全 fixture-app 的重命名工具\n```' },
    { type: 'usage', usage: { inputTokens: 10, outputTokens: 20 } },
    { type: 'finish', reason: { kind: 'stop' } },
  ])

  try {
    const { handler } = mount({ stream })
    const response = await call(handler, {
      method: 'POST',
      url: '/prompt-enhance/api/enhance',
      headers: { 'sec-fetch-site': 'same-origin' },
      body: {
        prompt: '把批量重命名图片的小工具补全',
        mode: 'code',
        variant: 'code-read',
        focus: ['framework', 'security'],
        cwd: root,
      },
    })

    assert.equal(response.statusCode, 200)
    assert.match(response.headers['content-type'], /^text\/event-stream/)
    assert.equal(response.headers['x-accel-buffering'], 'no')

    const events = response.sse()
    const meta = events.find((item) => item.event === 'meta').data
    assert.equal(meta.provider, 'test-provider')
    assert.equal(meta.mode, 'code')
    assert.equal(meta.variant, 'code-read')
    assert.equal(meta.methodology, 'superpower')
    assert.equal(meta.workspaceRoot, root)
    assert.equal(meta.workspaceSource, 'session')
    assert.ok(meta.workspaceFiles >= 3)
    assert.ok(meta.securityFindings >= 2)
    assert.equal(meta.promptChars, 14)

    assert.ok(events.some((item) => item.event === 'status' && item.data.stage === 'reasoning'))
    assert.ok(events.some((item) => item.event === 'status' && item.data.stage === 'text'))
    assert.equal(
      events
        .filter((item) => item.event === 'delta')
        .map((item) => item.data.text)
        .join(''),
      '```markdown\n以下是增强后的提示词：\n# 任务\n补全 fixture-app 的重命名工具\n```',
    )

    const done = events.find((item) => item.event === 'done').data
    assert.equal(done.text, '# 任务\n补全 fixture-app 的重命名工具')
    assert.equal(done.finish, 'stop')
    assert.equal(done.truncated, false)
    assert.deepEqual(done.usage, { inputTokens: 10, outputTokens: 20 })
    assert.equal(events.some((item) => item.event === 'error'), false)

    // The model receives a single user message that separates instruction from draft.
    const [requestArgs] = calls
    assert.equal(requestArgs.provider, 'test-provider')
    assert.equal(requestArgs.model, 'test-model')
    assert.equal(requestArgs.maxTokens, 128)
    assert.equal(requestArgs.messages.length, 1)
    assert.equal(requestArgs.messages[0].role, 'user')
    const payload = requestArgs.messages[0].content[0].text
    assert.match(payload, /^<增强指令>\n/)
    assert.match(payload, /<用户原提示词>\n把批量重命名图片的小工具补全\n<\/用户原提示词>$/)
    assert.ok(payload.includes('开发框架维度必须覆盖'))
    assert.ok(payload.includes('安全维度必须覆盖'))
    assert.ok(payload.includes('只读证据'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('/enhance honours an explicit methodology and keeps it out of workspace scans', async () => {
  const { stream } = recordingStream([{ type: 'text-delta', text: '结果' }, { type: 'finish', reason: { kind: 'stop' } }])
  const { handler } = mount({ stream })
  const response = await call(handler, {
    method: 'POST',
    url: '/prompt-enhance/api/enhance',
    headers: { 'sec-fetch-site': 'same-origin' },
    body: {
      prompt: '写一个雨夜咖啡馆的短片开头',
      mode: 'creative',
      variant: 'creative-rich',
      methodology: 'langgpt',
    },
  })
  const meta = response.sse().find((item) => item.event === 'meta').data
  assert.equal(meta.methodology, 'langgpt')
  assert.equal(meta.workspaceFiles, 0)
  assert.equal(meta.securityFindings, 0)
})

test('a max-tokens finish is reported as truncated', async () => {
  const { stream } = recordingStream([
    { type: 'text-delta', text: '半截结果' },
    { type: 'finish', reason: { kind: 'max-tokens' } },
  ])
  const { handler } = mount({ stream })
  const response = await call(handler, {
    method: 'POST',
    url: '/prompt-enhance/api/enhance',
    headers: { 'sec-fetch-site': 'same-origin' },
    body: { prompt: '补全', mode: 'code', variant: 'code-only', focus: ['framework'] },
  })
  const done = response.sse().find((item) => item.event === 'done').data
  assert.equal(done.truncated, true)
})

test('upstream failures become error events', async () => {
  const { handler } = mount({
    stream: () =>
      (async function* boom() {
        yield { type: 'text-delta', text: '部分' }
        throw new Error('provider exploded')
      })(),
  })
  const response = await call(handler, {
    method: 'POST',
    url: '/prompt-enhance/api/enhance',
    headers: { 'sec-fetch-site': 'same-origin' },
    body: { prompt: '补全', mode: 'code', variant: 'code-only', focus: ['framework'] },
  })
  const failure = response.sse().find((item) => item.event === 'error').data
  assert.equal(failure.code, 'upstream-failed')
  assert.match(failure.message, /provider exploded/)
})

test('an empty model answer becomes empty-result', async () => {
  const { stream } = recordingStream([{ type: 'finish', reason: { kind: 'stop' } }])
  const { handler } = mount({ stream })
  const response = await call(handler, {
    method: 'POST',
    url: '/prompt-enhance/api/enhance',
    headers: { 'sec-fetch-site': 'same-origin' },
    body: { prompt: '补全', mode: 'code', variant: 'code-only', focus: ['framework'] },
  })
  const failure = response.sse().find((item) => item.event === 'error').data
  assert.equal(failure.code, 'empty-result')
})

test('bad JSON bodies are rejected with 400', async () => {
  const { handler } = mount()
  const response = await call(handler, {
    method: 'POST',
    url: '/prompt-enhance/api/enhance',
    headers: { 'sec-fetch-site': 'same-origin' },
    body: '{"prompt":',
  })
  assert.equal(response.statusCode, 400)
})

/* ------------------------------------------------------------------ */
/* /workspace                                                         */
/* ------------------------------------------------------------------ */

test('/workspace scans the requested directory and reports heuristics', async () => {
  const root = await makeFixture()
  try {
    const { handler } = mount({ projects: null })
    const response = await call(handler, {
      url: `/prompt-enhance/api/workspace?refresh=1&cwd=${encodeURIComponent(root)}`,
    })
    const body = response.json()

    assert.equal(response.statusCode, 200)
    assert.equal(body.ok, true)
    assert.equal(body.root, root)
    assert.equal(body.source, 'session')
    assert.ok(body.fileCount >= 3)
    assert.ok(body.totalBytes > 0)
    assert.deepEqual(
      [...body.files].sort(),
      ['README.md', 'package.json', 'src/app.js'],
    )
    const rules = body.security.findings.map((finding) => finding.rule)
    assert.ok(rules.includes('dangerous-eval'))
    assert.ok(rules.includes('hardcoded-secret'))
    assert.ok(body.security.scanned >= 3)
    assert.equal(typeof body.durationMs, 'number')
    // Listing endpoints stay small: the digest internals are host-only.
    assert.equal('tree' in body, false)
    assert.equal('excerpts' in body, false)
    assert.equal('manifest' in body, false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('/workspace ignores a missing cwd and falls back', async () => {
  const { handler } = mount({ projects: null })
  const body = (await call(handler, { url: '/prompt-enhance/api/workspace?cwd=/definitely/not/here' })).json()
  assert.equal(body.ok, true)
  assert.ok(body.root)
  assert.notEqual(body.root, '/definitely/not/here')
})

/* ------------------------------------------------------------------ */
/* /cancel                                                            */
/* ------------------------------------------------------------------ */

test('/cancel is idempotent with no jobs in flight', async () => {
  const { handler } = mount()
  const response = await call(handler, {
    method: 'POST',
    url: '/prompt-enhance/api/cancel',
    headers: { 'sec-fetch-site': 'same-origin' },
    body: {},
  })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), { ok: true, cancelled: 0 })
})

/* ------------------------------------------------------------------ */
/* /documents                                                         */
/* ------------------------------------------------------------------ */

test('/documents lists readable documents and outlines the automatic pick', async () => {
  const root = await makeFixture()
  try {
    const { handler } = mount({ projects: null })
    const response = await call(handler, {
      url: `/prompt-enhance/api/documents?refresh=1&cwd=${encodeURIComponent(root)}`,
    })
    const body = response.json()

    assert.equal(response.statusCode, 200)
    assert.equal(body.ok, true)
    assert.equal(body.root, root)
    assert.equal(body.source, 'session')
    assert.deepEqual(
      body.documents.map((entry) => entry.path),
      ['README.md'],
    )
    assert.equal(body.total, 1)
    assert.ok(body.selected)
    assert.equal(body.selected.path, 'README.md')
    assert.ok(body.selected.chars > 0)
    assert.equal(body.selected.headings, 1)
    assert.deepEqual(
      body.selected.outline.map((item) => item.text),
      ['fixture'],
    )
    assert.match(body.selected.format.headingStyle, /ATX/)
    // Listing stays small: the document body never leaves the host.
    assert.equal('text' in body, false)
    assert.equal('selected' in body && 'text' in body.selected, false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('/documents honours an explicit path and ignores paths outside the workspace', async () => {
  const root = await makeFixture()
  try {
    await mkdir(join(root, 'docs'), { recursive: true })
    await writeFile(join(root, 'docs', 'guide.md'), '# 指南\n\n## 安装\n\n待补充。\n')
    const { handler } = mount({ projects: null })

    const inside = await call(handler, {
      url: `/prompt-enhance/api/documents?cwd=${encodeURIComponent(root)}&path=docs%2Fguide.md`,
    })
    const body = inside.json()
    assert.equal(body.selected.path, 'docs/guide.md')
    assert.deepEqual(
      body.selected.outline.map((item) => item.text),
      ['指南', '安装'],
    )
    assert.ok(body.documents.some((entry) => entry.path === 'docs/guide.md'))

    const outside = await call(handler, {
      url: `/prompt-enhance/api/documents?cwd=${encodeURIComponent(root)}&path=..%2Fescape.md`,
    })
    assert.equal(outside.statusCode, 200)
    assert.equal(outside.json().selected, null)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

/* ------------------------------------------------------------------ */
/* /enhance doc mode                                                  */
/* ------------------------------------------------------------------ */

test('/enhance doc-fill reads the document and frames it as evidence', async () => {
  const root = await makeFixture()
  try {
    await mkdir(join(root, 'docs'), { recursive: true })
    await writeFile(join(root, 'docs', 'guide.md'), '# 指南\n\n## 安装\n\n目前只有在线安装。\n\n## 常见问题\n\n待补充。\n')
    const { stream, calls } = recordingStream([
      { type: 'text-delta', text: '# 指南\n\n## 安装\n\n### 离线安装\n\n' },
      { type: 'finish', reason: { kind: 'stop' } },
      { type: 'usage', usage: { inputTokens: 30, outputTokens: 40 } },
    ])
    const { handler } = mount({ projects: null, stream })
    const response = await call(handler, {
      method: 'POST',
      url: '/prompt-enhance/api/enhance',
      headers: { 'sec-fetch-site': 'same-origin' },
      body: {
        prompt: '给安装章节补上离线安装，并在常见问题里补两条',
        mode: 'doc',
        variant: 'doc-fill',
        cwd: root,
      },
    })
    const events = response.sse()
    const meta = events.find((item) => item.event === 'meta').data

    assert.equal(response.statusCode, 200)
    assert.equal(meta.mode, 'doc')
    assert.equal(meta.variant, 'doc-fill')
    assert.equal(meta.documentPath, 'docs/guide.md')
    assert.ok(meta.documentChars > 0)
    assert.equal(meta.documentHeadings, 3)
    // Document digests are not workspace scans.
    assert.equal(meta.workspaceFiles, 0)
    assert.equal(meta.securityFindings, 0)
    assert.equal(meta.methodology, 'langgpt')

    const done = events.find((item) => item.event === 'done')
    assert.equal(done.data.finish, 'stop')

    const payload = calls[0].messages[0].content[0].text
    assert.match(payload, /^<增强指令>\n/)
    assert.match(payload, /<用户原提示词>\n给安装章节补上离线安装，并在常见问题里补两条\n<\/用户原提示词>$/)
    assert.ok(payload.includes('本次增强：文档类 / doc-fill'))
    assert.ok(payload.includes('## 文档摘要'))
    assert.ok(payload.includes('### 现有框架（标题大纲）'))
    assert.ok(payload.includes('### 格式特征'))
    assert.ok(payload.includes('文档类补充要求'))
    assert.ok(payload.includes('## 常见问题'))
    // Code-only instructions must not leak into document mode.
    assert.equal(payload.includes('## 工作区摘要'), false)
    assert.equal(payload.includes('开发框架维度必须覆盖'), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('/enhance doc-draft needs no document and says so in the digest slot', async () => {
  const { stream, calls } = recordingStream([{ type: 'text-delta', text: '# 季度复盘\n' }, { type: 'finish', reason: { kind: 'stop' } }])
  const { handler } = mount({ stream })
  const response = await call(handler, {
    method: 'POST',
    url: '/prompt-enhance/api/enhance',
    headers: { 'sec-fetch-site': 'same-origin' },
    body: { prompt: '写一份季度复盘文档', mode: 'doc', variant: 'doc-draft' },
  })
  const meta = response.sse().find((item) => item.event === 'meta').data
  assert.equal(meta.documentPath, '')
  assert.equal(meta.documentChars, 0)
  assert.equal(meta.methodology, 'langgpt')
  const payload = calls[0].messages[0].content[0].text
  assert.ok(payload.includes('本次增强：文档类 / doc-draft'))
  assert.equal(payload.includes('## 文档摘要'), false)
})

test('doc-fill error codes are explicit 400s', async () => {
  const root = await makeFixture()
  const empty = await mkdtemp(join(tmpdir(), 'pe-empty-'))
  try {
    const { handler } = mount({ projects: null })
    const post = (body) =>
      call(handler, {
        method: 'POST',
        url: '/prompt-enhance/api/enhance',
        headers: { 'sec-fetch-site': 'same-origin' },
        body: { mode: 'doc', variant: 'doc-fill', ...body },
      })

    const outside = await post({ prompt: '补写', cwd: root, docPath: '../escape.md' })
    assert.equal(outside.statusCode, 400)
    assert.equal(outside.json().error.code, 'doc-outside-root')

    const unsupported = await post({ prompt: '补写', cwd: root, docPath: 'package.json' })
    assert.equal(unsupported.statusCode, 400)
    assert.equal(unsupported.json().error.code, 'doc-unsupported')

    const missing = await post({ prompt: '补写', cwd: empty })
    assert.equal(missing.statusCode, 400)
    assert.equal(missing.json().error.code, 'no-document')
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(empty, { recursive: true, force: true })
  }
})

test('doc variants reject a mismatched mode and accept the code focuses check', async () => {
  const { handler } = mount()
  const mismatch = await call(handler, {
    method: 'POST',
    url: '/prompt-enhance/api/enhance',
    headers: { 'sec-fetch-site': 'same-origin' },
    body: { prompt: '补写', mode: 'doc', variant: 'code-read' },
  })
  assert.equal(mismatch.statusCode, 400)
  assert.equal(mismatch.json().error.code, 'mode-variant-mismatch')

  const badMode = await call(handler, {
    method: 'POST',
    url: '/prompt-enhance/api/enhance',
    headers: { 'sec-fetch-site': 'same-origin' },
    body: { prompt: '补写', mode: 'design', variant: 'doc-fill' },
  })
  assert.equal(badMode.statusCode, 400)
  assert.equal(badMode.json().error.code, 'bad-mode')
})
