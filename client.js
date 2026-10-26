/**
 * dsh-prompt-enhance — browser half.
 *
 * Registers one component on the `conversation.input.right` slot — the control
 * row inside the composer that exists in both the hero and the in-session
 * variant: a compact "提示词增强" pill that opens a popover with the three
 * enhancement families (code / creative / doc), their variants, and the
 * adaptive methodology selector.
 *
 * The component talks to the host half over `/prompt-enhance/api` (JSON + SSE).
 */

window.__ModuleLoader__.load({
  id: 'dsh-prompt-enhance',
  factory(require) {
    const React = require('react')
    const { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } = React
    const h = React.createElement

    const API_BASE = '/prompt-enhance/api'
    const PANEL_WIDTH = 384

    const LABELS = {
      trigger: '提示词增强',
      triggerHint: '把当前输入框里的草稿增强为可执行的提示词',
      triggerDisabled: '请先在输入框写下提示词',
      title: '提示词增强',
      subtitle: '先选类型，再增强；结果会回填到输入框',
      close: '关闭',
      tabCode: '代码',
      tabCreative: '创作',
      tabDoc: '文档',
      focusTitle: '优化方向',
      focusHint: '至少选择一项',
      depthTitle: '档位',
      depthHint: '简洁 / 默认 / 严谨',
      methodology: '方法论',
      methodologyAuto: '自适应',
      workspace: '工作区',
      workspaceRefresh: '刷新',
      workspaceFiles: (n) => `${n} 个文件`,
      workspaceNone: '尚未读取',
      workspaceSecurity: (n) => (n ? `安全扫描命中 ${n} 处` : '安全扫描无命中'),
      document: '文档',
      documentAuto: '自动挑选（相关性优先）',
      documentNone: '未找到可读文档',
      documentMissing: '当前工作区没有可读文档：请选一个文件，或改用「按类型起草」。',
      documentChars: (n, truncated) => (truncated ? `${n} 字（已截断）` : `${n} 字`),
      documentHeadings: (n) => `${n} 个标题`,
      documentRefresh: '刷新文档',
      documentOutline: '框架',
      documentPick: '选择文档',
      start: '开始增强',
      stop: '停止',
      retry: '再试一次',
      running: '增强中…',
      thinking: '模型正在思考',
      resultTitle: '增强结果',
      apply: '替换输入框',
      insert: '插入到光标',
      copy: '复制',
      copied: '已复制',
      back: '返回修改',
      collapse: '收起',
      emptyDraft: '输入框是空的：先写一句你的需求，再点增强。',
      noModel: '当前没有可用模型，请先在设置里选择默认模型。',
      metaModel: '模型',
      metaMethod: '方法论',
      metaDepth: '档位',
      metaFiles: '读取文件',
      metaSecurity: '安全命中',
      metaDocument: '文档',
      streamHint: '模型正在流式生成，可随时停止。',
      errorPrefix: '出了点问题：',
      readyHint: '增强后会给出可直接使用的完整提示词。',
    }

    const READY_VARIANT = { code: 'code-read', creative: 'creative-rich', doc: 'doc-fill' }
    const DEFAULT_FOCUS = ['framework', 'security']
    const VARIANT_CHOICES = ['code-read', 'code-only', 'creative-rich', 'creative-structure', 'doc-fill', 'doc-draft']
    const FOCUS_CHOICES = ['framework', 'security']
    const MODE_CHOICES = ['code', 'creative', 'doc']
    const DEPTH_CHOICES = ['concise', 'default', 'thorough']
    const DEFAULT_DEPTH = 'default'
    const PREFS_KEY = 'dsh-prompt-enhance.prefs'

    /** Last-used panel choices, remembered per browser (optional, best effort). */
    function readPrefs() {
      try {
        if (typeof window === 'undefined' || !window.localStorage) return null
        const raw = window.localStorage.getItem(PREFS_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? parsed : null
      } catch {
        return null
      }
    }

    function writePrefs(prefs) {
      try {
        if (typeof window === 'undefined' || !window.localStorage) return
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
      } catch {
        /* preferences are optional */
      }
    }

    function pickVariants(prefs) {
      const saved = prefs && prefs.variants && typeof prefs.variants === 'object' ? prefs.variants : {}
      const picked = {}
      for (const family of Object.keys(READY_VARIANT)) {
        const value = saved[family]
        if (VARIANT_CHOICES.includes(value) && value.startsWith(`${family}-`)) picked[family] = value
      }
      return { ...READY_VARIANT, ...picked }
    }

    function pickFocus(prefs) {
      const saved = prefs && Array.isArray(prefs.focus) ? prefs.focus : []
      const picked = FOCUS_CHOICES.filter((id) => saved.includes(id))
      return picked.length ? picked : DEFAULT_FOCUS
    }

    function pickDocPath(prefs) {
      const saved = prefs && typeof prefs.docPath === 'string' ? prefs.docPath : ''
      return saved.slice(0, 400)
    }

    function pickDepth(prefs) {
      const saved = prefs && typeof prefs.depth === 'string' ? prefs.depth : ''
      return DEPTH_CHOICES.includes(saved) ? saved : DEFAULT_DEPTH
    }

    /* ---------------------------------------------------------------- */
    /* transport                                                         */
    /* ---------------------------------------------------------------- */

    function apiPath(path) {
      const base = document.baseURI || window.location.href
      const url = new URL(`${API_BASE}${path}`, base)
      return `${url.pathname}${url.search}`
    }

    /** Diagnostic breadcrumb: the host echoes these in `/state`. Never throws. */
    function beat(event, detail) {
      try {
        void fetch(apiPath('/presence'), {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ event, detail: typeof detail === 'string' ? detail : '' }),
          keepalive: true,
        }).catch(() => {})
      } catch {
        /* diagnostics only */
      }
    }

    async function readJson(path, options) {
      const response = await fetch(apiPath(path), {
        credentials: 'same-origin',
        ...options,
        headers: { 'content-type': 'application/json', ...(options && options.headers) },
      })
      let payload = null
      try {
        payload = await response.json()
      } catch {
        payload = null
      }
      if (!response.ok || !payload || payload.ok === false) {
        const message = payload && payload.error && payload.error.message
        throw new Error(message || `请求失败（HTTP ${response.status}）`)
      }
      return payload
    }

    /** POST a JSON body and consume the host's SSE response. */
    async function streamEnhance(body, handlers, signal) {
      const response = await fetch(apiPath('/enhance'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      })
      const contentType = response.headers.get('content-type') || ''
      if (!response.ok || !contentType.includes('text/event-stream')) {
        let message = `请求失败（HTTP ${response.status}）`
        try {
          const payload = await response.json()
          if (payload && payload.error && payload.error.message) message = payload.error.message
        } catch {
          /* keep default */
        }
        throw new Error(message)
      }
      if (!response.body || typeof response.body.getReader !== 'function') {
        throw new Error('当前浏览器不支持流式读取')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let eventName = 'message'
      let dataLines = []

      const dispatch = () => {
        if (!dataLines.length) {
          eventName = 'message'
          return
        }
        const raw = dataLines.join('\n')
        dataLines = []
        let payload = null
        try {
          payload = JSON.parse(raw)
        } catch {
          payload = null
        }
        const name = eventName
        eventName = 'message'
        if (name === 'meta' && handlers.onMeta) handlers.onMeta(payload)
        else if (name === 'status' && handlers.onStatus) handlers.onStatus(payload)
        else if (name === 'delta' && handlers.onDelta) handlers.onDelta(payload)
        else if (name === 'done' && handlers.onDone) handlers.onDone(payload)
        else if (name === 'error' && handlers.onError) handlers.onError(payload)
      }

      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        for (;;) {
          const newline = buffer.indexOf('\n')
          if (newline < 0) break
          const rawLine = buffer.slice(0, newline)
          buffer = buffer.slice(newline + 1)
          const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
          if (line === '') {
            dispatch()
            continue
          }
          if (line.startsWith(':')) continue
          const colon = line.indexOf(':')
          const field = colon < 0 ? line : line.slice(0, colon)
          let value2 = colon < 0 ? '' : line.slice(colon + 1)
          if (value2.startsWith(' ')) value2 = value2.slice(1)
          if (field === 'event') eventName = value2
          else if (field === 'data') dataLines.push(value2)
        }
      }
      dispatch()
    }

    /* ---------------------------------------------------------------- */
    /* styles                                                            */
    /* ---------------------------------------------------------------- */

    const CSS = `
.dpe-root { position: relative; display: inline-flex; align-items: center; }
.dpe-trigger {
  display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px;
  border-radius: 999px; border: 1px solid var(--dsw-alias-border-l3, rgba(128,128,128,.45));
  background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.12));
  color: var(--dsw-alias-label-primary, inherit);
  font: inherit; font-size: 12px; line-height: 1; cursor: pointer; white-space: nowrap;
  transition: background .15s ease, color .15s ease, border-color .15s ease;
}
.dpe-trigger:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.12)); color: var(--dsw-alias-label-primary, inherit); }
.dpe-trigger[data-open="true"] { background: var(--dsw-alias-interactive-bg-hover-solid, rgba(128,128,128,.16)); color: var(--dsw-alias-label-primary, inherit); border-color: var(--dsw-alias-border-l3, rgba(128,128,128,.45)); }
.dpe-trigger:disabled { opacity: .45; cursor: not-allowed; }
.dpe-trigger:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary, #4f7cff); outline-offset: 2px; }
.dpe-icon { width: 14px; height: 14px; flex: none; color: var(--dsw-alias-state-business-primary, #4f7cff); }

.dpe-panel {
  position: fixed; z-index: 60; display: flex; flex-direction: column; gap: 10px;
  padding: 14px; border-radius: 14px; border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.30));
  background: var(--dsw-alias-bg-base, #fff); color: var(--dsw-alias-label-primary, inherit);
  box-shadow: 0 16px 40px rgba(0,0,0,.22); font-size: 13px; line-height: 1.5;
  overflow: auto; overscroll-behavior: contain;
}
.dpe-head { display: flex; align-items: flex-start; gap: 8px; }
.dpe-head-main { flex: 1; min-width: 0; }
.dpe-title { font-size: 13px; font-weight: 600; color: var(--dsw-alias-label-primary, inherit); }
.dpe-sub { margin-top: 2px; font-size: 11px; color: var(--dsw-alias-label-tertiary, inherit); }
.dpe-x {
  flex: none; width: 22px; height: 22px; border-radius: 6px; border: 0; cursor: pointer;
  background: transparent; color: var(--dsw-alias-label-tertiary, inherit); font-size: 14px; line-height: 1;
}
.dpe-x:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.12)); color: var(--dsw-alias-label-primary, inherit); }

.dpe-tabs { display: flex; gap: 4px; padding: 3px; border-radius: 10px; background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.10)); }
.dpe-tab {
  flex: 1; height: 26px; border: 0; border-radius: 8px; cursor: pointer; background: transparent;
  color: var(--dsw-alias-label-secondary, inherit); font: inherit; font-size: 12px;
}
.dpe-tab[data-active="true"] { background: var(--dsw-alias-bg-base, #fff); color: var(--dsw-alias-label-primary, inherit); box-shadow: 0 1px 2px rgba(0,0,0,.12); }

.dpe-cards { display: flex; flex-direction: column; gap: 6px; }
.dpe-card {
  display: flex; gap: 8px; align-items: flex-start; width: 100%; text-align: left; cursor: pointer;
  padding: 8px 10px; border-radius: 10px; border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.28));
  background: transparent; color: inherit; font: inherit;
}
.dpe-card:hover { border-color: var(--dsw-alias-border-l3, rgba(128,128,128,.45)); }
.dpe-card[data-active="true"] { border-color: var(--dsw-alias-state-business-primary, #4f7cff); background: var(--dsw-alias-state-business-tertiary, rgba(79,124,255,.10)); }
.dpe-radio { flex: none; width: 13px; height: 13px; margin-top: 3px; border-radius: 50%; border: 1.5px solid var(--dsw-alias-border-l3, rgba(128,128,128,.55)); }
.dpe-card[data-active="true"] .dpe-radio { border-color: var(--dsw-alias-state-business-primary, #4f7cff); border-width: 4px; }
.dpe-card-body { min-width: 0; }
.dpe-card-title { font-size: 12.5px; font-weight: 500; }
.dpe-card-hint { margin-top: 2px; font-size: 11px; color: var(--dsw-alias-label-tertiary, inherit); }

.dpe-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dpe-label { font-size: 11px; color: var(--dsw-alias-label-tertiary, inherit); }
.dpe-check {
  display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px; cursor: pointer;
  border-radius: 999px; border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.28));
  background: transparent; color: var(--dsw-alias-label-secondary, inherit); font: inherit; font-size: 12px;
}
.dpe-check[data-active="true"] { border-color: var(--dsw-alias-state-business-primary, #4f7cff); color: var(--dsw-alias-state-business-primary, #4f7cff); background: var(--dsw-alias-state-business-tertiary, rgba(79,124,255,.10)); }
.dpe-select {
  height: 26px; border-radius: 8px; padding: 0 6px; font: inherit; font-size: 12px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.28));
  background: var(--dsw-alias-bg-module-platform, transparent); color: inherit;
}

.dpe-note {
  padding: 7px 9px; border-radius: 9px; font-size: 11.5px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.22));
  background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.07));
  color: var(--dsw-alias-label-tertiary, inherit);
}
.dpe-note b { color: var(--dsw-alias-label-secondary, inherit); font-weight: 500; }
.dpe-note-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; word-break: break-all; }
.dpe-note-error { border-color: var(--dsw-alias-state-error-primary, #d9534f); color: var(--dsw-alias-state-error-primary, #d9534f); }

.dpe-stream, .dpe-result {
  width: 100%; box-sizing: border-box; min-height: 132px; max-height: 260px; overflow: auto;
  padding: 9px 10px; border-radius: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11.5px; line-height: 1.55; white-space: pre-wrap; word-break: break-word;
  border: 1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.22));
  background: var(--dsw-alias-bg-module-platform, rgba(128,128,128,.05)); color: inherit;
}
.dpe-result { resize: vertical; min-height: 150px; }

.dpe-actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.dpe-btn {
  height: 28px; padding: 0 12px; border-radius: 8px; cursor: pointer; font: inherit; font-size: 12px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.30));
  background: transparent; color: var(--dsw-alias-label-secondary, inherit);
}
.dpe-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.12)); color: var(--dsw-alias-label-primary, inherit); }
.dpe-btn:disabled { opacity: .45; cursor: not-allowed; }
.dpe-btn-primary {
  border-color: transparent; background: var(--dsw-alias-button-info-fill, #2563eb); color: #fff;
}
.dpe-btn-primary:hover:not(:disabled) { background: var(--dsw-alias-button-info-hover, #1d4ed8); color: #fff; }
.dpe-btn-danger { border-color: var(--dsw-alias-state-error-primary, #d9534f); color: var(--dsw-alias-state-error-primary, #d9534f); }
.dpe-spacer { flex: 1; }
.dpe-meta { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 11px; color: var(--dsw-alias-label-tertiary, inherit); }
.dpe-spin { display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid currentColor; border-top-color: transparent; animation: dpe-spin .8s linear infinite; }
@keyframes dpe-spin { to { transform: rotate(360deg); } }
.dpe-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
`

    /* ---------------------------------------------------------------- */
    /* icons                                                             */
    /* ---------------------------------------------------------------- */

    function SparkIcon() {
      return h(
        'svg',
        {
          className: 'dpe-icon',
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        h('path', { d: 'M12 3.2l1.9 4.4 4.4 1.9-4.4 1.9L12 15.8l-1.9-4.4L5.7 9.5l4.4-1.9z' }),
        h('path', { d: 'M18.4 14.6l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z' }),
        h('path', { d: 'M5.2 15.4l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.2-.6 1.2-.6z' }),
      )
    }

    /* ---------------------------------------------------------------- */
    /* component                                                         */
    /* ---------------------------------------------------------------- */

    function PromptEnhanceDock(props) {
      const sessionId = props.sessionId
      const inputActions = props.inputActions
      const useInput = typeof props.useInput === 'function' ? props.useInput : null
      const useSessions = typeof props.useSessions === 'function' ? props.useSessions : null

      const input = useInput ? useInput((snapshot) => snapshot) : null
      const draft = input && typeof input.draft === 'string' ? input.draft : ''
      const draftRev = input && typeof input.draftRev === 'number' ? input.draftRev : 0
      const trimmedDraft = draft.trim()

      const sessionCwd = useSessions
        ? useSessions((state) => {
            const record = state && state.byId && sessionId ? state.byId[sessionId] : null
            return record && typeof record.cwd === 'string' ? record.cwd : ''
          })
        : ''

      const [prefs] = useState(readPrefs)
      const [open, setOpen] = useState(false)
      const [catalog, setCatalog] = useState(null)
      const [catalogError, setCatalogError] = useState('')
      const [mode, setMode] = useState(() => (prefs && MODE_CHOICES.includes(prefs.mode) ? prefs.mode : 'code'))
      const [variants, setVariants] = useState(() => pickVariants(prefs))
      const [focus, setFocus] = useState(() => pickFocus(prefs))
      const [depth, setDepth] = useState(() => pickDepth(prefs))
      const [docPath, setDocPath] = useState(() => pickDocPath(prefs))
      const [methodology, setMethodology] = useState(() =>
        prefs && typeof prefs.methodology === 'string' && prefs.methodology ? prefs.methodology : 'auto',
      )
      const [workspace, setWorkspace] = useState(null)
      const [workspaceBusy, setWorkspaceBusy] = useState(false)
      const [documents, setDocuments] = useState(null)
      const [documentsBusy, setDocumentsBusy] = useState(false)
      const [stage, setStage] = useState('idle')
      const [streamText, setStreamText] = useState('')
      const [result, setResult] = useState('')
      const [meta, setMeta] = useState(null)
      const [progress, setProgress] = useState(null)
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [placement, setPlacement] = useState(null)

      const rootRef = useRef(null)
      const triggerRef = useRef(null)
      const panelRef = useRef(null)
      const streamRef = useRef(null)
      const abortRef = useRef(null)
      const insertionRef = useRef(null)

      const variant = variants[mode] || READY_VARIANT[mode]

      /* diagnostics ---------------------------------------------------- */

      useEffect(() => {
        if (typeof document === 'undefined' || !document.querySelectorAll) {
          beat('dock-mounted', useInput ? 'hooks-ok' : 'no-hooks')
          return undefined
        }
        const timer = setTimeout(() => {
          try {
            const docks = Array.from(document.querySelectorAll('[data-composer-dock]'))
            const buttons = Array.from(document.querySelectorAll('.dpe-trigger'))
            const shape = (element) => {
              const box = element.getBoundingClientRect()
              const style = window.getComputedStyle(element)
              return `${Math.round(box.width)}x${Math.round(box.height)}@${Math.round(box.left)},${Math.round(box.top)}/${style.display}/${style.visibility}/${style.opacity}`
            }
            const chain = []
            let node = buttons[0] || triggerRef.current || null
            let depth = 0
            while (node && node.tagName && depth < 7) {
              const name = String(node.className || '').split(' ')[0]
              chain.push(`${node.tagName.toLowerCase()}${name ? '.' + name : ''}:${shape(node)}`)
              node = node.parentElement
              depth += 1
            }
            beat(
              'dock-probe',
              JSON.stringify({
                docks: docks.length,
                buttons: buttons.length,
                label: LABELS.trigger,
                view: [window.innerWidth, window.innerHeight],
                vis: document.visibilityState,
                dockShapes: docks.map(shape),
                chain,
              }),
            )
          } catch (failure) {
            beat('dock-probe-error', String((failure && failure.message) || failure))
          }
        }, 1200)
        return () => clearTimeout(timer)
      }, [])

      useEffect(() => {
        if (open) beat('panel-open', `${mode}/${variant}`)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [open])

      useEffect(() => {
        writePrefs({ mode, variants, focus, depth, methodology, docPath })
      }, [mode, variants, focus, depth, methodology, docPath])

      /* catalog -------------------------------------------------------- */

      const loadCatalog = useCallback(async () => {
        setCatalogError('')
        try {
          const payload = await readJson('/state', { method: 'GET' })
          setCatalog(payload)
        } catch (failure) {
          setCatalogError(failure && failure.message ? failure.message : '无法连接增强服务')
        }
      }, [])

      useEffect(() => {
        if (open && !catalog && !catalogError) loadCatalog()
      }, [open, catalog, catalogError, loadCatalog])

      const wantsWorkspace = mode === 'code' && variant === 'code-read'

      const loadWorkspace = useCallback(
        async (refresh) => {
          setWorkspaceBusy(true)
          try {
            const params = new URLSearchParams()
            if (refresh) params.set('refresh', '1')
            if (sessionCwd) params.set('cwd', sessionCwd)
            const query = params.toString()
            const payload = await readJson(`/workspace${query ? `?${query}` : ''}`, { method: 'GET' })
            setWorkspace(payload)
          } catch (failure) {
            setNotice(failure && failure.message ? failure.message : '工作区读取失败')
          } finally {
            setWorkspaceBusy(false)
          }
        },
        [sessionCwd],
      )

      useEffect(() => {
        if (open && wantsWorkspace && !workspace && !workspaceBusy) loadWorkspace(false)
      }, [open, wantsWorkspace, workspace, workspaceBusy, loadWorkspace])

      const wantsDocument = mode === 'doc' && variant === 'doc-fill'

      const loadDocuments = useCallback(
        async (refresh, overridePath) => {
          setDocumentsBusy(true)
          try {
            const params = new URLSearchParams()
            if (refresh) params.set('refresh', '1')
            if (sessionCwd) params.set('cwd', sessionCwd)
            const target = typeof overridePath === 'string' ? overridePath : docPath
            if (target) params.set('path', target)
            if (trimmedDraft) params.set('prompt', trimmedDraft.slice(0, 200))
            const query = params.toString()
            const payload = await readJson(`/documents${query ? `?${query}` : ''}`, { method: 'GET' })
            setDocuments(payload)
          } catch (failure) {
            setNotice(failure && failure.message ? failure.message : '文档读取失败')
          } finally {
            setDocumentsBusy(false)
          }
        },
        [docPath, sessionCwd, trimmedDraft],
      )

      useEffect(() => {
        if (open && wantsDocument && !documents && !documentsBusy) loadDocuments(false)
      }, [open, wantsDocument, documents, documentsBusy, loadDocuments])

      /* placement ------------------------------------------------------ */

      const recomputePlacement = useCallback(() => {
        const node = triggerRef.current
        if (!node) return
        const rect = node.getBoundingClientRect()
        const width = Math.min(PANEL_WIDTH, Math.max(280, window.innerWidth - 24))
        const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
        const spaceAbove = rect.top
        const spaceBelow = window.innerHeight - rect.bottom
        const openUp = spaceAbove >= 260 || spaceAbove >= spaceBelow
        setPlacement({
          left,
          width,
          ...(openUp ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
          maxHeight: openUp ? Math.max(200, spaceAbove - 20) : Math.max(200, spaceBelow - 20),
        })
      }, [])

      useLayoutEffect(() => {
        if (!open) {
          setPlacement(null)
          return undefined
        }
        recomputePlacement()
        const onResize = () => recomputePlacement()
        window.addEventListener('resize', onResize)
        window.addEventListener('scroll', onResize, true)
        return () => {
          window.removeEventListener('resize', onResize)
          window.removeEventListener('scroll', onResize, true)
        }
      }, [open, recomputePlacement])

      /* dismissal ------------------------------------------------------ */

      useEffect(() => {
        if (!open) return undefined
        const onPointerDown = (event) => {
          const target = event.target
          if (!target || typeof target.nodeType !== 'number') return
          if (panelRef.current && panelRef.current.contains(target)) return
          if (rootRef.current && rootRef.current.contains(target)) return
          setOpen(false)
        }
        const onKeyDown = (event) => {
          if (event.key !== 'Escape') return
          setOpen(false)
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown, true)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown, true)
        }
      }, [open])

      useEffect(() => {
        if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight
      }, [streamText])

      const resetRun = useCallback(() => {
        setStage('idle')
        setStreamText('')
        setResult('')
        setMeta(null)
        setProgress(null)
        setError('')
        setNotice('')
      }, [])

      const stop = useCallback(() => {
        const controller = abortRef.current
        if (controller) controller.abort()
        abortRef.current = null
      }, [])

      const captureInsertion = useCallback(() => {
        if (!inputActions || typeof inputActions.captureInsertion !== 'function') return null
        try {
          return inputActions.captureInsertion()
        } catch {
          return null
        }
      }, [inputActions])

      const start = useCallback(async () => {
        if (stage === 'running') return
        const prompt = trimmedDraft
        if (!prompt) {
          setError(LABELS.emptyDraft)
          return
        }
        if (mode === 'code' && focus.length === 0) {
          setError(LABELS.focusHint)
          return
        }
        if (wantsDocument && documents && (!documents.documents || !documents.documents.length) && !docPath) {
          setError(LABELS.documentMissing)
          return
        }
        setError('')
        setNotice('')
        setStage('running')
        setStreamText('')
        setResult('')
        setMeta(null)
        setProgress(null)
        insertionRef.current = captureInsertion()
        beat('enhance-start', `${mode}/${variant}/${methodology}/${depth}`)

        const controller = new AbortController()
        abortRef.current = controller
        let settled = false
        const body = {
          prompt,
          mode,
          variant,
          methodology,
          depth,
          ...(mode === 'code' ? { focus } : {}),
          ...(mode === 'doc' && docPath ? { docPath } : {}),
          ...(sessionCwd ? { cwd: sessionCwd } : {}),
          ...(sessionId ? { sessionId } : {}),
        }

        try {
          await streamEnhance(
            body,
            {
              onMeta: (payload) => setMeta(payload || null),
              onStatus: (payload) => setProgress(payload || null),
              onDelta: (payload) => {
                const piece = payload && typeof payload.text === 'string' ? payload.text : ''
                if (piece) setStreamText((previous) => previous + piece)
              },
              onDone: (payload) => {
                settled = true
                const text = payload && typeof payload.text === 'string' ? payload.text : ''
                setResult(text)
                setMeta((previous) => ({ ...(previous || {}), ...(payload && payload.usage ? { usage: payload.usage } : {}), durationMs: payload && payload.durationMs }))
                setStage(text ? 'done' : 'error')
                if (!text) setError('模型返回了空结果，请重试')
              },
              onError: (payload) => {
                settled = true
                setError((payload && payload.message) || '增强失败')
                setStage('error')
              },
            },
            controller.signal,
          )
          if (!settled) {
            setStage((previous) => {
              if (previous !== 'running') return previous
              return 'done'
            })
            setStreamText((text) => {
              if (text.trim()) setResult(text.trim())
              return text
            })
          }
        } catch (failure) {
          if (failure && failure.name === 'AbortError') {
            setStreamText((text) => {
              if (text.trim()) {
                setResult(text.trim())
                setStage('done')
              } else {
                setStage('idle')
              }
              return text
            })
          } else {
            setError((failure && failure.message) || '增强失败')
            setStage('error')
          }
        } finally {
          if (abortRef.current === controller) abortRef.current = null
        }
      }, [captureInsertion, docPath, documents, depth, focus, methodology, mode, sessionCwd, sessionId, stage, trimmedDraft, variant, wantsDocument])

      useEffect(() => () => {
        if (abortRef.current) abortRef.current.abort()
      }, [])

      /* apply ---------------------------------------------------------- */

      const writeDraft = useCallback(
        (text) => {
          if (!inputActions) {
            setError('无法访问输入框')
            return false
          }
          try {
            if (typeof inputActions.setDraft === 'function') {
              inputActions.setDraft(text)
            } else if (typeof inputActions.insertText === 'function') {
              inputActions.insertText(text, insertionRef.current || { start: 0, end: 0, draftRev })
            } else {
              setError('当前版本不支持回填输入框')
              return false
            }
            if (typeof inputActions.persistDraft === 'function') inputActions.persistDraft()
            return true
          } catch (failure) {
            setError((failure && failure.message) || '回填失败')
            return false
          }
        },
        [draftRev, inputActions],
      )

      const applyReplace = useCallback(() => {
        if (!result.trim()) return
        if (writeDraft(result.trim())) {
          setOpen(false)
          resetRun()
        }
      }, [resetRun, result, writeDraft])

      const applyInsert = useCallback(() => {
        if (!result.trim()) return
        const text = result.trim()
        const span = insertionRef.current
        let inserted = false
        if (inputActions && typeof inputActions.insertText === 'function' && span && span.draftRev === draftRev) {
          try {
            inserted = inputActions.insertText(text, span) !== false
          } catch {
            inserted = false
          }
        }
        if (inserted) {
          if (typeof inputActions.persistDraft === 'function') inputActions.persistDraft()
          beat('insert', `cursor/${text.length}`)
          setOpen(false)
          resetRun()
          return
        }
        beat('insert', `replace/${text.length}`)
        applyReplace()
      }, [applyReplace, draftRev, inputActions, resetRun, result])

      const copyResult = useCallback(async () => {
        const text = result.trim()
        if (!text) return
        try {
          await navigator.clipboard.writeText(text)
          setNotice(LABELS.copied)
          window.setTimeout(() => setNotice(''), 1600)
        } catch {
          setError('复制失败，请手动选择文本')
        }
      }, [result])

      /* render helpers ------------------------------------------------- */

      const catalogModes = catalog && Array.isArray(catalog.modes) ? catalog.modes : []
      const activeMode = catalogModes.find((entry) => entry.id === mode) || null
      const variantOptions = activeMode && Array.isArray(activeMode.variants) ? activeMode.variants : []
      const catalogFocuses = catalog && Array.isArray(catalog.focuses) ? catalog.focuses : []
      const catalogMethods = catalog && Array.isArray(catalog.methodologies) ? catalog.methodologies : []
      const modelLabel = catalog && catalog.model ? `${catalog.provider}/${catalog.model}` : ''

      const toggleFocus = (id) => {
        setFocus((previous) => (previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]))
      }

      const panelStyle = placement
        ? {
            left: `${placement.left}px`,
            width: `${placement.width}px`,
            maxHeight: `${Math.min(placement.maxHeight, 640)}px`,
            ...(placement.bottom !== undefined ? { bottom: `${placement.bottom}px` } : {}),
            ...(placement.top !== undefined ? { top: `${placement.top}px` } : {}),
          }
        : { left: '12px', width: `${PANEL_WIDTH}px`, bottom: '80px' }

      const renderPanel = () => {
        const head = h(
          'div',
          { className: 'dpe-head' },
          h(
            'div',
            { className: 'dpe-head-main' },
            h('div', { className: 'dpe-title' }, LABELS.title),
            h('div', { className: 'dpe-sub' }, LABELS.subtitle),
          ),
          h('button', { type: 'button', className: 'dpe-x', onClick: () => setOpen(false), 'aria-label': LABELS.close, title: LABELS.close }, '×'),
        )

        const tabs = h(
          'div',
          { className: 'dpe-tabs', role: 'tablist', 'aria-label': '增强类型' },
          ...catalogModes.map((entry) =>
            h(
              'button',
              {
                key: entry.id,
                type: 'button',
                role: 'tab',
                className: 'dpe-tab',
                'data-active': entry.id === mode ? 'true' : 'false',
                'aria-selected': entry.id === mode ? 'true' : 'false',
                onClick: () => {
                  setMode(entry.id)
                  setError('')
                  if (stage !== 'running') resetRun()
                },
              },
              entry.label,
            ),
          ),
        )

        const cards = h(
          'div',
          { className: 'dpe-cards', role: 'radiogroup', 'aria-label': '增强方式' },
          ...variantOptions.map((entry) =>
            h(
              'button',
              {
                key: entry.id,
                type: 'button',
                role: 'radio',
                className: 'dpe-card',
                'data-active': entry.id === variant ? 'true' : 'false',
                'aria-checked': entry.id === variant ? 'true' : 'false',
                onClick: () => {
                  setVariants((previous) => ({ ...previous, [mode]: entry.id }))
                  setError('')
                  if (stage !== 'running') resetRun()
                },
              },
              h('span', { className: 'dpe-radio', 'aria-hidden': 'true' }),
              h(
                'span',
                { className: 'dpe-card-body' },
                h('span', { className: 'dpe-card-title' }, entry.label),
                entry.hint ? h('span', { className: 'dpe-card-hint', style: { display: 'block' } }, entry.hint) : null,
              ),
            ),
          ),
        )

        const focusRow =
          mode === 'code' && catalogFocuses.length
            ? h(
                'div',
                { className: 'dpe-row' },
                h('span', { className: 'dpe-label' }, LABELS.focusTitle),
                ...catalogFocuses.map((entry) =>
                  h(
                    'button',
                    {
                      key: entry.id,
                      type: 'button',
                      className: 'dpe-check',
                      'data-active': focus.includes(entry.id) ? 'true' : 'false',
                      'aria-pressed': focus.includes(entry.id) ? 'true' : 'false',
                      title: entry.hint || entry.label,
                      onClick: () => toggleFocus(entry.id),
                    },
                    entry.label,
                  ),
                ),
              )
            : null

        const catalogDepths = catalog && Array.isArray(catalog.depths) ? catalog.depths : []
        const depthRow = catalogDepths.length
          ? h(
              'div',
              { className: 'dpe-row' },
              h('span', { className: 'dpe-label' }, LABELS.depthTitle),
              ...catalogDepths.map((entry) =>
                h(
                  'button',
                  {
                    key: entry.id,
                    type: 'button',
                    className: 'dpe-check',
                    'data-active': depth === entry.id ? 'true' : 'false',
                    'aria-pressed': depth === entry.id ? 'true' : 'false',
                    title: entry.hint || entry.label,
                    onClick: () => setDepth(entry.id),
                  },
                  entry.label,
                ),
              ),
              h(
                'span',
                { className: 'dpe-label' },
                (catalogDepths.find((entry) => entry.id === depth) || {}).hint || '',
              ),
            )
          : null

        const methodRow = h(
          'div',
          { className: 'dpe-row' },
          h('span', { className: 'dpe-label' }, LABELS.methodology),
          h(
            'select',
            {
              className: 'dpe-select',
              value: methodology,
              onChange: (event) => setMethodology(event.target.value),
              'aria-label': LABELS.methodology,
            },
            ...(catalogMethods.length
              ? catalogMethods.map((entry) => h('option', { key: entry.id, value: entry.id }, entry.label))
              : [h('option', { key: 'auto', value: 'auto' }, LABELS.methodologyAuto)]),
          ),
          meta && meta.methodologyLabel
            ? h('span', { className: 'dpe-label' }, `→ ${meta.methodologyLabel}`)
            : null,
        )

        const workspaceNote = wantsWorkspace
          ? h(
              'div',
              { className: 'dpe-note' },
              h('b', null, LABELS.workspace),
              ' ',
              workspace
                ? `${workspace.root}`
                : catalog && catalog.workspace
                  ? catalog.workspace.root
                  : '—',
              workspace
                ? h(
                    'div',
                    null,
                    `${LABELS.workspaceFiles(workspace.fileCount)} · ${LABELS.workspaceSecurity(workspace.security ? workspace.security.findings.length : 0)}`,
                    workspace.files && workspace.files.length
                      ? h('div', { className: 'dpe-note-mono' }, workspace.files.slice(0, 4).join(' · '))
                      : null,
                  )
                : null,
              h(
                'button',
                {
                  type: 'button',
                  className: 'dpe-btn',
                  style: { marginTop: '6px', height: '24px', padding: '0 8px' },
                  disabled: workspaceBusy,
                  onClick: () => loadWorkspace(true),
                },
                workspaceBusy ? LABELS.running : LABELS.workspaceRefresh,
              ),
            )
          : null

        const selectedDocument = documents && documents.selected ? documents.selected : null
        const documentOptions = documents && Array.isArray(documents.documents) ? documents.documents : []
        const documentValue = docPath || (selectedDocument ? selectedDocument.path : '')

        const documentNote = wantsDocument
          ? h(
              'div',
              { className: 'dpe-note' },
              h('b', null, LABELS.document),
              ' ',
              selectedDocument
                ? selectedDocument.path
                : documents
                  ? LABELS.documentNone
                  : catalog && catalog.workspace
                    ? catalog.workspace.root
                    : '—',
              selectedDocument
                ? h(
                    'div',
                    null,
                    `${LABELS.documentChars(selectedDocument.chars, selectedDocument.truncated)} · ${LABELS.documentHeadings(selectedDocument.headings)}`,
                    selectedDocument.outline && selectedDocument.outline.length
                      ? h(
                          'div',
                          { className: 'dpe-note-mono' },
                          selectedDocument.outline
                            .slice(0, 4)
                            .map((item) => item.text)
                            .join(' · '),
                        )
                      : null,
                  )
                : null,
              documentOptions.length
                ? h(
                    'select',
                    {
                      className: 'dpe-select',
                      style: { marginTop: '6px', width: '100%' },
                      value: documentValue,
                      'aria-label': LABELS.documentPick,
                      onChange: (event) => {
                        const next = event.target.value
                        setDocPath(next)
                        loadDocuments(false, next)
                      },
                    },
                    h('option', { key: 'auto', value: '' }, LABELS.documentAuto),
                    ...documentOptions.map((entry) =>
                      h('option', { key: entry.path, value: entry.path }, `${entry.path}（${entry.chars} 字）`),
                    ),
                  )
                : null,
              h(
                'button',
                {
                  type: 'button',
                  className: 'dpe-btn',
                  style: { marginTop: '6px', height: '24px', padding: '0 8px' },
                  disabled: documentsBusy,
                  onClick: () => loadDocuments(true),
                },
                documentsBusy ? LABELS.running : LABELS.documentRefresh,
              ),
            )
          : null

        const errorNote = error
          ? h('div', { className: 'dpe-note dpe-note-error' }, LABELS.errorPrefix, error)
          : catalogError
            ? h('div', { className: 'dpe-note dpe-note-error' }, LABELS.errorPrefix, catalogError)
            : null

        const metaLine = meta
          ? h(
              'div',
              { className: 'dpe-meta' },
              meta.provider && meta.model ? h('span', null, `${LABELS.metaModel} ${meta.provider}/${meta.model}`) : null,
              meta.methodologyLabel ? h('span', null, `${LABELS.metaMethod} ${meta.methodologyLabel}`) : null,
              meta.depthLabel
                ? h('span', null, `${LABELS.metaDepth} ${meta.depthLabel}${meta.depthBudget ? ` · ≤${meta.depthBudget} 字` : ''}`)
                : null,
              wantsWorkspace ? h('span', null, `${LABELS.metaFiles} ${meta.workspaceScanned || 0}`) : null,
              wantsWorkspace ? h('span', null, `${LABELS.metaSecurity} ${meta.securityFindings || 0}`) : null,
              wantsDocument ? h('span', null, `${LABELS.metaDocument} ${meta.documentPath || '—'}`) : null,
              wantsDocument && meta.documentChars
                ? h('span', null, LABELS.documentChars(meta.documentChars, meta.documentTruncated))
                : null,
              wantsDocument && meta.documentHeadings ? h('span', null, LABELS.documentHeadings(meta.documentHeadings)) : null,
            )
          : null

        const reasoningChars = progress && progress.stage === 'reasoning' ? Number(progress.chars || 0) : 0
        const runningHint = reasoningChars > 0 ? `${LABELS.thinking}…（${reasoningChars} 字）` : LABELS.running

        let body = null
        if (stage === 'running') {          body = h(
            'div',
            null,
            h('div', { className: 'dpe-stream', ref: streamRef }, streamText || runningHint),
            h(
              'div',
              { className: 'dpe-actions', style: { marginTop: '8px' } },
              h('button', { type: 'button', className: 'dpe-btn dpe-btn-danger', onClick: stop }, LABELS.stop),
              h('span', { className: 'dpe-label' }, LABELS.streamHint),
            ),
          )
        } else if (stage === 'done' || (stage === 'idle' && result)) {
          body = h(
            'div',
            null,
            h('div', { className: 'dpe-label', style: { marginBottom: '4px' } }, LABELS.resultTitle),
            h('textarea', {
              className: 'dpe-result',
              value: result,
              spellCheck: false,
              onChange: (event) => setResult(event.target.value),
              'aria-label': LABELS.resultTitle,
            }),
            h(
              'div',
              { className: 'dpe-actions', style: { marginTop: '8px' } },
              h('button', { type: 'button', className: 'dpe-btn dpe-btn-primary', onClick: applyReplace }, LABELS.apply),
              h('button', { type: 'button', className: 'dpe-btn', onClick: applyInsert }, LABELS.insert),
              h('button', { type: 'button', className: 'dpe-btn', onClick: copyResult }, notice === LABELS.copied ? LABELS.copied : LABELS.copy),
              h('button', { type: 'button', className: 'dpe-btn', onClick: start }, LABELS.retry),
              h('span', { className: 'dpe-spacer' }),
              h('button', { type: 'button', className: 'dpe-btn', onClick: () => { resetRun() } }, LABELS.back),
            ),
            metaLine,
          )
        } else {
          body = h(
            'div',
            null,
            h(
              'div',
              { className: 'dpe-actions' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'dpe-btn dpe-btn-primary',
                  disabled: !trimmedDraft,
                  onClick: start,
                },
                LABELS.start,
              ),
              h('span', { className: 'dpe-label' }, trimmedDraft ? LABELS.readyHint : LABELS.emptyDraft),
            ),
            modelLabel
              ? h('div', { className: 'dpe-meta' }, h('span', null, `${LABELS.metaModel} ${modelLabel}`))
              : catalog && !catalog.model
                ? h('div', { className: 'dpe-note dpe-note-error' }, LABELS.noModel)
                : null,
          )
        }

        return h(
          'div',
          {
            className: 'dpe-panel',
            ref: panelRef,
            role: 'dialog',
            'aria-label': LABELS.title,
            'aria-modal': 'false',
            style: panelStyle,
          },
          head,
          catalogError ? errorNote : null,
          tabs,
          cards,
          focusRow,
          depthRow,
          methodRow,
          workspaceNote,
          documentNote,
          stage === 'idle' && error ? errorNote : null,
          body,
        )
      }

      const triggerDisabled = stage === 'running' && !open

      return h(
        'div',
        { className: 'dpe-root', ref: rootRef },
        h('style', null, CSS),
        h(
          'button',
          {
            type: 'button',
            ref: triggerRef,
            className: 'dpe-trigger',
            'data-open': open ? 'true' : 'false',
            'aria-haspopup': 'dialog',
            'aria-expanded': open ? 'true' : 'false',
            disabled: triggerDisabled,
            title: trimmedDraft ? LABELS.triggerHint : `${LABELS.triggerHint}（${LABELS.emptyDraft}）`,
            onClick: () => {
              const next = !open
              setOpen(next)
              if (next && !catalog && !catalogError) loadCatalog()
            },
          },
          h(SparkIcon),
          h('span', null, LABELS.trigger),
          stage === 'running' ? h('span', { className: 'dpe-spin', 'aria-hidden': 'true' }) : null,
        ),
        open ? renderPanel() : null,
      )
    }

    /* ---------------------------------------------------------------- */
    /* plugin                                                            */
    /* ---------------------------------------------------------------- */

    return {
      inject: ['slots'],
      apply(ctx) {
        beat('client-apply', 'v1.1.1')
        ctx.slots.inject('conversation.input.right', () =>
          ctx.slots.register(
            { name: 'conversation.input.right', id: 'prompt-enhance-trigger', order: 20 },
            PromptEnhanceDock,
          ),
        )
      },
    }
  },
})
