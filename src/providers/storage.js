import { createHash } from 'node:crypto'
import { MockService, json, counter } from '../harness.js'

/**
 * The object store.
 *
 * S3, answered the way S3 answers — with XML, and with the same names for
 * the same things — so an app that talks to a bucket can be tested without
 * a bucket, and without paying for one.
 */

/** The XML an S3 answer starts with. */
const xml = (body) => '<?xml version="1.0" encoding="UTF-8"?>' + body

/** Keep the text safe to put inside XML. */
const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** One tag, with the text safely inside it. */
const tag = (name, value) => `<${name}>${escapeXml(value)}</${name}>`

/** Answer with XML, the way S3 does. */
const sendXml = (res, status, body) => {
  res.statusCode = status
  res.setHeader('content-type', 'application/xml')
  res.end(xml(body))
}

/**
 * S3.
 *
 * The buckets, the objects in them, and the links that are signed so
 * somebody else can be given one without being given a secret.
 */
export function createS3Mock() {
  const service = new MockService('s3')

  /** The buckets, by name. */
  service.state.buckets = new Map()

  /** The objects, by bucket and then by key. */
  service.state.objects = new Map()

  /** The uploads that have been started. */
  service.state.uploads = new Map()

  const nextUpload = counter('upload')

  /** The objects of a bucket, made if the bucket has none yet. */
  const objectsOf = (bucket) => {
    if (!service.state.objects.has(bucket)) {
      service.state.objects.set(bucket, new Map())
    }

    return service.state.objects.get(bucket)
  }

  /** The hash that stands in for the real checksum. */
  const etagOf = (body) => createHash('md5').update(body).digest('hex')

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 's3-mock' })
  })

  service.on('GET', '/', (req, res) => {
    const buckets = [...service.state.buckets.values()]

    const body =
      '<ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">' +
      '<Owner>' +
      tag('ID', 'mock') +
      tag('DisplayName', 'mock') +
      '</Owner>' +
      '<Buckets>' +
      buckets
        .map(
          (bucket) =>
            '<Bucket>' +
            tag('Name', bucket.name) +
            tag('CreationDate', bucket.createdAt) +
            '</Bucket>',
        )
        .join('') +
      '</Buckets>' +
      '</ListAllMyBucketsResult>'

    sendXml(res, 200, body)
  })

  service.on('PUT', '/:bucket', (req, res) => {
    const name = String(req.params.bucket)

    if (!service.state.buckets.has(name)) {
      service.state.buckets.set(name, { name, createdAt: new Date().toISOString() })
      service.state.objects.set(name, new Map())
    }

    sendXml(
      res,
      200,
      '<CreateBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"/>',
    )
  })

  service.on('DELETE', '/:bucket', (req, res) => {
    const name = String(req.params.bucket)

    service.state.buckets.delete(name)
    service.state.objects.delete(name)

    res.statusCode = 204
    res.end()
  })

  service.on('HEAD', '/:bucket', (req, res) => {
    const name = String(req.params.bucket)

    if (!service.state.buckets.has(name)) {
      res.statusCode = 404
      res.end()
      return
    }

    res.statusCode = 200
    res.setHeader('x-amz-bucket-region', 'us-east-1')
    res.end()
  })

  service.on('GET', '/:bucket', (req, res) => {
    const name = String(req.params.bucket)
    const objects = service.state.objects.get(name) ?? new Map()
    const items = [...objects.entries()]

    const body =
      '<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">' +
      tag('Name', name) +
      tag('Prefix', '') +
      tag('KeyCount', items.length) +
      tag('MaxKeys', 1000) +
      tag('IsTruncated', 'false') +
      items
        .map(
          ([key, object]) =>
            '<Contents>' +
            tag('Key', key) +
            tag('LastModified', object.lastModified) +
            tag('ETag', object.etag) +
            tag('Size', Buffer.byteLength(object.body)) +
            tag('StorageClass', 'STANDARD') +
            '</Contents>',
        )
        .join('') +
      '</ListBucketResult>'

    sendXml(res, 200, body)
  })

  service.on('PUT', /^\/(?<bucket>[^/]+)\/(?<key>.+)$/, (req, res) => {
    const bucket = String(req.params.bucket)
    const key = String(req.params.key)
    const body = req.body ?? ''
    const etag = etagOf(body)

    // A bucket that is not there yet is made, so a test can just put a file.
    if (!service.state.buckets.has(bucket)) {
      service.state.buckets.set(bucket, { name: bucket, createdAt: new Date().toISOString() })
    }

    objectsOf(bucket).set(key, {
      body,
      contentType: req.headers['content-type'] ?? 'application/octet-stream',
      lastModified: new Date().toISOString(),
      etag,
    })

    res.statusCode = 200
    res.setHeader('ETag', `"${etag}"`)
    res.end()
  })

  service.on('GET', /^\/(?<bucket>[^/]+)\/(?<key>.+)$/, (req, res) => {
    const bucket = String(req.params.bucket)
    const key = String(req.params.key)

    // A presigned request — the one with X-Amz-Signature in the query — comes
    // here too, and is answered the same way. The signature is not checked:
    // this is a mock.
    const objects = service.state.objects.get(bucket)
    const object = objects?.get(key)

    if (!object) {
      sendXml(
        res,
        404,
        '<Error><Code>NoSuchKey</Code><Message>There is no such object</Message></Error>',
      )
      return
    }

    res.statusCode = 200
    res.setHeader('content-type', object.contentType)
    res.setHeader('ETag', `"${object.etag}"`)
    res.end(object.body)
  })

  service.on('DELETE', /^\/(?<bucket>[^/]+)\/(?<key>.+)$/, (req, res) => {
    const bucket = String(req.params.bucket)
    const key = String(req.params.key)

    service.state.objects.get(bucket)?.delete(key)

    res.statusCode = 204
    res.end()
  })

  service.on('POST', /^\/(?<bucket>[^/]+)\/(?<key>.+)$/, (req, res) => {
    if (!('uploads' in req.query)) {
      sendXml(
        res,
        501,
        '<Error><Code>NotImplemented</Code>' +
          '<Message>This mock only knows how to start a multipart upload</Message></Error>',
      )
      return
    }

    const bucket = String(req.params.bucket)
    const key = String(req.params.key)
    const uploadId = nextUpload()

    service.state.uploads.set(uploadId, {
      bucket,
      key,
      startedAt: new Date().toISOString(),
    })

    const body =
      '<InitiateMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">' +
      tag('Bucket', bucket) +
      tag('Key', key) +
      tag('UploadId', uploadId) +
      '</InitiateMultipartUploadResult>'

    sendXml(res, 200, body)
  })

  /**
   * A link to an object that is signed, the way a presigned link is.
   *
   * Use it when the code under test needs a URL it can hand to somebody
   * else — a download link, say — and cannot be given a secret.
   */
  service.state.presign = (bucket, key) => {
    const signature = createHash('sha256').update(`${bucket}/${key}`).digest('hex')

    return (
      `${service.url}/${bucket}/${key}` +
      '?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
      '&X-Amz-Expires=3600' +
      `&X-Amz-Signature=${signature}`
    )
  }

  return service
}
