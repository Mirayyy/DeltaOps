import vm from 'node:vm'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as vue from 'vue'
import * as pinia from 'pinia'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value))

// Runs the real stores/helpers with an in-memory Firestore boundary. No credentials,
// application bootstrap, SDK connection or network access is available in this VM.
export async function createHarness({ env = {} } = {}) {
  pinia.setActivePinia(pinia.createPinia())
  const docs = new Map(), writes = [], warnings = [], failures = new Set()
  let serial = 0
  const auth = vue.reactive({ isLoggedIn: true, isUserAdmin: true, userRole: 'admin',
    firebaseUser: { uid: 'u-admin', displayName: 'Account', email: 'admin@test' },
    user: { uid: 'u-admin', displayName: 'Account', email: 'admin@test', role: 'admin' },
    player: { uid: 'p-admin', nickname: 'Ястреб' },
  })
  const hooks = { beforeWrite: null, beforeRead: null }
  const ref = path => ({ path, id: path.split('/').at(-1) })
  const snapshot = (key, value) => ({ id: key.split('/').at(-1), ref: ref(key), exists: () => value !== undefined, data: () => copy(value) })
  async function prepare(ref, data, kind) {
    if (hooks.beforeWrite) await hooks.beforeWrite(ref, data, kind)
    if (failures.has(ref.path) || failures.has(ref.path.split('/')[0])) throw Object.assign(new Error('Simulated write failure'), { code: 'permission-denied' })
  }
  function apply(ref, data, kind, merge = false) {
    writes.push({ path: ref.path, data: copy(data), kind })
    if (kind === 'delete') docs.delete(ref.path)
    else docs.set(ref.path, merge ? { ...docs.get(ref.path), ...copy(data) } : copy(data))
  }
  const firestore = {
    db: {}, collection: (_db, name) => ref(name),
    doc: (parent, ...parts) => ref(parts.length ? (parent.path ? parent.path + '/' : '') + parts.join('/') : parent.path + '/log-' + (++serial)),
    serverTimestamp: () => new Date(1760000000000 + serial++).toISOString(),
    setDoc: async (ref, data, options) => { const frozen = copy(data); await prepare(ref, frozen, 'set'); apply(ref, frozen, 'set', options?.merge) },
    updateDoc: async (ref, data) => { await prepare(ref, data, 'update'); apply(ref, data, 'update', true) },
    deleteDoc: async ref => { await prepare(ref, null, 'delete'); apply(ref, null, 'delete') },
    getDoc: async ref => { if (hooks.beforeRead) await hooks.beforeRead(ref); return snapshot(ref.path, docs.get(ref.path)) },
    query: (ref, ...constraints) => ({ ...ref, constraints }),
    where: (field, op, value) => ({ type: 'where', field, op, value }),
    orderBy: (field, direction) => ({ type: 'orderBy', field, direction }),
    limit: value => ({ type: 'limit', value }), startAfter: value => ({ type: 'startAfter', value }),
    getDocs: async query => {
      if (hooks.beforeRead) await hooks.beforeRead(query)
      let entries = [...docs].filter(([key]) => key.startsWith(query.path + '/') && key.split('/').length === query.path.split('/').length + 1)
      for (const c of query.constraints || []) {
        if (c.type === 'where') entries = entries.filter(([, v]) => v[c.field] === c.value)
        if (c.type === 'orderBy') entries.sort(([ak, a], [bk, b]) => String(b[c.field]).localeCompare(String(a[c.field])) || bk.localeCompare(ak))
        if (c.type === 'startAfter') entries = entries.slice(entries.findIndex(([k]) => k === c.value.ref.path) + 1)
        if (c.type === 'limit') entries = entries.slice(0, c.value)
      }
      const result = entries.map(([k, v]) => snapshot(k, v))
      return { docs: result, empty: !result.length }
    },
    onSnapshot: (ref, fn) => { firestore.getDocs(ref).then(fn); return () => {} },
    writeBatch: () => {
      const operations = []
      return {
        set: (ref, data, options) => operations.push([ref, copy(data), 'set', options?.merge]),
        delete: ref => operations.push([ref, null, 'delete']),
        commit: async () => { for (const args of operations) await prepare(...args); for (const args of operations) apply(...args) },
      }
    },
  }
  for (const name of ['logs', 'users', 'players', 'missions', 'games', 'slotRequests', 'attendance', 'rotations', 'archive', 'structures']) firestore[name + 'Ref'] = ref(name)
  firestore.configRef = ref('config/app'); firestore.squadConfigRef = ref('config/squad'); firestore.weekConfigRef = ref('config/week')
  const context = vm.createContext({ console: { ...console, warn: (...args) => warnings.push(args) }, setTimeout, clearTimeout, URL,
    crypto: { randomUUID: () => 'operation-' + (++serial) }, fetch: async () => { throw new Error('No network in tests') },
  })
  const cache = new Map()
  const stubs = new Map([
    [path.join(root, 'src/firebase/firestore.js'), firestore],
    [path.join(root, 'src/firebase/config.js'), { firebaseProjectId: 'test', auth: null }],
    [path.join(root, 'src/stores/auth.js'), { useAuthStore: () => auth }],
    [path.join(root, 'src/composables/useToast.js'), { useToast: () => ({ warning: message => warnings.push(message), error: message => warnings.push(message) }) }],
    ['vue', vue], ['pinia', pinia], ['firebase/firestore', firestore],
  ])
  async function getModule(id) {
    if (cache.has(id)) return cache.get(id)
    let mod
    if (stubs.has(id)) {
      const values = stubs.get(id)
      mod = new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value) }, { context, identifier: id })
    } else {
      const source = await fs.readFile(id, 'utf8')
      mod = new vm.SourceTextModule(source, { context, identifier: id, initializeImportMeta: meta => { meta.env = env },
        importModuleDynamically: async (specifier, referencing) => {
          const child = await getModule(resolve(specifier, referencing.identifier))
          if (child.status === 'unlinked') await child.link(linker)
          if (child.status === 'linked') await child.evaluate()
          return child
        },
      })
    }
    cache.set(id, mod)
    return mod
  }
  function resolve(specifier, parent) {
    if (!specifier.startsWith('.')) return specifier
    const file = path.resolve(path.dirname(parent), specifier)
    return path.extname(file) ? file : file + '.js'
  }
  const linker = (specifier, parent) => getModule(resolve(specifier, parent.identifier))
  async function load(relative) {
    const mod = await getModule(path.join(root, relative))
    if (mod.status === 'unlinked') await mod.link(linker)
    if (mod.status === 'linked') await mod.evaluate()
    return mod.namespace
  }
  return { docs, writes, warnings, failures, hooks, auth, load,
    logs: () => writes.filter(w => w.path.startsWith('logs/')).map(w => w.data),
  }
}
