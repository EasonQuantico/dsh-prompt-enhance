/**
 * dsh-prompt-enhance — host half.
 *
 * Mounted by the bundle patch row `prompt-enhance`. Registers a small JSON/SSE API
 * under `/prompt-enhance/api` that the browser half (`client.js`) calls from the
 * composer dock. The API is *outside* the harness `/api/*` auth middleware, so every
 * request is gated by loopback + same-origin + JSON content-type checks.
 */

import { readFile, readdir, stat } from 'node:fs/promises'
import { join, resolve, relative, sep, extname, basename, isAbsolute } from 'node:path'
import {
  MODES,
  FOCUSES,
  METHODOLOGIES,
  VARIANT_IDS,
  FOCUS_IDS,
  buildSystemPrompt,
  methodologyById,
  methodologyCatalogue,
  selectMethodology,
} from './strategies.js'

export const VERSION = '1.0.0'
/** `llm` is required for the enhance route; `webServer` is injected locally below. */
export const inject = ['llm']
const ROUTE_PREFIX = '/prompt-enhance/api'
const PLUGIN_ID = 'prompt-enhance'

const DEFAULTS = {
  workspaceRoot: '',
  provider: '',
  model: '',
  maxPromptChars: 12000,
  maxWorkspaceBytes: 60000,
  maxWorkspaceFiles: 40,
  maxOutputTokens: 8000,
  requestTimeoutMs: 180000,
}

const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit',
  'coverage', 'target', 'vendor', '__pycache__', '.venv', 'venv', 'env', '.idea', '.vscode',
  '.turbo', '.gradle', '.mypy_cache', '.pytest_cache', '.ruff_cache', 'obj', 'tmp', 'temp',
  'dsh-src', 'asar-out', 'asar-out2', '.cache', 'Pods', 'DerivedData', '.terraform',
])

const IGNORED_FILE_RE = /(^\.DS_Store$)|(\.(lock|log|png|jpe?g|gif|webp|ico|bmp|pdf|zip|gz|tgz|7z|rar|mp3|mp4|mov|avi|wav|woff2?|ttf|otf|eot|so|dylib|dll|exe|bin|class|jar|pyc|pyo|whl|wasm|map)$)/i

const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.mts', '.cts', '.py', '.rb', '.go', '.rs', '.java',
  '.kt', '.kts', '.c', '.h', '.cc', '.cpp', '.hpp', '.cs', '.php', '.swift', '.lua', '.sh', '.bash',
  '.zsh', '.ps1', '.psm1', '.bat', '.cmd', '.sql', '.json', '.json5', '.jsonc', '.yml', '.yaml',
  '.toml', '.ini', '.cfg', '.conf', '.env', '.md', '.mdx', '.txt', '.html', '.htm', '.css', '.scss',
  '.less', '.vue', '.svelte', '.astro', '.gradle', '.xml', '.dockerfile', '.gitignore', '.npmrc',
  '.editorconfig', '.properties', '.graphql', '.gql', '.proto', '.sol', '.dart', '.ex', '.exs',
])

const PRIORITY_NAMES = new Set([
  'package.json', 'README.md', 'README.zh.md', 'tsconfig.json', 'pyproject.toml', 'Cargo.toml',
  'go.mod', 'requirements.txt', 'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
  'Makefile', 'AGENTS.md', 'CLAUDE.md', 'CONTRIBUTING.md', 'composer.json', 'pom.xml',
  'build.gradle', 'build.gradle.kts', 'Gemfile', 'mix.exs', 'deno.json', 'vite.config.ts',
  'vite.config.js', 'next.config.js', 'next.config.mjs', 'index.html', 'main.py', 'app.py',
  'server.js', 'server.ts', 'index.js', 'index.ts', 'main.go', 'main.rs', 'src/main.rs',
  'src/index.ts', 'src/index.js', 'src/app.ts', 'src/app.tsx',
])

