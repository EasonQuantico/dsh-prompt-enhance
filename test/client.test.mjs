import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
const clientPath = join(here, '..', 'client.js')
const source = await readFile(clientPath, 'utf8')

/** Minimal React stand-in: enough to walk the render body without a reconciler. */
function makeReact() {
  return new Proxy(
    {
      Fragment: Symbol('Fragment'),
      createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
      useRef: (initial) => ({ current: initial }),
      useEffect: () => {},
      useLayoutEffect: () => {},
      useMemo: (factory) => factory(),
      useCallback: (fn) => fn,
      useReducer: (state) => [state, () => {}],
      useContext: () => ({}),
    },
    {
      get(target, key) {
        if (key in target) return target[key]
        return () => null
      },
      has() {
        return true
      },
    },
  )
}

function loadPlugin() {
  let definition = null
  const sandbox = {
    document: { baseURI: 'http://127.0.0.1:2896/' },
    window: {
      location: { href: 'http://127.0.0.1:2896/' },
      setTimeout: () => 0,
      clearTimeout: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      __ModuleLoader__: { load: (loaded) => (definition = loaded) },
    },
    navigator: { clipboard: { writeText: async () => {} } },
    fetch: () => Promise.resolve({ ok: true, json: async () => ({ ok: true }) }),
    AbortController,
    TextDecoder,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    console,
  }
  sandbox.globalThis = sandbox
  vm.runInNewContext(source, sandbox, { filename: 'client.js' })
  assert.ok(definition, 'client.js should call window.__ModuleLoader__.load')
  return definition
}

function instantiate() {
  const definition = loadPlugin()
  const requested = []
  const plugin = definition.factory((id) => {
    requested.push(id)
    if (id === 'react') return makeReact()
    throw new Error(`unexpected require(${id})`)
  })
  return { definition, plugin, requested }
}

/** Walk a React-element lookalike tree, collecting tags, classes and text. */
function walk(node, out = { tags: [], classes: [], texts: [] }) {
  if (node === null || node === undefined || typeof node === 'boolean') return out
  if (typeof node === 'string' || typeof node === 'number') {
    out.texts.push(String(node))
    return out
  }
  if (Array.isArray(node)) {
    for (const child of node) walk(child, out)
    return out
  }
  if (typeof node !== 'object') return out
  const tag = typeof node.type === 'function' ? node.type.name || 'component' : String(node.type)
  out.tags.push(tag)
  const className = node.props && node.props.className
  if (className) out.classes.push(String(className))
  for (const child of node.children || []) walk(child, out)
  const children = node.props && node.props.children
  if (children !== undefined) walk(children, out)
  return out
}

test('module registers itself against the DSH module loader', () => {
  const { definition } = instantiate()
  assert.equal(definition.id, 'dsh-prompt-enhance')
  assert.equal(typeof definition.factory, 'function')
})

test('browser half only requires react', () => {
  const { plugin, requested } = instantiate()
  assert.deepEqual([...plugin.inject], ['slots'])
  plugin.apply({ slots: { inject: (name, run) => run(), register: () => () => {} } })
  assert.deepEqual([...new Set(requested)], ['react'])
})

test('component is registered on the composer control row', () => {
  const { plugin } = instantiate()
  const seen = []
  plugin.apply({
    slots: {
      inject: (name, run) => {
        seen.push(['inject', name])
        return run()
      },
      register: (target, component) => {
        seen.push(['register', target.name, target.id, target.order, typeof component])
        return () => {}
      },
    },
  })

  assert.deepEqual(seen[0], ['inject', 'conversation.input.right'])
  const register = seen.find((entry) => entry[0] === 'register')
  assert.ok(register, 'component should be registered')
  assert.equal(register[1], 'conversation.input.right')
  assert.equal(register[2], 'prompt-enhance-trigger')
  assert.equal(register[3], 20)
  assert.equal(register[4], 'function')
})

test('render body produces the trigger button with its label', () => {
  const { plugin } = instantiate()
  let Component = null
  plugin.apply({
    slots: { inject: (name, run) => run(), register: (target, component) => ((Component = component), () => {}) },
  })
  assert.equal(typeof Component, 'function')

  const tree = Component({
    sessionId: 'session-1',
    inputActions: {
      captureInsertion: () => ({ draftRev: 1 }),
      insertText: () => true,
      setDraft: () => {},
      persistDraft: () => {},
    },
    useInput: (selector) => selector({ draft: '做一个批量重命名图片的小工具', draftRev: 1, phase: 'idle', attachmentIds: [] }),
    useSessions: (selector) => selector({ byId: { 'session-1': { cwd: '/tmp/workspace' } } }),
  })

  const { tags, classes, texts } = walk(tree)
  assert.ok(tags.includes('button'), 'trigger should be a button')
  assert.ok(classes.some((name) => name.includes('dpe-trigger')), 'trigger keeps its own class prefix')
  assert.ok(texts.join('').includes('提示词增强'), 'trigger label is localised')

  // Collapsed by default: the panel only mounts after a click.
  assert.equal(classes.some((name) => name.includes('dpe-panel')), false)
})

test('render body tolerates missing slot props', () => {
  const { plugin } = instantiate()
  let Component = null
  plugin.apply({
    slots: { inject: (name, run) => run(), register: (target, component) => ((Component = component), () => {}) },
  })
  // No useInput / useSessions / inputActions at all: the component must not throw.
  const tree = Component({})
  const { classes } = walk(tree)
  assert.ok(classes.some((name) => name.includes('dpe-trigger')))
})

test('browser half obeys the plugin rules', () => {
  assert.equal(/require\(['"]@deepseek-ai\//.test(source), false, 'must not require harness client packages')
  assert.equal(/import\s+[^'"]*from\s+['"]@deepseek-ai\//.test(source), false, 'must not import harness packages')
  assert.equal(source.includes('document.body'), false, 'must not append a second app to document.body')
  assert.equal(/\bdocument\.querySelector\(/.test(source), false, 'must not read other plugins through the DOM')
  assert.ok(source.includes('--dsw-alias-'), 'styles should use theme tokens')
  assert.ok(source.includes("'conversation.input.right'"), 'slot name lives in source')
  assert.ok(source.includes('dsh-prompt-enhance.prefs'), 'preferences key is namespaced')
})
