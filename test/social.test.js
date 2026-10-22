import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startMock, MOCKS } from '../src/index.js'

/**
 * The social networks.
 *
 * Each one is started and asked something, so a broken one is caught here
 * rather than in a project that depends on it.
 */

const run = async (name, fn) => {
  const service = await startMock(name)

  try {
    await fn(service)
  } finally {
    await service.close()
  }
}

const post = (url, body) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

test('facebook posts, and reads the comments back', async () => {
  await run('facebook', async (service) => {
    const created = await post(`${service.url}/v21.0/10001/posts`, {
      message: 'The new thing is here',
    }).then((res) => res.json())

    assert.ok(created.id)

    const posts = await fetch(`${service.url}/v21.0/10001/posts`).then((res) => res.json())
    assert.equal(posts.data.length, 1)
    assert.equal(posts.data[0].message, 'The new thing is here')

    // A comment is made on the post.
    await post(`${service.url}/v21.0/${created.id}/comments`, { message: 'Nice one' })

    const comments = await fetch(`${service.url}/v21.0/${created.id}/comments`).then((res) =>
      res.json(),
    )

    assert.equal(comments.data.length, 1)
    assert.equal(comments.data[0].message, 'Nice one')

    // And the page that owns the post can list them too.
    const onPage = await fetch(`${service.url}/v21.0/10001/comments`).then((res) => res.json())
    assert.equal(onPage.data.length, 1)
  })
})

test('facebook says so when the page is not there', async () => {
  await run('facebook', async (service) => {
    const res = await fetch(`${service.url}/v21.0/nope`)

    assert.equal(res.status, 400)

    const body = await res.json()

    assert.equal(body.error.type, 'GraphMethodException')
    assert.equal(body.error.code, 100)
  })
})

test('instagram publishes a post and counts the reach', async () => {
  await run('instagram', async (service) => {
    const created = await post(`${service.url}/v21.0/17841/media`, {
      caption: 'New in the shop',
      image_url: 'https://example.test/photo.jpg',
    }).then((res) => res.json())

    assert.ok(created.id)

    const media = await fetch(`${service.url}/v21.0/17841/media`).then((res) => res.json())
    assert.equal(media.data.length, 1)
    assert.equal(media.data[0].media_type, 'IMAGE')

    const insights = await fetch(`${service.url}/v21.0/17841/insights?metric=reach,impressions`).then(
      (res) => res.json(),
    )

    assert.equal(insights.data.length, 2)
    assert.equal(insights.data[0].name, 'reach')
  })
})

test('x writes a tweet and finds a user', async () => {
  await run('x', async (service) => {
    const token = await post(`${service.url}/2/oauth2/token`, {}).then((res) => res.json())
    assert.equal(token.token_type, 'bearer')

    const tweet = await post(`${service.url}/2/tweets`, { text: 'Hello from the mock' }).then((res) =>
      res.json(),
    )

    assert.match(tweet.data.id, /^tweet_/)
    assert.equal(tweet.data.text, 'Hello from the mock')

    const user = await fetch(`${service.url}/2/users/by/username/adanwosu`).then((res) => res.json())
    assert.equal(user.data.username, 'adanwosu')
  })
})

test('x says a missing user in the body, not in the status', async () => {
  await run('x', async (service) => {
    const res = await fetch(`${service.url}/2/users/by/username/nobody`)

    assert.equal(res.status, 200)

    const body = await res.json()

    assert.equal(body.errors[0].message, 'User not found')
  })
})

test('telegram sends a message and hands it back', async () => {
  await run('telegram', async (service) => {
    const sent = await post(`${service.url}/bot123456:ABC/sendMessage`, {
      chat_id: 4242,
      text: 'Your code is 1234',
    }).then((res) => res.json())

    assert.equal(sent.ok, true)
    assert.equal(sent.result.text, 'Your code is 1234')

    const updates = await fetch(`${service.url}/bot123456:ABC/getUpdates`).then((res) => res.json())
    assert.equal(updates.result.length, 1)
  })
})

test('reddit submits a post and lists it', async () => {
  await run('reddit', async (service) => {
    const submitted = await post(`${service.url}/api/submit`, {
      sr: 'testing',
      title: 'A post from the mock',
      kind: 'self',
      text: 'The body of it',
    }).then((res) => res.json())

    assert.deepEqual(submitted.json.errors, [])
    assert.ok(submitted.json.data.id)

    const hot = await fetch(`${service.url}/r/testing/hot`).then((res) => res.json())
    assert.equal(hot.data.children.length, 1)
    assert.equal(hot.data.children[0].data.title, 'A post from the mock')
  })
})

test('linkedin posts and finds the organisation', async () => {
  await run('linkedin', async (service) => {
    const posted = await post(`${service.url}/v2/posts`, {
      author: 'urn:li:organization:123',
      commentary: 'We are hiring',
      visibility: 'PUBLIC',
    }).then((res) => res.json())

    assert.ok(posted.id)

    const found = await fetch(`${service.url}/v2/posts/${posted.id}`).then((res) => res.json())
    assert.equal(found.commentary, 'We are hiring')

    const organisations = await fetch(`${service.url}/v2/organizations?q=bytesickle`).then((res) =>
      res.json(),
    )

    assert.ok(organisations.elements.length >= 1)
  })
})

test('tiktok fails the video when the reference says so', async () => {
  await run('tiktok', async (service) => {
    const ok = await fetch(`${service.url}/v1.3/video/query/?video_id=v_1001`).then((res) =>
      res.json(),
    )

    assert.equal(ok.code, 0)

    const failed = await fetch(`${service.url}/v1.3/video/query/?video_id=v_fail_1`).then((res) =>
      res.json(),
    )

    assert.equal(failed.code, 4001)
    assert.equal(failed.data.status, 'FAILED')
  })
})

test('youtube keeps the video that was uploaded', async () => {
  await run('youtube', async (service) => {
    const uploaded = await post(`${service.url}/youtube/v3/videos`, {
      part: 'snippet,status',
      snippet: { title: 'A video' },
    }).then((res) => res.json())

    assert.ok(uploaded.id)

    const found = await fetch(
      `${service.url}/youtube/v3/videos?part=snippet&id=${uploaded.id}`,
    ).then((res) => res.json())

    assert.equal(found.kind, 'youtube#videoListResponse')
    assert.equal(found.items[0].snippet.title, 'A video')
  })
})

test('every mock says what it is', async () => {
  for (const name of Object.keys(MOCKS)) {
    await run(name, async (service) => {
      const res = await fetch(`${service.url}/_mock`)
      const body = await res.json()

      assert.equal(res.status, 200, `${name} should answer /_mock`)
      assert.equal(body.kind, 'mock')
      assert.equal(body.service, name)
      assert.equal(body.real_service, false)

      // And it says so on every answer, not only on that one.
      const header = await fetch(`${service.url}/health`)
      assert.equal(header.headers.get('x-mock-service-kind'), 'mock')
    })
  }
})