const SECURITY_RULES = [
  { rule: 'dangerous-eval', re: /\beval\s*\(|new\s+Function\s*\(/, severity: 'high' },
  { rule: 'command-exec', re: /\b(child_process|execSync|execFileSync|os\.system|subprocess\.(?:call|run|Popen)[^\n]*shell\s*=\s*True)/, severity: 'high' },
  { rule: 'html-injection-sink', re: /\bdangerouslySetInnerHTML\b|\.innerHTML\s*=|document\.write\s*\(/, severity: 'medium' },
  { rule: 'hardcoded-secret', re: /\b(api[_-]?key|secret|passwd|password|access[_-]?token|private[_-]?key)\b\s*[:=]\s*['"][A-Za-z0-9_\-./+=]{12,}['"]/i, severity: 'high' },
  { rule: 'unsafe-deserialization', re: /\bpickle\.loads?\s*\(|\byaml\.load\s*\((?![^)\n]*SafeLoader)|marshal\.loads?\s*\(/, severity: 'high' },
  { rule: 'tls-verification-disabled', re: /verify\s*=\s*False|rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0/, severity: 'high' },
  { rule: 'permissive-cors', re: /Access-Control-Allow-Origin['"]?\s*[:=]\s*['"]\*['"]/, severity: 'medium' },
  { rule: 'world-writable', re: /\bchmod\s+777|0o?777\b/, severity: 'medium' },
  { rule: 'weak-hash', re: /\b(md5|sha1)\s*\(|createHash\(\s*['"](?:md5|sha1)['"]\s*\)/i, severity: 'low' },
  { rule: 'sql-concat', re: /(?:SELECT|INSERT|UPDATE|DELETE)[^;\n]{0,120}(?:\+\s*\w|\$\{|['"]\s*\+\s*\w)/i, severity: 'medium' },
]

/* ------------------------------------------------------------------ */
/* small HTTP helpers                                                  */
/* ------------------------------------------------------------------ */

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  response.end(body)
}

function sendError(response, status, code, message) {
  sendJson(response, status, { ok: false, error: { code, message } })
}

function isLoopback(request) {
  const address = request.socket?.remoteAddress || ''
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

function isSameOrigin(request) {
  const site = String(request.headers['sec-fetch-site'] || '')
  if (site && site !== 'same-origin' && site !== 'none') return false
  const origin = request.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === request.headers.host
  } catch {
    return false
  }
}

function hasJsonContentType(request) {
  return String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')
}

function readBody(request, limit = 262144) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = []
    let size = 0
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        rejectPromise(Object.assign(new Error('请求体过大'), { status: 413 }))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolvePromise(raw ? JSON.parse(raw) : {})
      } catch {
        rejectPromise(Object.assign(new Error('请求体不是合法 JSON'), { status: 400 }))
      }
    })
    request.on('error', (error) => rejectPromise(Object.assign(error, { status: 400 })))
  })
}

/* ------------------------------------------------------------------ */
/* workspace scanning                                                  */
/* ------------------------------------------------------------------ */

function normalizeSlashes(value) {
  return String(value).split(sep).join('/')
}

function isTextFile(name) {
  const ext = extname(name).toLowerCase()
  if (TEXT_EXTENSIONS.has(ext)) return true
  return /^(dockerfile|makefile|gemfile|rakefile|procfile)$/i.test(name) || name.startsWith('.env')
}

function priorityScore(rel) {
  const name = basename(rel)
  const parts = rel.split('/')
  let score = 0
  if (PRIORITY_NAMES.has(name)) score += 12
  if (PRIORITY_NAMES.has(rel)) score += 6
  if (parts.length <= 2) score += 3
  if (parts[0] === 'src' || parts[0] === 'app' || parts[0] === 'lib' || parts[0] === 'packages' || parts[0] === 'cmd' || parts[0] === 'internal') score += 4
  if (/\.(md|mdx|json|toml|ya?ml)$/i.test(name)) score += 1
  if (/\.(test|spec)\.[a-z]+$/i.test(name)) score -= 2
  return score
}

function pickRoot(ctx, config) {
  if (config.workspaceRoot) return { root: resolve(String(config.workspaceRoot)), source: 'config' }
  try {
    const registry = ctx.get('workspaceRegistry')
    const list = registry && typeof registry.list === 'function' ? registry.list() : null
    if (Array.isArray(list) && list.length) {
      for (const entry of list) {
        const candidate = entry && (entry.directory || entry.cwd || entry.path || entry.dir || entry.root)
        if (typeof candidate === 'string' && candidate) return { root: resolve(candidate), source: 'registry' }
      }
    }
  } catch {
    /* registry optional */
  }
  return { root: process.cwd(), source: 'cwd' }
}

/**
 * Resolve the directory to read. A caller-supplied absolute directory (the live
 * session cwd, sent by the browser half) wins over the configured/registry root,
 * because that is the workspace the user is actually looking at.
 */
async function resolveWorkspace(ctx, config, candidate) {
  const fallback = pickRoot(ctx, config)
  if (typeof candidate === 'string' && candidate.trim()) {
    const trimmed = candidate.trim()
    if (isAbsolute(trimmed)) {
      const absolute = resolve(trimmed)
      try {
        const info = await stat(absolute)
        if (info.isDirectory()) {
          return {
            root: absolute,
            source: absolute === fallback.root ? fallback.source : 'session',
          }
        }
      } catch {
        /* fall through to the configured root */
      }
    }
  }
  return fallback
}

async function walkFiles(root, budget) {  const files = []
  const ignored = new Set()
  let fileCount = 0
  let truncated = false
  const maxVisited = 6000

  const visit = async (dir, depth) => {
    if (truncated || depth > 7) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    entries.sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1))
    for (const entry of entries) {
      if (truncated) return
      const full = join(dir, entry.name)
      const rel = normalizeSlashes(relative(root, full))
      if (!rel || rel.startsWith('..')) continue
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) {
          ignored.add(entry.name)
          continue
        }
        await visit(full, depth + 1)
        continue
      }
      if (!entry.isFile()) continue
      if (IGNORED_FILE_RE.test(entry.name) || entry.name.endsWith('.min.js') || entry.name.endsWith('.min.css')) continue
      fileCount += 1
      if (files.length < budget.maxFiles) files.push(rel)
      if (fileCount >= maxVisited) {
        truncated = true
        return
      }
    }
  }

  await visit(root, 0)
  return { files, ignored, fileCount, truncated }
}

async function readText(fullPath, limit) {
  try {
    const info = await stat(fullPath)
    if (!info.isFile() || info.size > 256 * 1024) return ''
    const text = await readFile(fullPath, 'utf8')
    return text.length > limit ? `${text.slice(0, limit)}\n…（已截断 ${text.length - limit} 字符）` : text
  } catch {
    return ''
  }
}

function summarizeManifest(root, files) {
  const pkgRel = files.find((rel) => rel === 'package.json' || rel.endsWith('/package.json'))
  if (!pkgRel) return ''
  return readText(join(root, pkgRel), 4000).then((text) => {
    if (!text) return ''
    try {
      const pkg = JSON.parse(text.replace(/…（已截断 \d+ 字符）$/, ''))
      const deps = Object.keys(pkg.dependencies || {})
      const devDeps = Object.keys(pkg.devDependencies || {})
      const scripts = Object.keys(pkg.scripts || {})
      const lines = [`name: ${pkg.name || '?'}`, `version: ${pkg.version || '?'}`]
      if (pkg.packageManager) lines.push(`packageManager: ${pkg.packageManager}`)
      if (Object.keys(pkg.dependencies || {}).length) lines.push(`dependencies: ${deps.slice(0, 40).join(', ')}`)
      if (Object.keys(pkg.devDependencies || {}).length) lines.push(`devDependencies: ${devDeps.slice(0, 40).join(', ')}`)
      if (scripts.length) lines.push(`scripts: ${scripts.slice(0, 30).join(', ')}`)
      return lines.join('\n')
    } catch {
      return text.slice(0, 1200)
    }
  })
}

function scanSecurity(entries) {
  const findings = []
  for (const entry of entries) {
    const lines = entry.text.split('\n')
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      if (line.length > 400) continue
      for (const rule of SECURITY_RULES) {
        if (!rule.re.test(line)) continue
        findings.push({
          rule: rule.rule,
          severity: rule.severity,
          path: entry.path,
          line: index + 1,
          snippet: line.trim().slice(0, 160),
        })
        if (findings.length >= 40) return findings
        break
      }
    }
  }
  return findings
}

async function collectWorkspace(root, limits) {
  const startedAt = Date.now()
  const { files, ignored, fileCount, truncated } = await walkFiles(root, { maxFiles: Math.max(limits.maxWorkspaceFiles, 200) })

  const ranked = [...files].sort((a, b) => priorityScore(b) - priorityScore(a) || a.length - b.length)
  const excerptTargets = ranked.filter((rel) => isTextFile(basename(rel))).slice(0, 10)

  // Security scan covers a wider but still bounded set of small text files.
  const scanTargets = ranked.filter((rel) => isTextFile(basename(rel))).slice(0, 60)
  const scanEntries = []
  let scannedBytes = 0
  for (const rel of scanTargets) {
    const text = await readText(join(root, rel), 24000)
    if (!text) continue
    scannedBytes += text.length
    scanEntries.push({ path: rel, text })
    if (scannedBytes > 900 * 1024) break
  }

  const excerpts = []
  let usedBytes = 0
  for (const rel of excerptTargets) {
    const remaining = limits.maxWorkspaceBytes - usedBytes
    if (remaining <= 500) break
    const text = await readText(join(root, rel), Math.min(3500, remaining))
    if (!text) continue
    usedBytes += text.length
    excerpts.push({ path: rel, text })
  }

  const manifest = await summarizeManifest(root, files)

  const tree = []
  const seenDirs = new Set()
  for (const rel of ranked.slice(0, Math.min(files.length, 120))) {
    const parts = rel.split('/')
    for (let depth = 1; depth < parts.length; depth += 1) {
      const dir = parts.slice(0, depth).join('/')
      if (seenDirs.has(dir)) continue
      seenDirs.add(dir)
      tree.push(`${'  '.repeat(depth - 1)}${parts[depth - 1]}/`)
      if (tree.length >= 60) break
    }
    if (tree.length >= 60) break
    tree.push(`${'  '.repeat(parts.length - 1)}${parts[parts.length - 1]}`)
  }

  return {
    root,
    cwd: root,
    fileCount,
    totalBytes: scannedBytes + usedBytes,
    truncated,
    files: ranked.slice(0, limits.maxWorkspaceFiles),
    ignored: [...ignored].sort(),
    tree,
    manifest,
    excerpts,
    security: { findings: scanSecurity(scanEntries), scanned: scanEntries.length },
    durationMs: Date.now() - startedAt,
  }
}

/* ------------------------------------------------------------------ */
/* model route                                                        */
/* ------------------------------------------------------------------ */

async function resolveRoute(ctx, config) {
  if (config.provider && config.model) {
    return { provider: config.provider, model: config.model, source: 'config' }
  }
  try {
    const selector = ctx.get('agentDefaultModel')
    const selection = selector && typeof selector.currentSelection === 'function' ? await selector.currentSelection() : null
    if (selection && selection.provider && selection.model) {
      return { provider: selection.provider, model: selection.model, source: 'session-default' }
    }
  } catch {
    /* optional service */
  }
  try {
    const providers = typeof ctx.llm?.listProviders === 'function' ? ctx.llm.listProviders() : []
    const first = Array.isArray(providers) ? providers[0] : null
    const provider = typeof first === 'string' ? first : first && (first.provider || first.id || first.name)
    const model = first && first.models && first.models[0] && (first.models[0].id || first.models[0].model || first.models[0])
    if (provider && model) return { provider, model: String(model), source: 'first-provider' }
  } catch {
    /* optional */
  }
  return null
}

/* ------------------------------------------------------------------ */
/* SSE                                                                */
/* ------------------------------------------------------------------ */

function sseOpen(response) {
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  })
  response.write(': open\n\n')
  if (typeof response.flushHeaders === 'function') response.flushHeaders()
  return (event, data) => {
    if (response.writableEnded || response.destroyed) return false
    response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    return true
  }
}

function tidyResult(text) {
  let out = String(text || '').trim()
  out = out.replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, '$1').trim()
  out = out.replace(/^(?:以下是|这是|下面是)[^\n]{0,40}提示词[^\n]{0,10}[：:]\s*/u, '').trim()
  return out
}

