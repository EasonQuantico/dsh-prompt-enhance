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
    const PANEL_MARGIN = 8
    const PANEL_MIN_USABLE = 220
    const PANEL_MAX_HEIGHT = 640
    // The panel lives in the top layer when the browser has the Popover API,
    // so no ancestor stacking context (composer masks, hero overlays) can cover it.
    const HAS_POPOVER =
      typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function'

    /**
     * Interface copy. `zh` is the source language; `en` mirrors it key for key.
     * Every string the user can see must exist in both maps (the tests check it).
     */
    const COPY = {
      zh: {
        trigger: '提示词增强',
        triggerHint: '把当前输入框里的草稿增强为可执行的提示词',
        triggerDisabled: '请先在输入框写下提示词',
        title: '提示词增强',
        subtitle: '先选类型，再增强；结果会回填到输入框',
        close: '关闭',
        language: '界面语言',
        languageHint: '只切换本插件的文案',
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
        workspaceBusy: '读取中…',
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
        requestFailed: (status) => `请求失败（HTTP ${status}）`,
        streamUnsupported: '当前浏览器不支持流式读取',
        catalogFailed: '无法连接增强服务',
        workspaceFailed: '工作区读取失败',
        documentFailed: '文档读取失败',
        emptyResult: '模型返回了空结果，请重试',
        enhanceFailed: '增强失败',
        noInput: '无法访问输入框',
        insertUnsupported: '当前版本不支持回填输入框',
        insertFailed: '回填失败',
        copyFailed: '复制失败，请手动选择文本',
        tabsLabel: '增强类型',
        cardsLabel: '增强方式',
        docOption: (path, chars) => `${path}（${chars} 字）`,
        budgetSuffix: (n) => ` · ≤${n} 字`,
        reasoningSuffix: (n) => `（${n} 字）`,
        viewLabel: '模式',
        tabAuto: '自动',
        tabAdvanced: '高级',
        autoHint: '自动识别草稿的需求类型，从方法论与提示词库各路生成 3 组候选，选一组回填输入框。',
        autoStart: '开始自动优化',
        autoRunning: '自动优化中…',
        autoIntent: '需求识别',
        autoPlan: '生成计划',
        autoCandidates: '候选结果',
        autoUse: '使用这组',
        autoCopy: '复制',
        autoUsed: '已回填输入框',
        autoPickHint: '每组候选标注了参考来源（方法论或提示词库角色）。',
        intentCode: '代码类',
        intentCreative: '创作类',
        intentDoc: '文档类',
        routeMethodology: '方法论路线',
        routeAct: '角色路线',
        routeStructure: '结构路线',
        slotWaiting: '等待生成…',
        slotFailed: '该路线生成失败',
        intentOf: (intent) => (intent === 'code' ? '识别为代码类' : intent === 'creative' ? '识别为创作类' : '识别为文档类'),
        autoFailed: '自动优化失败',
      },
      en: {
        trigger: 'Enhance prompt',
        triggerHint: 'Turn the draft in the composer into a prompt an agent can run',
        triggerDisabled: 'Write a prompt in the composer first',
        title: 'Enhance prompt',
        subtitle: 'Pick a type, then enhance. The result goes back into the composer.',
        close: 'Close',
        language: 'Interface language',
        languageHint: 'Changes this plugin only',
        tabCode: 'Code',
        tabCreative: 'Creative',
        tabDoc: 'Document',
        focusTitle: 'Focus',
        focusHint: 'Pick at least one',
        depthTitle: 'Length',
        depthHint: 'Concise / Default / Thorough',
        methodology: 'Technique',
        methodologyAuto: 'Auto',
        workspace: 'Workspace',
        workspaceRefresh: 'Refresh',
        workspaceBusy: 'Reading…',
        workspaceFiles: (n) => `${n} file${n === 1 ? '' : 's'}`,
        workspaceNone: 'Not read yet',
        workspaceSecurity: (n) => (n ? `${n} security hit${n === 1 ? '' : 's'}` : 'No security hits'),
        document: 'Document',
        documentAuto: 'Pick automatically (most relevant)',
        documentNone: 'No readable document found',
        documentMissing: 'No readable document in this workspace: pick one, or switch to "Draft by type".',
        documentChars: (n, truncated) => (truncated ? `${n} chars (truncated)` : `${n} chars`),
        documentHeadings: (n) => `${n} heading${n === 1 ? '' : 's'}`,
        documentRefresh: 'Refresh document',
        documentOutline: 'Outline',
        documentPick: 'Pick a document',
        start: 'Enhance',
        stop: 'Stop',
        retry: 'Try again',
        running: 'Enhancing…',
        thinking: 'The model is thinking',
        resultTitle: 'Result',
        apply: 'Replace the draft',
        insert: 'Insert at the cursor',
        copy: 'Copy',
        copied: 'Copied',
        back: 'Back to the options',
        collapse: 'Collapse',
        emptyDraft: 'The composer is empty: write what you need first.',
        noModel: 'No model is available. Pick a default model in the settings first.',
        metaModel: 'Model',
        metaMethod: 'Technique',
        metaDepth: 'Length',
        metaFiles: 'Files read',
        metaSecurity: 'Security hits',
        metaDocument: 'Document',
        streamHint: 'The model is streaming. You can stop at any time.',
        errorPrefix: 'Something went wrong: ',
        readyHint: 'The result is a prompt you can send as it is.',
        requestFailed: (status) => `Request failed (HTTP ${status})`,
        streamUnsupported: 'This browser cannot stream the response',
        catalogFailed: 'Cannot reach the enhancement service',
        workspaceFailed: 'Could not read the workspace',
        documentFailed: 'Could not read the document',
        emptyResult: 'The model returned nothing. Try again.',
        enhanceFailed: 'Enhancement failed',
        noInput: 'Cannot reach the composer',
        insertUnsupported: 'This DSH version cannot write back to the composer',
        insertFailed: 'Could not write to the composer',
        copyFailed: 'Copy failed. Select the text by hand.',
        tabsLabel: 'Enhancement type',
        cardsLabel: 'Enhancement style',
        docOption: (path, chars) => `${path} (${chars} chars)`,
        budgetSuffix: (n) => ` · ≤${n} chars`,
        reasoningSuffix: (n) => ` (${n} chars)`,
        viewLabel: 'Mode',
        tabAuto: 'Auto',
        tabAdvanced: 'Advanced',
        autoHint: 'The draft is classified automatically, then three candidates are generated from the technique sets and the prompt library. Pick one to write back.',
        autoStart: 'Auto-optimize',
        autoRunning: 'Auto-optimizing…',
        autoIntent: 'Intent',
        autoPlan: 'Plan',
        autoCandidates: 'Candidates',
        autoUse: 'Use this one',
        autoCopy: 'Copy',
        autoUsed: 'Written back to the composer',
        autoPickHint: 'Each candidate is tagged with its source (a technique set or a library role).',
        intentCode: 'code',
        intentCreative: 'creative',
        intentDoc: 'document',
        routeMethodology: 'Technique route',
        routeAct: 'Role route',
        routeStructure: 'Structure route',
        slotWaiting: 'Waiting to run…',
        slotFailed: 'This route failed',
        intentOf: (intent) => (intent === 'code' ? 'Read as code' : intent === 'creative' ? 'Read as creative' : 'Read as a document'),
        autoFailed: 'Auto optimization failed',
      },
    }

    const LANGUAGES = ['zh', 'en']
    const LANGUAGE_LABELS = { zh: '中文', en: 'English' }
    /** First-run language: follow DeepSeek Harness when the locale service is there. */
    let defaultLanguage = 'zh'
    /** The language of the last render; the transport helpers use it for error copy. */
    let currentLanguage = defaultLanguage
    const copy = () => COPY[currentLanguage] || COPY.zh


    const READY_VARIANT = { code: 'code-read', creative: 'creative-rich', doc: 'doc-fill' }
    const DEFAULT_FOCUS = ['framework', 'security']
    const VARIANT_CHOICES = ['code-read', 'code-only', 'creative-rich', 'creative-structure', 'doc-fill', 'doc-draft']
    const FOCUS_CHOICES = ['framework', 'security']
    const MODE_CHOICES = ['code', 'creative', 'doc']
    const DEPTH_CHOICES = ['concise', 'default', 'thorough']
    const DEFAULT_DEPTH = 'default'
    const VIEW_CHOICES = ['auto', 'advanced']
    const PREFS_KEY = 'dsh-prompt-enhance.prefs'

    /**
     * Vocabulary the host sends as Chinese labels (`/state` → modes/variants/focuses/depths/
     * methodologies). The panel shows its own copy of these words so switching the language
     * does not leave half the panel in Chinese; unknown ids fall back to the host label.
     */
    const VOCAB = {
      mode: {
        code: { label: { zh: '代码', en: 'Code' } },
        creative: { label: { zh: '创作', en: 'Creative' } },
        doc: { label: { zh: '文档', en: 'Document' } },
      },
      variant: {
        'code-read': {
          label: { zh: '读取工作区后优化', en: 'Read the workspace first' },
          hint: {
            zh: '先扫描当前工作区的目录与关键文件，再按真实代码改写提示词',
            en: 'Scan the workspace and rewrite the prompt against the real code first.',
          },
        },
        'code-only': {
          label: { zh: '仅按提示词优化', en: 'Prompt only' },
          hint: {
            zh: '不读取代码，按提示词判断开发类型并补全开发框架',
            en: 'No code read: infer the development type and fill in the framework.',
          },
        },
        'creative-rich': {
          label: { zh: '补充丰富型', en: 'Enrich' },
          hint: {
            zh: '润色语言并扩写细节，让画面与人物更具体',
            en: 'Polish the wording and expand the detail.',
          },
        },
        'creative-structure': {
          label: { zh: '结构严谨型', en: 'Structure' },
          hint: {
            zh: '完善脚本、分镜或大纲的结构，让描述更精细严谨',
            en: 'Tighten the structure of a script, storyboard or outline.',
          },
        },
        'doc-fill': {
          label: { zh: '读文档后补写', en: 'Fill a document' },
          hint: {
            zh: '先读当前文档的框架与格式，再按既有结构补写缺失内容',
            en: "Read the document's skeleton and format, then fill in what is missing.",
          },
        },
        'doc-draft': {
          label: { zh: '按类型起草', en: 'Draft by type' },
          hint: {
            zh: '没有现成文档时，按文档类型给出完整框架与内容',
            en: 'No document yet: draft a full skeleton for this document type.',
          },
        },
      },
      focus: {
        framework: {
          label: { zh: '完善开发框架', en: 'Development framework' },
          hint: { zh: '模块划分、接口契约、测试与交付', en: 'Modules, interfaces, tests and delivery.' },
        },
        security: {
          label: { zh: '审查安全性', en: 'Security review' },
          hint: { zh: '威胁模型、输入校验、注入面与密钥', en: 'Threat model, input checks, injection surface and secrets.' },
        },
      },
      depth: {
        concise: {
          label: { zh: '简洁', en: 'Concise' },
          hint: {
            zh: '只留目标、硬约束与验收，约为严谨档的三分之一',
            en: 'Goal, hard constraints and acceptance only — about a third of thorough.',
          },
        },
        default: {
          label: { zh: '默认', en: 'Default' },
          hint: {
            zh: '分节但克制，约为严谨档的三分之二',
            en: 'Sectioned but restrained — about two thirds of thorough.',
          },
        },
        thorough: {
          label: { zh: '严谨', en: 'Thorough' },
          hint: {
            zh: '完整结构、分步计划与验收清单，Superpowers 平时的篇幅',
            en: "Full structure, step plan and acceptance list — Superpowers' usual length.",
          },
        },
      },
      methodology: {
        auto: { label: { zh: '自适应（推荐）', en: 'Adaptive (recommended)' } },
        superpower: { label: { zh: 'Superpowers', en: 'Superpowers' } },
        langgpt: { label: { zh: 'LangGPT 结构化提示词', en: 'LangGPT structured prompt' } },
        aishort: { label: { zh: 'AiShort 提示词库', en: 'AiShort prompt library' } },
        'prompt-optimizer': { label: { zh: 'Prompt Optimizer', en: 'Prompt Optimizer' } },
      },
      route: {
        methodology: { label: { zh: '方法论路线', en: 'Technique route' } },
        act: { label: { zh: '角色路线', en: 'Role route' } },
        structure: { label: { zh: '结构路线', en: 'Structure route' } },
      },
    }

    /** One word from the vocabulary, in the language being shown right now. */
    function word(language, kind, id, field = 'label') {
      const entry = VOCAB[kind] && VOCAB[kind][id]
      const value = entry && entry[field]
      if (!value) return ''
      return value[language] || value.zh || ''
    }


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

    function pickLanguage(prefs) {
      const saved = prefs && typeof prefs.lang === 'string' ? prefs.lang : ''
      return LANGUAGES.includes(saved) ? saved : defaultLanguage
    }

    function pickView(prefs) {
      const saved = prefs && typeof prefs.view === 'string' ? prefs.view : ''
      return VIEW_CHOICES.includes(saved) ? saved : 'auto'
    }

    /** Keep the tail of a workspace path so the note stays one line. */
    function shortPath(path) {
      const text = String(path || '')
      return text.length > 26 ? `…${text.slice(-25)}` : text
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
        throw new Error(message || copy().requestFailed(response.status))
      }
      return payload
    }

    /** POST a JSON body and consume the host's SSE response. */
    async function streamSse(path, body, handlers, signal) {
      const response = await fetch(apiPath(path), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      })
      const contentType = response.headers.get('content-type') || ''
      if (!response.ok || !contentType.includes('text/event-stream')) {
        let message = copy().requestFailed(response.status)
        try {
          const payload = await response.json()
          if (payload && payload.error && payload.error.message) message = payload.error.message
        } catch {
          /* keep default */
        }
        throw new Error(message)
      }
      if (!response.body || typeof response.body.getReader !== 'function') {
        throw new Error(copy().streamUnsupported)
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
        const handler = name && handlers[name]
        if (typeof handler === 'function') handler(payload)
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

    /** Single-shot enhancement (`/enhance`). */
    function streamEnhance(body, handlers, signal) {
      return streamSse('/enhance', body, handlers, signal)
    }

    /** Automatic mode (`/candidates`): three route-tagged candidates. */
    function streamCandidates(body, handlers, signal) {
      return streamSse('/candidates', body, handlers, signal)
    }

    /* ---------------------------------------------------------------- */
    /* styles                                                            */
    /* ---------------------------------------------------------------- */

    const CSS = `
/* Styling follows DeepSeek Harness docs/web-styling.zh.md: semantic --dsw-alias-* tokens
   only (no colour literals), 0.5px hairlines for neutral borders, state borders stay 1px,
   capsule/circle radii pair corner-shape: round, hover behind (hover: hover), and every
   font-size declares its line-height. The panel is a floating surface: no border, the
   elevation token draws the stroke. */
.dpe-root { position: relative; display: inline-flex; align-items: center; }
.dpe-trigger {
  display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px;
  border-radius: 999px; corner-shape: round; border: 0.5px solid var(--dsw-alias-border-l3);
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12px; line-height: 16px; cursor: pointer; white-space: nowrap;
  transition: background-color .15s ease, color .15s ease, border-color .15s ease;
}
.dpe-trigger[data-open="true"] {
  background: var(--dsw-alias-interactive-bg-hover-solid);
  color: var(--dsw-alias-label-primary);
  border-color: var(--dsw-alias-border-l3);
}
.dpe-trigger:disabled { opacity: .45; cursor: not-allowed; }
.dpe-trigger:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; }
.dpe-icon { width: 14px; height: 14px; flex: none; color: var(--dsw-alias-state-business-primary); }

.dpe-panel {
  position: fixed; inset: auto; margin: 0; z-index: 60; display: flex; flex-direction: column; gap: 10px;
  box-sizing: border-box;
  padding: 14px; border: 0; border-radius: var(--dsw-radius-panel, 14px);
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
  box-shadow: var(--dsw-elevation-panel);
  font-size: 13px; line-height: 20px;
  overflow: auto; overscroll-behavior: contain;
}
.dpe-head { display: flex; align-items: flex-start; gap: 8px; }
.dpe-head-main { flex: 1; min-width: 0; }
.dpe-langs { display: inline-flex; align-items: center; gap: 4px; }
.dpe-lang { height: 22px; padding: 0 7px; font-size: 11px; line-height: 16px; }
.dpe-title { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.dpe-sub { margin-top: 2px; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary); }
.dpe-x {
  flex: none; width: 22px; height: 22px; border-radius: 6px; border: 0; cursor: pointer;
  background: transparent; color: var(--dsw-alias-label-tertiary); font-size: 14px; line-height: 14px;
}

.dpe-tabs { display: flex; gap: 4px; padding: 3px; border-radius: 10px; background: var(--dsw-alias-interactive-bg-hover); }
.dpe-tab {
  flex: 1; height: 26px; border: 0; border-radius: 8px; cursor: pointer; background: transparent;
  color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; line-height: 18px;
}
.dpe-tab[data-active="true"] {
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
  box-shadow: var(--dsw-elevation-soft);
}

.dpe-cards { display: flex; flex-direction: column; gap: 6px; }
.dpe-card {
  display: flex; gap: 8px; align-items: flex-start; width: 100%; text-align: left; cursor: pointer;
  padding: 8px 10px; border-radius: 10px; border: 0.5px solid var(--dsw-alias-border-l2);
  background: transparent; color: inherit; font: inherit;
}
.dpe-card[data-active="true"] {
  border: 1px solid var(--dsw-alias-state-business-primary);
  background: var(--dsw-alias-state-business-tertiary);
}
.dpe-radio {
  flex: none; width: 13px; height: 13px; margin-top: 3px;
  border-radius: 50%; corner-shape: round; border: 1.5px solid var(--dsw-alias-border-l3);
}
.dpe-card[data-active="true"] .dpe-radio { border-color: var(--dsw-alias-state-business-primary); border-width: 4px; }
.dpe-card-body { min-width: 0; }
.dpe-card-title { font-size: 12.5px; line-height: 18px; font-weight: 500; }
.dpe-card-hint { margin-top: 2px; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary); }

.dpe-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dpe-label { font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary); }
.dpe-check {
  display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px; cursor: pointer;
  border-radius: 999px; corner-shape: round; border: 0.5px solid var(--dsw-alias-border-l2);
  background: transparent; color: var(--dsw-alias-label-secondary); font: inherit;
  font-size: 12px; line-height: 18px;
}
.dpe-check[data-active="true"] {
  border: 1px solid var(--dsw-alias-state-business-primary);
  color: var(--dsw-alias-state-business-primary);
  background: var(--dsw-alias-state-business-tertiary);
}
.dpe-select {
  height: 26px; border-radius: 8px; padding: 0 6px; font: inherit; font-size: 12px; line-height: 18px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-module-platform); color: inherit;
}

.dpe-note {
  padding: 7px 9px; border-radius: 9px; font-size: 11.5px; line-height: 17px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-tertiary);
}
.dpe-note b { color: var(--dsw-alias-label-secondary); font-weight: 500; }
.dpe-note-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; line-height: 16px; word-break: break-all; }
.dpe-note-error {
  border: 1px solid var(--dsw-alias-state-error-primary);
  color: var(--dsw-alias-state-error-primary);
}

.dpe-stream, .dpe-result {
  width: 100%; box-sizing: border-box; min-height: 132px; max-height: 260px; overflow: auto;
  padding: 9px 10px; border-radius: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11.5px; line-height: 17.8px; white-space: pre-wrap; word-break: break-word;
  border: 0.5px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-module-platform); color: inherit;
}
.dpe-result { resize: vertical; min-height: 150px; }

.dpe-actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.dpe-btn {
  height: 28px; padding: 0 12px; border-radius: 8px; cursor: pointer; font: inherit;
  font-size: 12px; line-height: 18px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  background: transparent; color: var(--dsw-alias-label-secondary);
}
.dpe-btn:disabled { opacity: .45; cursor: not-allowed; }
.dpe-btn-primary {
  border: 0; background: var(--dsw-alias-button-info-fill); color: #fff;
}
.dpe-btn-danger {
  border: 1px solid var(--dsw-alias-state-error-primary);
  color: var(--dsw-alias-state-error-primary);
}
.dpe-spacer { flex: 1; }
.dpe-meta { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary); }
.dpe-spin { display: inline-block; width: 10px; height: 10px; border-radius: 50%; corner-shape: round; border: 1.5px solid currentColor; border-top-color: transparent; animation: dpe-spin .8s linear infinite; }
@keyframes dpe-spin { to { transform: rotate(360deg); } }
.dpe-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

@media (hover: hover) {
  .dpe-trigger:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-solid); color: var(--dsw-alias-label-primary); }
  .dpe-x:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
  .dpe-card:hover { border-color: var(--dsw-alias-border-l3); }
  .dpe-card[data-active="true"]:hover { border-color: var(--dsw-alias-state-business-primary); }
  .dpe-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
  .dpe-btn-primary:hover:not(:disabled) { background: var(--dsw-alias-button-info-hover); color: #fff; }
  .dpe-tab:hover { color: var(--dsw-alias-label-primary); }
}
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
      const [lang, setLang] = useState(() => pickLanguage(prefs))
      /** Every string this render shows; the language chips swap the whole map. */
      const LABELS = COPY[lang] || COPY.zh
      const w = (kind, id, field = 'label') => word(lang, kind, id, field)
      const [open, setOpen] = useState(false)
      const [catalog, setCatalog] = useState(null)
      const [catalogError, setCatalogError] = useState('')
      const [view, setView] = useState(() => pickView(prefs))
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
      const [autoSlots, setAutoSlots] = useState([])
      const [autoMeta, setAutoMeta] = useState(null)
      const [autoStage, setAutoStage] = useState('idle')
      const [autoError, setAutoError] = useState('')

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
        writePrefs({ view, mode, variants, focus, depth, methodology, docPath, lang })
      }, [view, mode, variants, focus, depth, methodology, docPath, lang])

      useEffect(() => {
        currentLanguage = lang
      }, [lang])

      /* catalog -------------------------------------------------------- */

      const loadCatalog = useCallback(async () => {
        setCatalogError('')
        try {
          const payload = await readJson('/state', { method: 'GET' })
          setCatalog(payload)
        } catch (failure) {
          setCatalogError(failure && failure.message ? failure.message : LABELS.catalogFailed)
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
            setNotice(failure && failure.message ? failure.message : LABELS.workspaceFailed)
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
            setNotice(failure && failure.message ? failure.message : LABELS.documentFailed)
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
        const panel = panelRef.current
        const rect = node.getBoundingClientRect()
        const viewWidth = window.innerWidth
        const viewHeight = window.innerHeight
        // Leave the panel inside the viewport on narrow windows.
        const width = Math.max(240, Math.min(PANEL_WIDTH, viewWidth - PANEL_MARGIN * 2))
        const left = Math.max(PANEL_MARGIN, Math.min(rect.left, viewWidth - width - PANEL_MARGIN))
        const room = viewHeight - PANEL_MARGIN * 2
        const spaceAbove = rect.top - PANEL_MARGIN * 2
        const spaceBelow = viewHeight - rect.bottom - PANEL_MARGIN * 2
        // How tall the panel wants to be. It scrolls, so `scrollHeight` still
        // reports the full content height while a previous clamp is applied.
        const wanted = panel ? Math.ceil(panel.scrollHeight) : PANEL_MIN_USABLE
        const height = Math.max(PANEL_MIN_USABLE, Math.min(wanted, room, PANEL_MAX_HEIGHT))
        let next
        if (height <= spaceAbove) {
          next = { left, width, bottom: viewHeight - rect.top + PANEL_MARGIN, maxHeight: height }
        } else if (height <= spaceBelow) {
          next = { left, width, top: rect.bottom + PANEL_MARGIN, maxHeight: height }
        } else {
          // Neither side has room for the whole panel: slide it up (or down)
          // until it fits the window instead of shrinking it into a scroll box.
          const above = rect.top - height - PANEL_MARGIN
          const top = Math.min(Math.max(above, PANEL_MARGIN), Math.max(PANEL_MARGIN, viewHeight - height - PANEL_MARGIN))
          next = { left, width, top, maxHeight: height }
        }
        // Never sit on top of the button that opened the panel: when the panel
        // has to overlap the composer, slide it beside the trigger instead.
        const panelTop = next.top === undefined ? viewHeight - next.bottom - height : next.top
        const overlapsTrigger =
          panelTop + height > rect.top && panelTop < rect.bottom && left + width > rect.left && left < rect.right
        if (overlapsTrigger) {
          const besideLeft = rect.left - width - PANEL_MARGIN
          const besideRight = rect.right + PANEL_MARGIN
          if (besideLeft >= PANEL_MARGIN) next.left = besideLeft
          else if (besideRight + width <= viewWidth - PANEL_MARGIN) next.left = besideRight
        }
        setPlacement((previous) => {
          if (
            previous &&
            previous.left === next.left &&
            previous.width === next.width &&
            previous.maxHeight === next.maxHeight &&
            previous.top === next.top &&
            previous.bottom === next.bottom
          ) {
            return previous
          }
          return next
        })
      }, [])

      // Layout effect on purpose: the panel is fixed-positioned, so a post-paint
      // `useEffect` measurement would show one frame at the wrong spot.
      useLayoutEffect(() => {
        if (!open) {
          setPlacement(null)
          return undefined
        }
        recomputePlacement()
        const onResize = () => recomputePlacement()
        window.addEventListener('resize', onResize)
        window.addEventListener('scroll', onResize, true)
        const visual = window.visualViewport
        if (visual) {
          visual.addEventListener('resize', onResize)
          visual.addEventListener('scroll', onResize)
        }
        return () => {
          window.removeEventListener('resize', onResize)
          window.removeEventListener('scroll', onResize, true)
          if (visual) {
            visual.removeEventListener('resize', onResize)
            visual.removeEventListener('scroll', onResize)
          }
        }
      }, [open, recomputePlacement])

      // Re-measure when the content grows or shrinks (workspace note, stream, result).
      useEffect(() => {
        if (open) recomputePlacement()
      }, [open, catalog, documents, documentsBusy, stage, streamText, result, recomputePlacement])

      // Async content (workspace note, document list) can also grow without any
      // of the above changing, so measure after every render; the state guard
      // inside `recomputePlacement` keeps this from re-rendering in a loop.
      useLayoutEffect(() => {
        if (open) recomputePlacement()
      })

      // The top layer is the only place an ancestor stacking context cannot cover:
      // the composer sits in a `z-index: 1` stack below the hero mask, so a plain
      // fixed panel would render underneath it. Layout effect: show it before paint.
      useLayoutEffect(() => {
        const panel = panelRef.current
        if (!open || !panel || !HAS_POPOVER) return undefined
        try {
          if (!panel.matches(':popover-open')) panel.showPopover()
        } catch {
          /* already shown, or the element left the document */
        }
        return () => {
          try {
            if (panel.matches(':popover-open')) panel.hidePopover()
          } catch {
            /* the element was detached with the panel */
          }
        }
      }, [open])

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
                if (!text) setError(LABELS.emptyResult)
              },
              onError: (payload) => {
                settled = true
                setError((payload && payload.message) || LABELS.enhanceFailed)
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
            setError((failure && failure.message) || LABELS.enhanceFailed)
            setStage('error')
          }
        } finally {
          if (abortRef.current === controller) abortRef.current = null
        }
      }, [captureInsertion, docPath, documents, depth, focus, lang, methodology, mode, sessionCwd, sessionId, stage, trimmedDraft, variant, wantsDocument])

      useEffect(() => () => {
        if (abortRef.current) abortRef.current.abort()
      }, [])

      /* auto mode ------------------------------------------------------ */

      const resetAuto = useCallback(() => {
        setAutoStage('idle')
        setAutoSlots([])
        setAutoMeta(null)
        setProgress(null)
        setAutoError('')
        setNotice('')
      }, [])

      const startAuto = useCallback(async () => {
        if (autoStage === 'running') return
        const prompt = trimmedDraft
        if (!prompt) {
          setAutoError(LABELS.emptyDraft)
          return
        }
        setAutoError('')
        setNotice('')
        setAutoStage('running')
        setAutoSlots([])
        setAutoMeta(null)
        setProgress(null)
        insertionRef.current = captureInsertion()
        beat('auto-start', `${depth}`)

        const controller = new AbortController()
        abortRef.current = controller
        let settled = false
        const body = {
          prompt,
          depth,
          ...(sessionCwd ? { cwd: sessionCwd } : {}),
          ...(sessionId ? { sessionId } : {}),
        }

        try {
          await streamCandidates(
            body,
            {
              meta: (payload) => setAutoMeta(payload || null),
              status: (payload) => {
                if (!payload) return
                if (payload.stage === 'intent' || payload.stage === 'plan') setAutoMeta((previous) => ({ ...(previous || {}), ...payload }))
                setProgress(payload)
              },
              delta: (payload) => {
                const slot = payload && typeof payload.slot === 'number' ? payload.slot : 0
                const piece = payload && typeof payload.text === 'string' ? payload.text : ''
                if (!piece) return
                setAutoSlots((previous) => {
                  const next = previous.slice()
                  let record = next.find((item) => item.slot === slot)
                  if (!record) {
                    record = { slot, route: '', label: '', reason: '', text: '', status: 'running' }
                    next.push(record)
                  }
                  record.text += piece
                  return next
                })
              },
              'slot-error': (payload) => {
                const slot = payload && typeof payload.slot === 'number' ? payload.slot : 0
                setAutoSlots((previous) => {
                  const next = previous.slice()
                  let record = next.find((item) => item.slot === slot)
                  if (!record) {
                    record = { slot, route: '', label: '', reason: '', text: '', status: 'failed' }
                    next.push(record)
                  }
                  record.status = 'failed'
                  return next
                })
              },
              'slot-done': (payload) => {
                const slot = payload && typeof payload.slot === 'number' ? payload.slot : 0
                setAutoSlots((previous) => {
                  const next = previous.slice()
                  const record = next.find((item) => item.slot === slot)
                  if (record) record.status = 'done'
                  return next
                })
              },
              done: (payload) => {
                settled = true
                const slots = payload && Array.isArray(payload.slots) ? payload.slots : []
                setAutoSlots(
                  slots.map((item) => ({
                    slot: typeof item.slot === 'number' ? item.slot : 0,
                    route: typeof item.route === 'string' ? item.route : '',
                    label: typeof item.label === 'string' ? item.label : '',
                    labelEn: typeof item.labelEn === 'string' ? item.labelEn : '',
                    reason: typeof item.reason === 'string' ? item.reason : '',
                    text: typeof item.text === 'string' ? item.text : '',
                    status: 'done',
                  })),
                )
                setAutoMeta((previous) => ({
                  ...(previous || {}),
                  intent: payload && payload.intent,
                  intentSummary: payload && payload.intentSummary,
                  depth: payload && payload.depth,
                  durationMs: payload && payload.durationMs,
                }))
                setProgress(null)
                setAutoStage('done')
              },
              error: (payload) => {
                settled = true
                setAutoError((payload && payload.message) || LABELS.autoFailed)
                setAutoStage('error')
              },
            },
            controller.signal,
          )
          if (!settled) {
            setAutoStage((previous) => {
              if (previous !== 'running') return previous
              return 'done'
            })
          }
        } catch (failure) {
          if (failure && failure.name === 'AbortError') {
            setAutoSlots((previous) => {
              const next = previous.slice()
              for (const record of next) if (record.status === 'running') record.status = 'done'
              return next
            })
            setAutoStage((previous) => (previous === 'running' ? 'done' : previous))
          } else {
            setAutoError((failure && failure.message) || LABELS.autoFailed)
            setAutoStage('error')
          }
        } finally {
          if (abortRef.current === controller) abortRef.current = null
        }
      }, [autoStage, captureInsertion, depth, lang, sessionCwd, sessionId, trimmedDraft])

      /* apply ---------------------------------------------------------- */

      const writeDraft = useCallback(
        (text) => {
          if (!inputActions) {
            setError(LABELS.noInput)
            return false
          }
          try {
            if (typeof inputActions.setDraft === 'function') {
              inputActions.setDraft(text)
            } else if (typeof inputActions.insertText === 'function') {
              inputActions.insertText(text, insertionRef.current || { start: 0, end: 0, draftRev })
            } else {
              setError(LABELS.insertUnsupported)
              return false
            }
            if (typeof inputActions.persistDraft === 'function') inputActions.persistDraft()
            return true
          } catch (failure) {
            setError((failure && failure.message) || LABELS.insertFailed)
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
          setError(LABELS.copyFailed)
        }
      }, [result])

      const useCandidate = useCallback(
        (text) => {
          const value = typeof text === 'string' ? text.trim() : ''
          if (!value) return
          if (writeDraft(value)) {
            setNotice(LABELS.autoUsed)
            window.setTimeout(() => setNotice(''), 1600)
            setOpen(false)
          }
        },
        [writeDraft],
      )

      const copyCandidate = useCallback(async (text) => {
        const value = typeof text === 'string' ? text.trim() : ''
        if (!value) return
        try {
          await navigator.clipboard.writeText(value)
          setNotice(LABELS.copied)
          window.setTimeout(() => setNotice(''), 1600)
        } catch {
          setNotice(LABELS.copyFailed)
        }
      }, [])

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
            left: `${Math.round(placement.left)}px`,
            width: `${Math.round(placement.width)}px`,
            maxHeight: `${Math.round(placement.maxHeight)}px`,
            ...(placement.bottom !== undefined ? { bottom: `${Math.round(placement.bottom)}px` } : {}),
            ...(placement.top !== undefined ? { top: `${Math.round(placement.top)}px` } : {}),
          }
        : { left: `${PANEL_MARGIN}px`, width: `${PANEL_WIDTH}px`, bottom: '80px', maxHeight: `${PANEL_MAX_HEIGHT}px` }

      const renderPanel = () => {
        const languageChips = h(
          'div',
          { className: 'dpe-langs', role: 'group', 'aria-label': LABELS.language, title: LABELS.languageHint },
          ...LANGUAGES.map((id) =>
            h(
              'button',
              {
                key: id,
                type: 'button',
                className: 'dpe-check dpe-lang',
                'data-active': lang === id ? 'true' : 'false',
                'aria-pressed': lang === id,
                'aria-label': `${LABELS.language}: ${LANGUAGE_LABELS[id]}`,
                title: LABELS.languageHint,
                onClick: () => setLang(id),
              },
              LANGUAGE_LABELS[id],
            ),
          ),
        )

        const head = h(
          'div',
          { className: 'dpe-head' },
          h(
            'div',
            { className: 'dpe-head-main' },
            h('div', { className: 'dpe-title' }, LABELS.title),
            h('div', { className: 'dpe-sub' }, LABELS.subtitle),
          ),
          languageChips,
          h('button', { type: 'button', className: 'dpe-x', onClick: () => setOpen(false), 'aria-label': LABELS.close, title: LABELS.close }, '×'),
        )

        const viewTabs = h(
          'div',
          { className: 'dpe-tabs dpe-view-tabs', role: 'tablist', 'aria-label': LABELS.viewLabel },
          ...VIEW_CHOICES.map((id) =>
            h(
              'button',
              {
                key: id,
                type: 'button',
                role: 'tab',
                className: 'dpe-tab',
                'data-active': view === id ? 'true' : 'false',
                'aria-selected': view === id ? 'true' : 'false',
                onClick: () => {
                  setView(id)
                  setError('')
                  setAutoError('')
                },
              },
              id === 'auto' ? LABELS.tabAuto : LABELS.tabAdvanced,
            ),
          ),
        )

        const tabs = h(
          'div',
          { className: 'dpe-tabs', role: 'tablist', 'aria-label': LABELS.tabsLabel },
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
              w('mode', entry.id) || entry.label,
            ),
          ),
        )

        const cards = h(
          'div',
          { className: 'dpe-cards', role: 'radiogroup', 'aria-label': LABELS.cardsLabel },
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
                h('span', { className: 'dpe-card-title' }, w('variant', entry.id) || entry.label),
                w('variant', entry.id, 'hint') || entry.hint
                  ? h(
                      'span',
                      { className: 'dpe-card-hint', style: { display: 'block' } },
                      w('variant', entry.id, 'hint') || entry.hint,
                    )
                  : null,
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
                      title: w('focus', entry.id, 'hint') || entry.hint || entry.label,
                      onClick: () => toggleFocus(entry.id),
                    },
                    w('focus', entry.id) || entry.label,
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
                    title: w('depth', entry.id, 'hint') || entry.hint || entry.label,
                    onClick: () => setDepth(entry.id),
                  },
                  w('depth', entry.id) || entry.label,
                ),
              ),
              h(
                'span',
                { className: 'dpe-label' },
                w('depth', depth, 'hint') || (catalogDepths.find((entry) => entry.id === depth) || {}).hint || '',
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
              ? catalogMethods.map((entry) =>
                  h('option', { key: entry.id, value: entry.id }, w('methodology', entry.id) || entry.label),
                )
              : [h('option', { key: 'auto', value: 'auto' }, LABELS.methodologyAuto)]),
          ),
          meta && (w('methodology', meta.methodology) || meta.methodologyLabel)
            ? h('span', { className: 'dpe-label' }, `→ ${w('methodology', meta.methodology) || meta.methodologyLabel}`)
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
                      ? h('div', { className: 'dpe-note-mono' }, workspace.files.slice(0, 3).map(shortPath).join(' · '))
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
                workspaceBusy ? LABELS.workspaceBusy : LABELS.workspaceRefresh,
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
                      h('option', { key: entry.path, value: entry.path }, LABELS.docOption(entry.path, entry.chars)),
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
                documentsBusy ? LABELS.workspaceBusy : LABELS.documentRefresh,
              ),
            )
          : null

        const errorNote = error
          ? h('div', { className: 'dpe-note dpe-note-error' }, LABELS.errorPrefix, error)
          : catalogError
            ? h('div', { className: 'dpe-note dpe-note-error' }, LABELS.errorPrefix, catalogError)
            : null

        const autoErrorNote = autoError
          ? h('div', { className: 'dpe-note dpe-note-error' }, LABELS.errorPrefix, autoError)
          : null

        const autoNoticeLine = autoMeta && autoMeta.intent
          ? h(
              'div',
              { className: 'dpe-meta' },
              h('span', null, `${LABELS.autoIntent}: ${LABELS.intentOf(autoMeta.intent)}`),
              autoMeta.intentSummary ? h('span', null, autoMeta.intentSummary) : null,
              autoMeta.durationMs ? h('span', null, `${(autoMeta.durationMs / 1000).toFixed(1)}s`) : null,
            )
          : null

        const autoCandidates = autoSlots.length
          ? h(
              'div',
              { className: 'dpe-auto-candidates' },
              h('div', { className: 'dpe-label' }, LABELS.autoCandidates),
              h('div', { className: 'dpe-label dpe-sub' }, LABELS.autoPickHint),
              ...autoSlots.map((item) => {
                const routeLabel = item.route ? w('route', item.route) || item.route : item.route
                const label = item.label || routeLabel
                const statusText =
                  item.status === 'running'
                    ? LABELS.autoRunning
                    : item.status === 'failed'
                      ? LABELS.slotFailed
                      : ''
                return h(
                  'div',
                  { key: item.slot, className: 'dpe-card dpe-auto-card', 'data-status': item.status },
                  h(
                    'div',
                    { className: 'dpe-card-title' },
                    `${routeLabel ? `${routeLabel} · ` : ''}${label}`,
                  ),
                  item.reason ? h('div', { className: 'dpe-card-hint' }, item.reason) : null,
                  h('div', { className: 'dpe-stream dpe-auto-text' }, item.text || statusText || LABELS.slotWaiting),
                  h(
                    'div',
                    { className: 'dpe-actions' },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'dpe-btn dpe-btn-primary',
                        disabled: !item.text.trim(),
                        onClick: () => useCandidate(item.text),
                      },
                      LABELS.autoUse,
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'dpe-btn',
                        disabled: !item.text.trim(),
                        onClick: () => copyCandidate(item.text),
                      },
                      LABELS.autoCopy,
                    ),
                  ),
                )
              }),
            )
          : null

        const autoBody = h(
          'div',
          null,
          h('div', { className: 'dpe-label dpe-sub' }, LABELS.autoHint),
          autoStage === 'running'
            ? h(
                'div',
                null,
                h('div', { className: 'dpe-stream', ref: streamRef }, runningHint),
                h(
                  'div',
                  { className: 'dpe-actions', style: { marginTop: '8px' } },
                  h('button', { type: 'button', className: 'dpe-btn dpe-btn-danger', onClick: stop }, LABELS.stop),
                  h('span', { className: 'dpe-label' }, LABELS.streamHint),
                ),
              )
            : h(
                'div',
                { className: 'dpe-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dpe-btn dpe-btn-primary',
                    disabled: !trimmedDraft,
                    onClick: startAuto,
                  },
                  LABELS.autoStart,
                ),
                h('span', { className: 'dpe-label' }, trimmedDraft ? LABELS.readyHint : LABELS.emptyDraft),
              ),
          autoNoticeLine,
          autoCandidates,
          autoStage === 'idle' && autoError ? autoErrorNote : null,
          depthRow,
        )

        const metaLine = meta
          ? h(
              'div',
              { className: 'dpe-meta' },
              meta.provider && meta.model ? h('span', null, `${LABELS.metaModel} ${meta.provider}/${meta.model}`) : null,
              meta.methodologyLabel ? h('span', null, `${LABELS.metaMethod} ${meta.methodologyLabel}`) : null,
              meta.depthLabel
                ? h('span', null, `${LABELS.metaDepth} ${meta.depthLabel}${meta.depthBudget ? LABELS.budgetSuffix(meta.depthBudget) : ''}`)
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
        const runningHint = reasoningChars > 0 ? `${LABELS.thinking}…${LABELS.reasoningSuffix(reasoningChars)}` : LABELS.running

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
            ...(HAS_POPOVER ? { popover: 'manual' } : {}),
            role: 'dialog',
            'aria-label': LABELS.title,
            'aria-modal': 'false',
            style: panelStyle,
          },
          head,
          catalogError ? errorNote : null,
          viewTabs,
          view === 'auto' ? autoBody : [tabs, cards, focusRow, depthRow, methodRow, workspaceNote, documentNote],
          view === 'advanced' && stage === 'idle' && error ? errorNote : null,
          view === 'advanced' ? body : null,
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
        beat('client-apply', 'v1.5.0')
        // Follow DeepSeek Harness on first run; an explicit choice overrides it.
        try {
          const locale = typeof ctx.get === 'function' ? ctx.get('locale') : null
          const active = locale && typeof locale.getLocale === 'function' ? locale.getLocale() : null
          const id = active && typeof active.active === 'string' ? active.active : ''
          defaultLanguage = id.toLowerCase().startsWith('en') ? 'en' : 'zh'
          currentLanguage = defaultLanguage
        } catch {
          /* the locale service is optional */
        }
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
