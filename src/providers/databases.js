import { MockService, json, counter } from '../harness.js'

/**
 * PostgreSQL.
 *
 * The PostgreSQL wire protocol is complex, so this mock provides a REST API
 * that mimics common PostgreSQL operations over HTTP for testing.
 * The shapes match common ORMs and query builders.
 *
 * The reference decides: a query with `success` succeeds, `failed` fails.
 */
export function createPostgresMock() {
  const service = new MockService('postgres')

  service.state.tables = new Map()
  service.state.transactions = new Map()

  let txId = 1000

  const nextTxId = () => `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'postgres-mock' })
  })

  service.on('POST', '/query', (req, res) => {
    const body = req.json ?? {}
    const query = body.query ?? ''
    const params = body.params ?? []
    const isFailed = failed(query)

    if (isFailed) {
      json(res, 400, { error: 'query failed', detail: 'Simulated query failure' })
      return
    }

    if (query.toLowerCase().startsWith('select')) {
      json(res, 200, {
        command: 'SELECT',
        rowCount: 0,
        rows: [],
        fields: [],
      })
    } else if (query.toLowerCase().startsWith('insert')) {
      json(res, 200, {
        command: 'INSERT',
        rowCount: 1,
        oid: 0,
        rows: [{ id: 1, ...Object.fromEntries(params.map((_, i) => [`$${i + 1}`, params[i]])) }],
      })
    } else if (query.toLowerCase().startsWith('update')) {
      json(res, 200, { command: 'UPDATE', rowCount: 1 })
    } else if (query.toLowerCase().startsWith('delete')) {
      json(res, 200, { command: 'DELETE', rowCount: 1 })
    } else if (query.toLowerCase().startsWith('create table')) {
      json(res, 200, { command: 'CREATE TABLE', rowCount: 0 })
    } else {
      json(res, 200, { command: 'OK', rowCount: 0 })
    }
  })

  service.on('POST', '/transaction/begin', (req, res) => {
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    service.state.transactions.set(txId, { queries: [], status: 'active' })
    json(res, 200, { transactionId: txId, status: 'started' })
  })

  service.on('POST', '/transaction/:txId/query', (req, res) => {
    const txId = req.params.txId
    const tx = service.state.transactions.get(txId)

    if (!tx) {
      json(res, 404, { error: 'Transaction not found' })
      return
    }

    const body = req.body ?? {}
    const query = body.query ?? ''
    tx.queries.push(query)

    json(res, 200, { query, transactionId: txId })
  })

  service.on('POST', '/transaction/:txId/commit', (req, res) => {
    const txId = req.params.txId
    const tx = service.state.transactions.get(txId)

    if (!tx) {
      json(res, 404, { error: 'Transaction not found' })
      return
    }

    tx.status = 'committed'
    json(res, 200, { transactionId: txId, status: 'committed', queries: tx.queries.length })
  })

  service.on('POST', '/transaction/:txId/rollback', (req, res) => {
    const txId = req.params.txId
    const tx = service.state.transactions.get(txId)

    if (!tx) {
      json(res, 404, { error: 'Transaction not found' })
      return
    }

    tx.status = 'rolled_back'
    json(res, 200, { transactionId: txId, status: 'rolled_back' })
  })

  service.on('GET', '/tables', (req, res) => {
    const tables = Array.from(service.state.tables.values())
    json(res, 200, { tables })
  })

  return service
}

/**
 * MySQL.
 *
 * The MySQL protocol mock - provides REST API for common MySQL operations.
 * Compatible with common MySQL drivers and ORMs.
 *
 * The reference decides: a query with `success` succeeds, `failed` fails.
 */
export function createMysqlMock() {
  const service = new MockService('mysql')

  service.state.tables = new Map()
  service.state.databases = new Map()

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'mysql-mock' })
  })

  service.on('POST', '/query', (req, res) => {
    const body = req.json ?? {}
    const query = body.query ?? ''
    const isFailed = failed(query)

    if (isFailed) {
      json(res, 400, { error: { code: 'ER_QUERY_FAILED', message: 'Query failed', errno: 1064 } })
      return
    }

    if (query.toLowerCase().startsWith('select')) {
      json(res, 200, { rows: [], fields: [], affectedRows: 0, insertId: 0, serverStatus: 2, warningCount: 0 })
    } else if (query.toLowerCase().startsWith('insert')) {
      json(res, 200, { affectedRows: 1, insertId: 1, serverStatus: 2, warningCount: 0 })
    } else if (query.toLowerCase().startsWith('update')) {
      json(res, 200, { affectedRows: 1, changedRows: 1, serverStatus: 2, warningCount: 0 })
    } else if (query.toLowerCase().startsWith('delete')) {
      json(res, 200, { affectedRows: 1, serverStatus: 2, warningCount: 0 })
    } else if (query.toLowerCase().startsWith('create table')) {
      json(res, 200, { affectedRows: 0, serverStatus: 2, warningCount: 0 })
    } else if (query.toLowerCase().startsWith('show tables')) {
      json(res, 200, { rows: Array.from(service.state.tables.keys()).map(t => ({ Tables_in_mock: t })) })
    } else if (query.toLowerCase().startsWith('show databases')) {
      json(res, 200, { rows: [{ Database: 'mock' }, { Database: 'information_schema' }] })
    } else {
      json(res, 200, { affectedRows: 0, serverStatus: 2, warningCount: 0 })
    }
  })

  service.on('GET', '/databases', (req, res) => {
    json(res, 200, { databases: ['mock', 'information_schema', 'performance_schema'] })
  })

  service.on('POST', '/databases', (req, res) => {
    const body = req.body ?? {}
    const name = body.name
    const isFailed = failed(name)

    if (isFailed) {
      json(res, 400, { error: { code: 'ER_DB_CREATE_EXISTS', message: 'Can\'t create database', errno: 1007 } })
      return
    }

    service.state.databases.set(name, { name, tables: new Map() })
    json(res, 200, { database: name, created: true })
  })

  service.on('GET', '/tables', (req, res) => {
    const db = req.query.database ?? 'mock'
    const tables = Array.from(service.state.tables.keys()).filter(t => t.startsWith(db + '.'))
    json(res, 200, { tables })
  })

  return service
}

/**
 * MongoDB.
 *
 * The MongoDB wire protocol mock - provides REST API for common MongoDB operations.
 * Compatible with MongoDB drivers and ODMs.
 *
 * The reference decides: an operation with `success` succeeds, `failed` fails.
 */
export function createMongodbMock() {
  const service = new MockService('mongodb')

  service.state.databases = new Map()

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'mongodb-mock' })
  })

  service.on('GET', '/databases', (req, res) => {
    const databases = Array.from(service.state.databases.keys())
    json(res, 200, { databases, totalSize: databases.length })
  })

  service.on('POST', '/databases', (req, res) => {
    const body = req.body ?? {}
    const name = body.name
    const isFailed = failed(name)

    if (isFailed) {
      json(res, 400, { error: 'Failed to create database', code: 1007 })
      return
    }

    service.state.databases.set(name, { collections: new Map() })
    json(res, 200, { name, created: true })
  })

  const getDb = (req) => {
    const dbName = req.headers['x-database'] ?? req.query.database ?? 'mock'
    if (!service.state.databases.has(dbName)) {
      service.state.databases.set(dbName, { collections: new Map() })
    }
    return service.state.databases.get(dbName)
  }

  service.on('GET', '/collections', (req, res) => {
    const db = getDb(req)
    const collections = Array.from(db.collections.keys())
    json(res, 200, { collections })
  })

  service.on('POST', '/collections', (req, res) => {
    const body = req.body ?? {}
    const name = body.name
    const isFailed = failed(name)

    if (isFailed) {
      json(res, 400, { error: 'Failed to create collection', code: 48 })
      return
    }

    const db = getDb(req)
    db.collections.set(name, { documents: [], indexes: [{ key: { _id: 1 }, name: '_id_' }] })
    json(res, 201, { name, created: true })
  })

  service.on('POST', '/collections/:collection/find', (req, res) => {
    const collectionName = req.params.collection
    const body = req.body ?? {}
    const db = getDb(req)
    const collection = db.collections.get(req.params.collection)

    if (!collection) {
      json(res, 404, { error: 'Collection not found', code: 26 })
      return
    }

    const filter = body.filter ?? {}
    const projection = body.projection
    const limit = body.limit ?? 100
    const skip = body.skip ?? 0

    let results = collection.documents

    if (Object.keys(filter).length > 0) {
      results = results.filter(doc => {
        return Object.entries(filter).every(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            return Object.entries(value).every(([op, val]) => {
              if (op === '$eq') return doc[key] === val
              if (op === '$ne') return doc[key] !== val
              if (op === '$gt') return doc[key] > val
              if (op === '$gte') return doc[key] >= val
              if (op === '$lt') return doc[key] < val
              if (op === '$lte') return doc[key] <= val
              if (op === '$in') return val.includes(doc[key])
              if (op === '$nin') return !val.includes(doc[key])
              return true
            })
          }
          return doc[key] === value
        })
      })
    }

    const sliced = collection.documents.slice(skip, skip + limit)
    json(res, 200, { documents: sliced, count: results.length })
  })

  service.on('POST', '/collections/:collection/insertOne', (req, res) => {
    const collectionName = req.params.collection
    const body = req.body ?? {}
    const document = body.document ?? {}
    const isFailed = failed(JSON.stringify(document))

    if (isFailed) {
      json(res, 400, { error: 'Failed to insert document', code: 11000 })
      return
    }

    const db = getDb(req)
    if (!db.collections.has(req.params.collection)) {
      db.collections.set(req.params.collection, { documents: [], indexes: [] })
    }

    const collection = db.collections.get(req.params.collection)
    const newDoc = { _id: `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, ...document }
    collection.documents.push(newDoc)

    json(res, 201, { insertedId: newDoc._id, acknowledged: true })
  })

  service.on('POST', '/collections/:collection/insertMany', (req, res) => {
    const collectionName = req.params.collection
    const body = req.body ?? {}
    const documents = body.documents ?? []
    const isFailed = failed(JSON.stringify(documents))

    if (isFailed) {
      json(res, 400, { error: 'Failed to insert documents', code: 11000 })
      return
    }

    const db = getDb(req)
    if (!db.collections.has(req.params.collection)) {
      db.collections.set(req.params.collection, { documents: [], indexes: [] })
    }

    const collection = db.collections.get(req.params.collection)
    const insertedIds = documents.map(doc => {
      const newDoc = { _id: `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, ...doc }
      collection.documents.push(newDoc)
      return newDoc._id
    })

    json(res, 201, { insertedIds, acknowledged: true, insertedCount: insertedIds.length })
  })

  service.on('POST', '/collections/:collection/updateOne', (req, res) => {
    const collectionName = req.params.collection
    const body = req.body ?? {}
    const filter = body.filter ?? {}
    const update = body.update ?? {}
    const isFailed = failed(JSON.stringify(filter))

    if (isFailed) {
      json(res, 400, { error: 'Failed to update document' })
      return
    }

    const db = getDb(req)
    const collection = db.collections.get(req.params.collection)

    if (!collection) {
      json(res, 404, { error: 'Collection not found' })
      return
    }

    const idx = collection.documents.findIndex(doc => {
      return Object.entries(filter).every(([k, v]) => doc[k] === v)
    })

    if (idx === -1) {
      json(res, 200, { matchedCount: 0, modifiedCount: 0, acknowledged: true })
      return
    }

    if (update.$set) {
      collection.documents[idx] = { ...collection.documents[idx], ...update.$set }
    }
    if (update.$unset) {
      Object.keys(update.$unset).forEach(k => delete collection.documents[idx][k])
    }
    if (update.$inc) {
      Object.entries(update.$inc).forEach(([k, v]) => {
        collection.documents[idx][k] = (collection.documents[idx][k] ?? 0) + v
      })
    }

    json(res, 200, { matchedCount: 1, modifiedCount: 1, acknowledged: true })
  })

  service.on('POST', '/collections/:collection/deleteOne', (req, res) => {
    const collectionName = req.params.collection
    const body = req.body ?? {}
    const filter = body.filter ?? {}
    const isFailed = failed(JSON.stringify(filter))

    if (isFailed) {
      json(res, 400, { error: 'Failed to delete document' })
      return
    }

    const db = getDb(req)
    const collection = db.collections.get(req.params.collection)

    if (!collection) {
      json(res, 404, { error: 'Collection not found' })
      return
    }

    const idx = collection.documents.findIndex(doc => {
      return Object.entries(filter).every(([k, v]) => doc[k] === v)
    })

    if (idx === -1) {
      json(res, 200, { deletedCount: 0, acknowledged: true })
      return
    }

    collection.documents.splice(idx, 1)
    json(res, 200, { deletedCount: 1, acknowledged: true })
  })

  service.on('POST', '/collections/:collection/deleteMany', (req, res) => {
    const collectionName = req.params.collection
    const body = req.body ?? {}
    const filter = body.filter ?? {}

    const db = getDb(req)
    const collection = db.collections.get(req.params.collection)

    if (!collection) {
      json(res, 404, { error: 'Collection not found' })
      return
    }

    const originalLength = collection.documents.length
    collection.documents = collection.documents.filter(doc => {
      return !Object.entries(filter).every(([k, v]) => doc[k] === v)
    })

    const deletedCount = originalLength - collection.documents.length
    json(res, 200, { deletedCount, acknowledged: true })
  })

  service.on('POST', '/collections/:collection/aggregate', (req, res) => {
    const collectionName = req.params.collection
    const body = req.body ?? {}
    const pipeline = body.pipeline ?? []

    const db = getDb(req)
    const collection = db.collections.get(req.params.collection)

    if (!collection) {
      json(res, 404, { error: 'Collection not found' })
      return
    }

    json(res, 200, { results: collection.documents, count: collection.documents.length })
  })

  return service
}

/**
 * Redis (Key-Value).
 *
 * The Redis protocol mock - provides REST API for common Redis operations.
 * Supports strings, hashes, lists, sets, sorted sets.
 *
 * The reference decides: an operation with `success` succeeds, `failed` fails.
 */
export function createRedisMock() {
  const service = new MockService('redis')

  service.state.data = new Map()
  service.state.ttls = new Map()
  service.startTime = Date.now()

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'redis-mock' })
  })

  service.on('POST', '/set', (req, res) => {
    const body = req.body ?? {}
    const key = body.key
    const value = body.value
    const ex = body.ex ?? body.exat ?? body.px ?? body.pxat
    const nx = body.nx
    const xx = body.xx

    if (!key) {
      json(res, 400, { error: 'Key is required' })
      return
    }

    const isFailed = failed(key)
    const exists = service.state.data.has(key)

    if (nx && exists) {
      json(res, 200, { set: false })
      return
    }
    if (xx && !exists) {
      json(res, 200, { set: false })
      return
    }
    if (isFailed) {
      json(res, 400, { error: 'Failed to set key' })
      return
    }

    service.state.data.set(key, { type: 'string', value: String(value) })

    if (ex) {
      const ttl = body.ex ? Number(body.ex) : Number(body.px) / 1000
      service.state.ttls.set(key, Date.now() + ttl * 1000)
    }

    json(res, 200, { ok: true })
  })

  service.on('GET', '/get', (req, res) => {
    const key = req.query.key
    if (!key) {
      json(res, 400, { error: 'Key is required' })
      return
    }

    const entry = service.state.data.get(key)
    if (!entry) {
      json(res, 200, { value: null })
      return
    }

    const expiry = service.state.ttls.get(key)
    if (expiry && Date.now() > expiry) {
      service.state.data.delete(key)
      service.state.ttls.delete(key)
      json(res, 200, { value: null })
      return
    }

    if (entry.type !== 'string') {
      json(res, 400, { error: 'WRONGTYPE Operation against a key holding the wrong kind of value' })
      return
    }

    json(res, 200, { value: entry.value })
  })

  service.on('DELETE', '/del', (req, res) => {
    const keys = req.query.keys?.split(',') ?? []
    let deleted = 0

    for (const key of keys) {
      if (service.state.data.delete(key)) {
        deleted++
        service.state.ttls.delete(key)
      }
    }

    json(res, 200, { deleted })
  })

  service.on('POST', '/expire', (req, res) => {
    const body = req.body ?? {}
    const key = body.key
    const seconds = Number(body.seconds)

    if (!key || !seconds) {
      json(res, 400, { error: 'Key and seconds required' })
      return
    }

    if (!service.state.data.has(key)) {
      json(res, 200, { success: false })
      return
    }

    service.state.ttls.set(key, Date.now() + seconds * 1000)
    json(res, 200, { success: true })
  })

  service.on('GET', '/ttl', (req, res) => {
    const key = req.query.key
    if (!key) {
      json(res, 400, { error: 'Key is required' })
      return
    }

    const expiry = service.state.ttls.get(key)
    if (!expiry) {
      json(res, 200, { ttl: service.state.data.has(key) ? -1 : -2 })
      return
    }

    const ttl = Math.max(0, Math.ceil((expiry - Date.now()) / 1000))
    json(res, 200, { ttl })
  })

  service.on('POST', '/hset', (req, res) => {
    const body = req.body ?? {}
    const key = body.key
    const fields = body.fields ?? {}

    if (!key) {
      json(res, 400, { error: 'Key is required' })
      return
    }

    if (!service.state.data.has(key)) {
      service.state.data.set(key, { type: 'hash', value: new Map() })
    }

    const entry = service.state.data.get(key)
    if (entry.type !== 'hash') {
      json(res, 400, { error: 'WRONGTYPE' })
      return
    }

    let added = 0
    for (const [field, value] of Object.entries(fields)) {
      const existed = entry.value.has(field)
      entry.value.set(field, String(value))
      if (!existed) added++
    }

    json(res, 200, { added })
  })

  service.on('POST', '/hget', (req, res) => {
    const body = req.body ?? {}
    const key = body.key
    const field = body.field

    if (!key || !field) {
      json(res, 400, { error: 'Key and field required' })
      return
    }

    const entry = service.state.data.get(key)
    if (!entry || entry.type !== 'hash') {
      json(res, 200, { value: null })
      return
    }

    json(res, 200, { value: entry.value.get(field) ?? null })
  })

  service.on('POST', '/hgetall', (req, res) => {
    const body = req.body ?? {}
    const key = body.key

    const entry = service.state.data.get(key)
    if (!entry || entry.type !== 'hash') {
      json(res, 200, { fields: {} })
      return
    }

    const fields = {}
    for (const [field, value] of entry.value.entries()) {
      fields[field] = value
    }

    json(res, 200, { fields })
  })

  service.on('POST', '/lpush', (req, res) => {
    const body = req.body ?? {}
    const key = body.key
    const values = body.values ?? []

    if (!key) {
      json(res, 400, { error: 'Key is required' })
      return
    }

    if (!service.state.data.has(key)) {
      service.state.data.set(key, { type: 'list', value: [] })
    }

    const entry = service.state.data.get(key)
    if (entry.type !== 'list') {
      json(res, 400, { error: 'WRONGTYPE' })
      return
    }

    entry.value.unshift(...values.reverse())
    json(res, 200, { length: entry.value.length })
  })

  service.on('POST', '/rpush', (req, res) => {
    const body = req.body ?? {}
    const key = body.key
    const values = body.values ?? []

    if (!key) {
      json(res, 400, { error: 'Key is required' })
      return
    }

    if (!service.state.data.has(key)) {
      service.state.data.set(key, { type: 'list', value: [] })
    }

    const entry = service.state.data.get(key)
    if (entry.type !== 'list') {
      json(res, 400, { error: 'WRONGTYPE' })
      return
    }

    entry.value.push(...values)
    json(res, 200, { length: entry.value.length })
  })

  service.on('POST', '/lpop', (req, res) => {
    const body = req.body ?? {}
    const key = body.key

    const entry = service.state.data.get(key)
    if (!entry || entry.type !== 'list') {
      json(res, 200, { value: null })
      return
    }

    const value = entry.value.shift()
    json(res, 200, { value })
  })

  service.on('POST', '/lrange', (req, res) => {
    const body = req.body ?? {}
    const key = body.key
    const start = Number(body.start ?? 0)
    const stop = Number(body.stop ?? -1)

    const entry = service.state.data.get(key)
    if (!entry || entry.type !== 'list') {
      json(res, 200, { values: [] })
      return
    }

    let end = stop === -1 ? entry.value.length : stop + 1
    const values = entry.value.slice(start, end)
    json(res, 200, { values })
  })

  service.on('POST', '/sadd', (req, res) => {
    const body = req.body ?? {}
    const key = body.key
    const members = body.members ?? []

    if (!key) {
      json(res, 400, { error: 'Key is required' })
      return
    }

    if (!service.state.data.has(key)) {
      service.state.data.set(key, { type: 'set', value: new Set() })
    }

    const entry = service.state.data.get(key)
    if (entry.type !== 'set') {
      json(res, 400, { error: 'WRONGTYPE' })
      return
    }

    let added = 0
    for (const member of members) {
      if (!entry.value.has(member)) {
        entry.value.add(member)
        added++
      }
    }

    json(res, 200, { added })
  })

  service.on('POST', '/smembers', (req, res) => {
    const key = req.query.key

    const entry = service.state.data.get(key)
    if (!entry || entry.type !== 'set') {
      json(res, 200, { members: [] })
      return
    }

    json(res, 200, { members: Array.from(entry.value) })
  })

  service.on('POST', '/zadd', (req, res) => {
    const body = req.body ?? {}
    const key = body.key
    const members = body.members ?? []

    if (!key) {
      json(res, 400, { error: 'Key is required' })
      return
    }

    if (!service.state.data.has(key)) {
      service.state.data.set(key, { type: 'zset', value: new Map() })
    }

    const entry = service.state.data.get(key)
    if (entry.type !== 'zset') {
      json(res, 400, { error: 'WRONGTYPE' })
      return
    }

    let added = 0
    for (const m of members) {
      if (!entry.value.has(m.member)) added++
      entry.value.set(m.member, m.score)
    }

    json(res, 200, { added })
  })

  service.on('POST', '/zrange', (req, res) => {
    const body = req.body ?? {}
    const key = body.key
    const start = Number(body.start ?? 0)
    const stop = Number(body.stop ?? -1)
    const withScores = body.withScores ?? false

    const entry = service.state.data.get(key)
    if (!entry || entry.type !== 'zset') {
      json(res, 200, { values: [] })
      return
    }

    const sorted = Array.from(entry.value.entries()).sort((a, b) => a[1] - b[1])
    const end = stop === -1 ? sorted.length : stop + 1
    const range = sorted.slice(start, end)

    if (withScores) {
      json(res, 200, { values: range.map(([m, s]) => ({ member: m, score: s })) })
    } else {
      json(res, 200, { values: range.map(([m]) => m) })
    }
  })

  service.on('GET', '/keys', (req, res) => {
    const pattern = req.query.pattern ?? '*'
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')

    const keys = Array.from(service.state.data.keys()).filter(k => regex.test(k))
    json(res, 200, { keys })
  })

  service.on('GET', '/exists', (req, res) => {
    const keys = req.query.keys?.split(',') ?? []
    const existing = keys.filter(k => service.state.data.has(k))
    json(res, 200, { count: existing.length })
  })

  service.on('GET', '/info', (req, res) => {
    json(res, 200, {
      role: 'master',
      connected_clients: 1,
      used_memory: '1M',
      total_keys: service.state.data.size,
      uptime_in_seconds: Math.floor((Date.now() - service.startTime) / 1000),
    })
  })

  return service
}

/**
 * DynamoDB.
 *
 * The DynamoDB API: tables, items, queries, and scans.
 * The shapes match AWS DynamoDB API.
 *
 * The reference decides: an operation with `success` succeeds, `failed` fails.
 */
export function createDynamodbMock() {
  const service = new MockService('dynamodb')

  service.state.tables = new Map()

  let tableId = 1000

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'dynamodb-mock' })
  })

  service.on('POST', '/', (req, res) => {
    const body = req.body ?? {}
    const action = body.Action ?? req.headers['x-amz-target']?.split('.').pop()

    if (action === 'CreateTable' || body.TableName) {
      const tableName = body.TableName
      const isFailed = failed(tableName)

      if (isFailed) {
        json(res, 400, { __type: 'com.amazon.coral.validate#ValidationException', message: 'Failed to create table' })
        return
      }

      const table = {
        TableName: tableName,
        TableStatus: 'ACTIVE',
        KeySchema: body.KeySchema ?? [{ AttributeName: 'id', KeyType: 'HASH' }],
        AttributeDefinitions: body.AttributeDefinitions ?? [{ AttributeName: 'id', AttributeType: 'S' }],
        ProvisionedThroughput: body.ProvisionedThroughput ?? { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
        TableSizeBytes: 0,
        ItemCount: 0,
        TableArn: `arn:aws:dynamodb:us-east-1:123456789012:table/${tableName}`,
        TableId: `table_${tableId++}`,
      }

      service.state.tables.set(tableName, { ...table, items: new Map() })

      if (isFailed) {
        json(res, 400, { __type: 'com.amazon.coral.validate#ValidationException', message: 'Failed to create table' })
        return
      }

      json(res, 200, { TableDescription: table })
    }
  })

  service.on('GET', '/', (req, res) => {
    const tables = Array.from(service.state.tables.keys())
    json(res, 200, { TableNames: tables })
  })

  service.on('POST', '/', (req, res) => {
    const body = req.body ?? {}
    const action = body.Action ?? req.headers['x-amz-target']?.split('.').pop()

    if (action === 'DescribeTable' || body.TableName) {
      const tableName = body.TableName
      const table = service.state.tables.get(tableName)

      if (!table) {
        json(res, 400, { __type: 'com.amazon.coral.validate#ResourceNotFoundException', message: 'Table not found' })
        return
      }

      json(res, 200, { TableDescription: table })
    }
  })

  service.on('POST', '/', (req, res) => {
    const body = req.body ?? {}
    const action = body.Action ?? req.headers['x-amz-target']?.split('.').pop()

    if (action === 'PutItem' || body.Item) {
      const tableName = body.TableName
      const item = body.Item
      const isFailed = failed(tableName)

      if (!service.state.tables.has(tableName)) {
        json(res, 400, { __type: 'com.amazon.coral.validate#ResourceNotFoundException', message: 'Table not found' })
        return
      }

      if (isFailed) {
        json(res, 400, { __type: 'com.amazon.coral.validate#ConditionalCheckFailedException', message: 'Condition check failed' })
        return
      }

      const pk = Object.entries(body.KeySchema ?? [{ AttributeName: 'id', KeyType: 'HASH' }])
        .find(([, v]) => v.KeyType === 'HASH')
      const pkName = pk?.[0] ?? 'id'
      const pkValue = item[pkName]?.S ?? item[pkName]?.N ?? `item_${Date.now()}`

      const table = service.state.tables.get(tableName)
      table.items.set(pkValue, item)
      table.ItemCount = table.items.size

      json(res, 200, {})
    }
  })

  service.on('POST', '/', (req, res) => {
    const body = req.body ?? {}
    const action = body.Action ?? req.headers['x-amz-target']?.split('.').pop()

    if (action === 'GetItem' || body.Key) {
      const tableName = body.TableName
      const key = body.Key

      if (!service.state.tables.has(tableName)) {
        json(res, 400, { __type: 'com.amazon.coral.validate#ResourceNotFoundException', message: 'Table not found' })
        return
      }

      const table = service.state.tables.get(tableName)
      const pkName = table.KeySchema.find(k => k.KeyType === 'HASH')?.AttributeName ?? 'id'
      const pkValue = key[pkName]?.S ?? key[pkName]?.N

      const item = table.items.get(pkValue)

      if (!item) {
        json(res, 200, {})
        return
      }

      json(res, 200, { Item: item })
    }
  })

  service.on('POST', '/', (req, res) => {
    const body = req.body ?? {}
    const action = body.Action ?? req.headers['x-amz-target']?.split('.').pop()

    if (action === 'UpdateItem' || body.UpdateExpression) {
      const tableName = body.TableName
      const key = body.Key

      if (!service.state.tables.has(tableName)) {
        json(res, 400, { __type: 'com.amazon.coral.validate#ResourceNotFoundException', message: 'Table not found' })
        return
      }

      const table = service.state.tables.get(tableName)
      const pkName = table.KeySchema.find(k => k.KeyType === 'HASH')?.AttributeName ?? 'id'
      const pkValue = key[pkName]?.S ?? key[pkName]?.N

      const item = table.items.get(pkValue)
      if (!item) {
        json(res, 400, { __type: 'com.amazon.coral.validate#ConditionalCheckFailedException', message: 'Item not found' })
        return
      }

      if (body.UpdateExpression?.startsWith('SET')) {
        const updates = body.ExpressionAttributeValues ?? {}
        Object.assign(item, Object.fromEntries(
          Object.entries(updates).map(([k, v]) => [k.replace(':', ''), v.S ?? v.N ?? v.BOOL])
        ))
      }

      json(res, 200, { Attributes: item })
    }
  })

  service.on('POST', '/', (req, res) => {
    const body = req.body ?? {}
    const action = body.Action ?? req.headers['x-amz-target']?.split('.').pop()

    if (action === 'DeleteItem' || body.Key) {
      const tableName = body.TableName
      const key = body.Key

      if (!service.state.tables.has(tableName)) {
        json(res, 400, { __type: 'com.amazon.coral.validate#ResourceNotFoundException', message: 'Table not found' })
        return
      }

      const table = service.state.tables.get(tableName)
      const pkName = table.KeySchema.find(k => k.KeyType === 'HASH')?.AttributeName ?? 'id'
      const pkValue = key[pkName]?.S ?? key[pkName]?.N

      const deleted = table.items.delete(pkValue)
      table.ItemCount = table.items.size

      json(res, 200, {})
    }
  })

  service.on('POST', '/', (req, res) => {
    const body = req.body ?? {}
    const action = body.Action ?? req.headers['x-amz-target']?.split('.').pop()

    if (action === 'Query' || body.KeyConditionExpression) {
      const tableName = body.TableName

      if (!service.state.tables.has(tableName)) {
        json(res, 400, { __type: 'com.amazon.coral.validate#ResourceNotFoundException', message: 'Table not found' })
        return
      }

      const table = service.state.tables.get(tableName)
      const items = Array.from(table.items.values()).slice(0, body.Limit ?? 100)

      json(res, 200, { Items: items, Count: items.length, ScannedCount: items.length })
    }
  })

  service.on('POST', '/', (req, res) => {
    const body = req.body ?? {}
    const action = body.Action ?? req.headers['x-amz-target']?.split('.').pop()

    if (action === 'Scan') {
      const tableName = body.TableName

      if (!service.state.tables.has(tableName)) {
        json(res, 400, { __type: 'com.amazon.coral.validate#ResourceNotFoundException', message: 'Table not found' })
        return
      }

      const table = service.state.tables.get(tableName)
      const items = Array.from(table.items.values()).slice(0, body.Limit ?? 100)

      json(res, 200, { Items: items, Count: items.length, ScannedCount: items.length, LastEvaluatedKey: null })
    }
  })

  service.on('POST', '/', (req, res) => {
    const body = req.body ?? {}
    const action = body.Action ?? req.headers['x-amz-target']?.split('.').pop()

    if (action === 'BatchGetItem' && body.RequestItems) {
      const results = {}
      for (const [tableName, request] of Object.entries(body.RequestItems)) {
        const table = service.state.tables.get(tableName)
        if (!table) continue

        const items = (request.Keys ?? []).map(key => {
          const pkName = table.KeySchema.find(k => k.KeyType === 'HASH')?.AttributeName ?? 'id'
          const pkValue = key[pkName]?.S ?? key[pkName]?.N
          return table.items.get(pkValue)
        }).filter(Boolean)

        results[tableName] = items
      }

      json(res, 200, { Responses: results, UnprocessedKeys: {} })
    }

    if (action === 'BatchWriteItem' && body.RequestItems) {
      for (const [tableName, requests] of Object.entries(body.RequestItems)) {
        const table = service.state.tables.get(tableName)
        if (!table) continue

        for (const req of requests) {
          if (req.PutRequest?.Item) {
            const item = req.PutRequest.Item
            const pkName = table.KeySchema.find(k => k.KeyType === 'HASH')?.AttributeName ?? 'id'
            const pkValue = item[pkName]?.S ?? item[pkName]?.N ?? `item_${Date.now()}`
            table.items.set(pkValue, item)
            table.ItemCount = table.items.size
          } else if (req.DeleteRequest?.Key) {
            const key = req.DeleteRequest.Key
            const pkName = table.KeySchema.find(k => k.KeyType === 'HASH')?.AttributeName ?? 'id'
            const pkValue = key[pkName]?.S ?? key[pkName]?.N
            table.items.delete(pkValue)
            table.ItemCount = table.items.size
          }
        }
      }

      json(res, 200, { UnprocessedItems: {} })
    }
  })

  return service
}

/**
 * Firestore (Google Cloud).
 *
 * The Firestore REST API: documents, collections, queries, and transactions.
 * The shapes match Google Cloud Firestore REST API.
 *
 * The reference decides: an operation with `success` succeeds, `failed` fails.
 */
export function createFirestoreMock() {
  const service = new MockService('firestore')

  service.state.databases = new Map()

  const failed = (ref) => String(ref ?? '').includes('failed')
  const successful = (ref) => String(ref ?? '').includes('success') || !failed(ref)

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'firestore-mock' })
  })

  const getDb = (req) => {
    const dbName = req.headers['x-database'] ?? req.query.database ?? '(default)'
    if (!service.state.databases.has(dbName)) {
      service.state.databases.set(dbName, { collections: new Map() })
    }
    return service.state.databases.get(dbName)
  }

  service.on('GET', '/v1/projects/:project/databases/:database/documents', (req, res) => {
    const db = getDb(req)
    const path = req.query.parent ?? req.path
    json(res, 200, { documents: [] })
  })

  service.on('POST', '/v1/projects/:project/databases/:database/documents', (req, res) => {
    const body = req.body ?? {}
    const collectionId = req.query.collectionId
    const documentId = body.documentId ?? `doc_${Date.now()}`
    const isFailed = failed(documentId)

    const doc = {
      name: `projects/mock-project/databases/(default)/documents/${collectionId}/${documentId}`,
      fields: body.fields ?? {},
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
    }

    if (isFailed) {
      json(res, 400, { error: { code: 400, message: 'Failed to create document', status: 'INVALID_ARGUMENT' } })
      return
    }

    json(res, 201, doc)
  })

  service.on('GET', '/v1/projects/:project/databases/:database/documents/:path', (req, res) => {
    const path = req.params.path
    const doc = {
      name: `projects/mock-project/databases/(default)/documents/${path}`,
      fields: { name: { stringValue: 'Test Document' } },
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
    }
    json(res, 200, doc)
  })

  service.on('PATCH', '/v1/projects/:project/databases/:database/documents/:path', (req, res) => {
    const body = req.body ?? {}
    const updateMask = req.query.updateMask?.fieldPaths ?? []

    const doc = {
      name: `projects/mock-project/databases/(default)/documents/${req.params.path}`,
      fields: body.fields ?? {},
      updateTime: new Date().toISOString(),
    }
    json(res, 200, doc)
  })

  service.on('DELETE', '/v1/projects/:project/databases/:database/documents/:path', (req, res) => {
    res.statusCode = 204
    res.end()
  })

  service.on('POST', '/v1/projects/:project/databases/:database/documents:runQuery', (req, res) => {
    const body = req.body ?? {}
    const structuredQuery = body.structuredQuery ?? {}

    json(res, 200, { results: [] })
  })

  service.on('POST', '/v1/projects/:project/databases/:database:beginTransaction', (req, res) => {
    json(res, 200, { transaction: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` })
  })

  service.on('POST', '/v1/projects/:project/databases/:database:commit', (req, res) => {
    const body = req.body ?? {}
    const writes = body.writes ?? []

    json(res, 200, {
      writeResults: writes.map((_, i) => ({
        updateTime: new Date().toISOString(),
        transformResults: [],
      })),
    })
  })

  service.on('POST', '/v1/projects/:project/databases/:database:rollback', (req, res) => {
    json(res, 200, {})
  })

  service.on('GET', '/v1/projects/:project/databases/:database/indexes', (req, res) => {
    json(res, 200, { indexes: [] })
  })

  return service
}