/* ------------------------------------------------------------------ */
/* plugin                                                             */
/* ------------------------------------------------------------------ */

export function apply(ctx, rawConfig = {}) {
  const config = { ...DEFAULTS }
  for (const key of Object.keys(DEFAULTS)) {
    const value = rawConfig?.[key]
    if (value !== undefined && value !== null && value !== '') config[key] = value
  }
  for (const key of ['maxPromptChars', 'maxWorkspaceBytes', 'maxWorkspaceFiles', 'maxOutputTokens', 'requestTimeoutMs']) {
    const numeric = Number(config[key])
    config[key] = Number.isFinite(numeric) && numeric > 0 ? numeric : DEFAULTS[key]
  }

  const state = {
    config,
    inflight: new Set(),
    cache: null,
    routeCache: null,
    presence: [],
  }

  // Browsers cannot be observed from here, so the client half reports what it
  // actually mounted. `/state` echoes the tail of this log; it is diagnostic
  // only (last 24 beats, in-memory) and never affects enhancement behaviour.
  const record = (event, detail) => {
    const name = typeof event === 'string' ? event.slice(0, 40) : 'unknown'
    const note = typeof detail === 'string' ? detail.slice(0, 700) : ''
    state.presence.push({ at: Date.now(), event: name, detail: note })
    if (state.presence.length > 24) state.presence.splice(0, state.presence.length - 24)
  }

  const handle = async (request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`)
    const path = url.pathname.slice(ROUTE_PREFIX.length) || '/'

    if (!isLoopback(request)) return sendError(response, 403, 'forbidden-origin', '只允许本机访问')
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' })
      response.end()
      return
    }
    if (request.method === 'POST') {
      if (!isSameOrigin(request)) return sendError(response, 403, 'forbidden-origin', '跨站请求被拒绝')
      if (!hasJsonContentType(request)) return sendError(response, 415, 'unsupported-media-type', '需要 application/json')
    }

    try {
      if (request.method === 'GET' && path === '/state') return await handleState(ctx, state, response)
      if (request.method === 'GET' && path === '/workspace') return await handleWorkspace(ctx, state, url, response)
      if (request.method === 'POST' && path === '/presence') {
        const body = await readBody(request)
        record(body?.event, body?.detail)
        return sendJson(response, 200, { ok: true })
      }
      if (request.method === 'POST' && path === '/enhance') return await handleEnhance(ctx, state, request, response)
      if (request.method === 'POST' && path === '/cancel') {
        let cancelled = 0
        for (const job of state.inflight) {
          job.cancel()
          cancelled += 1
        }
        return sendJson(response, 200, { ok: true, cancelled })
      }
      return sendError(response, 404, 'not-found', `未知端点：${path}`)
    } catch (error) {
      const status = error && error.status ? error.status : 500
      if (status >= 500) ctx.logger?.warn?.('prompt-enhance: request failed', error)
      if (!response.headersSent) return sendError(response, status, 'internal-error', error?.message || '内部错误')
      try {
        response.end()
      } catch {
        /* already closed */
      }
      return undefined
    }
  }

  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => {
      const dispose = webCtx.webServer.register({ kind: 'prefix', path: ROUTE_PREFIX, handler: handle })
      ctx.logger?.info?.(`prompt-enhance: mounted ${ROUTE_PREFIX} (v${VERSION})`)
      return () => {
        try {
          dispose?.()
        } catch {
          /* ignore */
        }
      }
    }, 'prompt-enhance: http routes')
  })
}

async function handleState(ctx, state, response) {
  const { root, source } = pickRoot(ctx, state.config)
  let route = state.routeCache && state.routeCache.at > Date.now() - 15000 ? state.routeCache.value : null
  if (route === null) {
    route = await resolveRoute(ctx, state.config)
    state.routeCache = { at: Date.now(), value: route }
  }
  sendJson(response, 200, {
    ok: true,
    version: VERSION,
    plugin: PLUGIN_ID,
    provider: route ? route.provider : '',
    model: route ? route.model : '',
    modelSource: route ? route.source : 'none',
    workspace: { root, source },
    limits: {
      maxPromptChars: state.config.maxPromptChars,
      maxWorkspaceFiles: state.config.maxWorkspaceFiles,
      maxWorkspaceBytes: state.config.maxWorkspaceBytes,
    },
    modes: MODES,
    focuses: FOCUSES,
    methodologies: methodologyCatalogue(),
    client: { beats: state.presence.length, recent: state.presence.slice(-6) },
  })
}

async function handleWorkspace(ctx, state, url, response) {
  const refresh = url.searchParams.get('refresh') === '1'
  const requestedCwd = url.searchParams.get('cwd') || ''
  const { root, source } = await resolveWorkspace(ctx, state.config, requestedCwd)
  const key = `${root}|${state.config.maxWorkspaceFiles}|${state.config.maxWorkspaceBytes}`
  const cached = state.cache
  let digest
  if (!refresh && cached && cached.key === key && cached.at > Date.now() - 10000) {
    digest = cached.value
  } else {
    digest = await collectWorkspace(root, state.config)
    state.cache = { key, at: Date.now(), value: digest }
  }
  sendJson(response, 200, {
    ok: true,
    root,
    source,
    cwd: digest.cwd,
    fileCount: digest.fileCount,
    totalBytes: digest.totalBytes,
    truncated: digest.truncated,
    files: digest.files.slice(0, 40),
    ignored: digest.ignored,
    security: digest.security,
    durationMs: digest.durationMs,
  })
}

async function handleEnhance(ctx, state, request, response) {
  const config = state.config
  const body = await readBody(request)

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt) return sendError(response, 400, 'empty-prompt', '请先在对话框输入提示词')
  if (prompt.length > config.maxPromptChars) {
    return sendError(response, 413, 'prompt-too-long', `提示词过长（上限 ${config.maxPromptChars} 字符）`)
  }

  const mode = body.mode === 'creative' ? 'creative' : body.mode === 'code' ? 'code' : ''
  if (!mode) return sendError(response, 400, 'bad-mode', 'mode 必须是 code 或 creative')

  const variant = String(body.variant || '')
  if (!VARIANT_IDS.includes(variant)) return sendError(response, 400, 'bad-variant', `未知 variant：${variant}`)
  if ((mode === 'code') !== variant.startsWith('code-')) return sendError(response, 400, 'mode-variant-mismatch', 'mode 与 variant 不匹配')

  const focus = Array.isArray(body.focus) ? body.focus.filter((item) => FOCUS_IDS.includes(item)) : []
  if (variant.startsWith('code-') && focus.length === 0) return sendError(response, 400, 'empty-focus', '代码类至少选择一个优化方向')

  const requested = typeof body.methodology === 'string' && body.methodology ? body.methodology : 'auto'
  if (requested !== 'auto' && !methodologyById(requested)) return sendError(response, 400, 'bad-methodology', `未知 methodology：${requested}`)

  const route = await resolveRoute(ctx, config)
  if (!route) return sendError(response, 503, 'no-model', '当前没有可用的模型路由，请先在设置中选择默认模型')

  const { root, source } = await resolveWorkspace(ctx, config, body.cwd)
  const cwd = root

  let digest
  if (variant === 'code-read') {
    const key = `${cwd}|${config.maxWorkspaceFiles}|${config.maxWorkspaceBytes}`
    const cached = state.cache
    if (cached && cached.key === key && cached.at > Date.now() - 10000) digest = cached.value
    else {
      digest = await collectWorkspace(cwd, config)
      state.cache = { key, at: Date.now(), value: digest }
    }
  }

  const methodologyChoice = selectMethodology({ mode, variant, focus, prompt, requested })
  const methodology = methodologyById(methodologyChoice.id) || METHODOLOGIES[0]
  const systemText = buildSystemPrompt({
    mode,
    variant,
    focus,
    methodology,
    methodologyReason: methodologyChoice.reason,
    promptText: prompt,
    digest,
  })

  const job = { cancel: () => {}, closed: false }
  const jobKey = job
  state.inflight.add(jobKey)
  const emit = sseOpen(response)
  const ping = setInterval(() => {
    if (!response.writableEnded && !response.destroyed) response.write(': ping\n\n')
  }, 10000)
  if (typeof ping.unref === 'function') ping.unref()

  const seen = { value: false }
  const closeStream = () => {
    if (seen.value) return
    seen.value = true
    clearInterval(ping)
    state.inflight.delete(jobKey)
    if (!response.writableEnded && !response.destroyed) response.end()
  }

  request.on('close', () => {
    job.closed = true
    job.cancel()
    closeStream()
  })
  job.cancel = () => {
    job.closed = true
  }

  emit('meta', {
    provider: route.provider,
    model: route.model,
    modelSource: route.source,
    promptChars: prompt.length,
    mode,
    variant,
    focus,
    methodology: methodology.id,
    methodologyLabel: methodology.label,
    methodologyReason: methodologyChoice.reason,
    workspaceRoot: root,
    workspaceSource: source,
    workspaceFiles: digest ? digest.files.length : 0,
    workspaceScanned: digest ? digest.fileCount : 0,
    securityFindings: digest ? digest.security.findings.length : 0,
    startedAt: Date.now(),
  })

  const startedAt = Date.now()
  const messages = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `<增强指令>\n${systemText}\n</增强指令>\n\n<用户原提示词>\n${prompt}\n</用户原提示词>`,
        },
      ],
    },
  ]

  let text = ''
  let usage = null
  let finish = null
  let failure = ''
  let reasoningChars = 0
  let lastStatusAt = 0
  let announcedText = false

  const timeout = setTimeout(() => {
    job.closed = true
    failure = `生成超时（>${Math.round(config.requestTimeoutMs / 1000)}s）`
  }, config.requestTimeoutMs)
  if (typeof timeout.unref === 'function') timeout.unref()

  try {
    const stream = ctx.llm.stream({ provider: route.provider, model: route.model, messages, maxTokens: config.maxOutputTokens })
    for await (const chunk of stream) {
      if (job.closed) break
      switch (chunk.type) {
        case 'reasoning-delta': {
          const piece = typeof chunk.text === 'string' ? chunk.text : ''
          reasoningChars += piece.length
          const now = Date.now()
          if (now - lastStatusAt > 1200) {
            lastStatusAt = now
            emit('status', { stage: 'reasoning', chars: reasoningChars })
          }
          break
        }
        case 'text-delta':
          if (chunk.text) {
            if (!announcedText) {
              announcedText = true
              emit('status', { stage: 'text', chars: 0 })
            }
            text += chunk.text
            emit('delta', { text: chunk.text })
          }
          break
        case 'usage':
          usage = chunk.usage || usage
          break
        case 'finish':
          finish = chunk.reason || finish
          break
        default:
          break
      }
    }
  } catch (error) {
    failure = error?.message || String(error)
  } finally {
    clearTimeout(timeout)
  }

  if (failure) {
    emit('error', { code: 'upstream-failed', message: failure })
    closeStream()
    return
  }
  if (finish && finish.kind === 'error') {
    emit('error', { code: 'upstream-failed', message: finish.failure?.message || '模型调用失败' })
    closeStream()
    return
  }

  const result = tidyResult(text)
  if (!result) {
    emit('error', { code: 'empty-result', message: '模型没有返回内容，请重试或更换模型' })
    closeStream()
    return
  }

  emit('done', {
    text: result,
    usage,
    finish: finish ? finish.kind : 'stop',
    durationMs: Date.now() - startedAt,
    truncated: finish ? finish.kind === 'max-tokens' : false,
  })
  closeStream()
}
