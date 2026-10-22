import { MockService, json, counter } from '../harness.js'

/**
 * The social networks.
 *
 * Facebook, Instagram and X — the three a consumer application meets
 * first. The shapes are the real ones: the same fields, the same envelopes
 * and the same status codes, so the code that talks to them does not change
 * when it is pointed at a mock.
 *
 * The identifiers decide, as they do everywhere else in this project: a
 * username with `fail` in it is not found, and the API says so the way the
 * real one does.
 */

/**
 * Facebook.
 *
 * The Graph API: a page, its posts, the comments on them, and the insights
 * that come back in the paging envelope.
 */
export function createFacebookMock() {
  const service = new MockService('facebook')

  service.state.pages = new Map()
  service.state.posts = new Map()
  service.state.comments = []

  const nextPost = counter('post')
  const nextComment = counter('comment')

  // The page the mock stands in for.
  const page = {
    id: '10001',
    name: 'The Shop',
    category: 'Retail',
    about: 'Things worth buying.',
    followers_count: 1240,
    link: 'https://example.test/theshop',
    picture: { data: { url: 'https://example.test/theshop.jpg' } },
  }

  service.state.pages.set(page.id, page)

  service.on('GET', '/v21.0/me', (req, res) => {
    json(res, 200, { id: '10000', name: 'Ada Nwosu' })
  })

  service.on('GET', '/v21.0/me/accounts', (req, res) => {
    json(res, 200, {
      data: [
        {
          id: page.id,
          name: page.name,
          access_token: 'mock-page-access-token',
          tasks: ['MANAGE', 'CREATE_CONTENT'],
          category: page.category,
          picture: page.picture,
        },
      ],
      paging: {
        cursors: { before: 'MjAxOT', after: 'MjAyMA==' },
        next: `${service.url}/v21.0/me/accounts?after=MjAyMA==`,
      },
    })
  })

  service.on('GET', '/v21.0/:id', (req, res) => {
    const id = String(req.params.id)

    if (id.includes('fail')) {
      json(res, 400, {
        error: {
          message: 'Unsupported get request.',
          type: 'GraphMethodException',
          code: 100,
          error_subcode: 33,
          fbtrace_id: 'mock',
        },
      })
      return
    }

    const found = service.state.pages.get(id)

    if (!found) {
      json(res, 400, {
        error: {
          message: `Unsupported get request. Object with ID '${id}' does not exist`,
          type: 'GraphMethodException',
          code: 100,
        },
      })
      return
    }

    json(res, 200, found)
  })

  service.on('POST', '/v21.0/:id/posts', (req, res) => {
    const body = req.json ?? {}

    if (!body.message) {
      json(res, 400, {
        error: {
          message: '(#200) The parameter message is required',
          type: 'OAuthException',
          code: 200,
        },
      })
      return
    }

    const id = `${req.params.id}_${nextPost()}`

    const post = {
      id,
      message: body.message,
      created_time: new Date().toISOString(),
      permalink_url: `${service.url}/${page.id}/posts/${id}`,
      comments_count: 0,
      reactions: { summary: { total_count: 0 } },
    }

    service.state.posts.set(id, post)

    json(res, 200, { id })
  })

  service.on('GET', '/v21.0/:id/posts', (req, res) => {
    const posts = [...service.state.posts.values()].filter(
      (post) => post.id.startsWith(`${req.params.id}_`),
    )

    json(res, 200, {
      data: posts,
      paging: {
        cursors: { before: 'MjAxOT', after: 'MjAyMA==' },
        next: `${service.url}/v21.0/${req.params.id}/posts?after=MjAyMA==`,
      },
    })
  })

  service.on('GET', '/v21.0/:id/comments', (req, res) => {
    const id = String(req.params.id)

    // A comment sits on a post, or on the page itself. Either way the page
    // that owns it can list it.
    const comments = service.state.comments.filter(
      (comment) => comment.postId === id || comment.pageId === id,
    )

    json(res, 200, {
      data: comments.map(({ postId, pageId, ...comment }) => comment),
      paging: { cursors: { before: 'MjAxOT', after: 'MjAyMA==' } },
    })
  })

  service.on('POST', '/v21.0/:id/comments', (req, res) => {
    const body = req.json ?? {}

    if (!body.message) {
      json(res, 400, {
        error: {
          message: '(#200) The parameter message is required',
          type: 'OAuthException',
          code: 200,
        },
      })
      return
    }

    const target = String(req.params.id)

    const comment = {
      id: nextComment(),
      postId: target,
      pageId: target.includes('_') ? target.split('_')[0] : target,
      message: body.message,
      created_time: new Date().toISOString(),
      from: { id: '10000', name: 'Ada Nwosu' },
    }

    service.state.comments.push(comment)

    json(res, 200, { id: comment.id })
  })

  service.on('GET', '/v21.0/:id/insights', (req, res) => {
    const metrics = (req.query.metric ?? 'page_impressions').split(',')
    const posts = service.state.posts.size

    json(res, 200, {
      data: metrics.map((name) => ({
        title: name,
        name,
        description: `The ${name} of the page`,
        period: 'day',
        values: [
          {
            value: name === 'page_impressions' ? 1200 + posts * 7 : 48 + posts,
            end_time: new Date().toISOString(),
          },
        ],
      })),
      paging: { cursors: { before: 'MjAxOT', after: 'MjAyMA==' } },
    })
  })

  service.on('GET', '/v21.0/:id/likes', (req, res) => {
    json(res, 200, {
      summary: { total_count: service.state.posts.size * 3 },
      data: [],
      paging: { cursors: { before: 'MjAxOT', after: 'MjAyMA==' } },
    })
  })

  return service
}

/**
 * Instagram.
 *
 * The Graph API for a business account: the account, its media, the
 * comments on them, and the insights that come with them.
 */
export function createInstagramMock() {
  const service = new MockService('instagram')

  service.state.media = new Map()
  service.state.comments = []

  const nextMedia = counter('media')
  const nextComment = counter('comment')

  const account = {
    id: '17841',
    username: 'theshop',
    name: 'The Shop',
    biography: 'Things worth buying.',
    followers_count: 8420,
    follows_count: 312,
    media_count: 0,
    profile_picture_url: 'https://example.test/theshop.jpg',
  }

  service.on('GET', '/v21.0/:id', (req, res) => {
    const id = String(req.params.id)

    if (id.includes('fail')) {
      json(res, 400, {
        error: {
          message: 'Unsupported get request.',
          type: 'GraphMethodException',
          code: 100,
          error_subcode: 33,
        },
      })
      return
    }

    const found = service.state.media.get(id)

    if (found) {
      json(res, 200, found)
      return
    }

    if (id !== account.id) {
      json(res, 400, {
        error: {
          message: `Unsupported get request. Object with ID '${id}' does not exist`,
          type: 'GraphMethodException',
          code: 100,
        },
      })
      return
    }

    json(res, 200, { ...account, media_count: service.state.media.size })
  })

  service.on('POST', '/v21.0/:id/media', (req, res) => {
    const body = req.json ?? {}

    if (!body.caption) {
      json(res, 400, {
        error: {
          message: '(#200) The parameter caption is required',
          type: 'OAuthException',
          code: 200,
        },
      })
      return
    }

    const id = `17841_${nextMedia()}`

    const media = {
      id,
      caption: body.caption,
      media_type: body.image_url ? 'IMAGE' : 'REELS',
      media_url: body.image_url ?? 'https://example.test/reel.mp4',
      permalink: `${service.url}/p/${id.replace('_', '/')}/`,
      timestamp: new Date().toISOString(),
      like_count: 0,
      comments_count: 0,
    }

    service.state.media.set(id, media)

    json(res, 200, { id })
  })

  service.on('GET', '/v21.0/:id/media', (req, res) => {
    json(res, 200, {
      data: [...service.state.media.values()],
      paging: {
        cursors: { before: 'MjAxOT', after: 'MjAyMA==' },
        next: `${service.url}/v21.0/${req.params.id}/media?after=MjAyMA==`,
      },
    })
  })

  service.on('GET', '/v21.0/:id/media_published', (req, res) => {
    json(res, 200, {
      data: [...service.state.media.values()].map((media) => ({
        id: media.id,
        permalink: media.permalink,
      })),
    })
  })

  service.on('GET', '/v21.0/:id/comments', (req, res) => {
    const comments = service.state.comments.filter((comment) => comment.mediaId === req.params.id)

    json(res, 200, {
      data: comments.map(({ mediaId, ...comment }) => comment),
      paging: { cursors: { before: 'MjAxOT', after: 'MjAyMA==' } },
    })
  })

  service.on('POST', '/v21.0/:id/comments', (req, res) => {
    const body = req.json ?? {}

    if (!body.message) {
      json(res, 400, {
        error: {
          message: '(#200) The parameter message is required',
          type: 'OAuthException',
          code: 200,
        },
      })
      return
    }

    const comment = {
      id: nextComment(),
      mediaId: String(req.params.id),
      text: body.message,
      username: 'ada',
      timestamp: new Date().toISOString(),
      like_count: 0,
      replies: { data: [], total_count: 0 },
    }

    service.state.comments.push(comment)

    json(res, 200, { id: comment.id })
  })

  service.on('GET', '/v21.0/:id/insights', (req, res) => {
    const metrics = (req.query.metric ?? 'reach').split(',')

    json(res, 200, {
      data: metrics.map((name) => ({
        name,
        period: 'day',
        values: [
          {
            value: name === 'reach' ? 4300 + service.state.media.size * 12 : 5100,
            end_time: new Date().toISOString(),
          },
        ],
      })),
      paging: { cursors: { before: 'MjAxOT', after: 'MjAyMA==' } },
    })
  })

  service.on('GET', '/v21.0/ig_hashtag_search', (req, res) => {
    json(res, 200, {
      data: [
        { id: '17841400000000001', name: 'coffee' },
        { id: '17841400000000002', name: 'coffee_shop' },
      ],
      paging: { cursors: { before: 'MjAxOT', after: 'MjAyMA==' } },
    })
  })

  service.on('GET', '/v21.0/:id/top_media', (req, res) => {
    json(res, 200, {
      data: [...service.state.media.values()].slice(0, 5),
      paging: { cursors: { before: 'MjAxOT', after: 'MjAyMA==' } },
    })
  })

  return service
}

/**
 * X.
 *
 * The v2 API: a bearer token, the users, the tweets, and the lists that
 * come back in the paging envelope.
 */
export function createXMock() {
  const service = new MockService('x')

  service.state.tweets = new Map()
  service.state.users = new Map()

  const nextTweet = counter('tweet')
  const nextUser = counter('user')

  const me = {
    id: '10000',
    name: 'Ada Nwosu',
    username: 'adanwosu',
    created_at: '2020-04-12T09:00:00.000Z',
    description: 'Building things.',
    public_metrics: {
      followers_count: 1204,
      following_count: 312,
      tweet_count: 890,
      listed_count: 24,
    },
  }

  service.state.users.set(me.username, me)

  service.on('POST', '/2/oauth2/token', (req, res) => {
    json(res, 200, {
      token_type: 'bearer',
      access_token: 'mock-access-token',
      expires_in: 7200,
      scope: 'tweet.read users.read tweet.write offline.access',
    })
  })

  service.on('GET', '/2/users/me', (req, res) => {
    json(res, 200, { data: me })
  })

  service.on('GET', '/2/users/by/username/:username', (req, res) => {
    const username = String(req.params.username)
    const found = service.state.users.get(username)

    // A username that is not there is not an error status — the API says so
    // in the body, and that is what the code has to read.
    if (!found) {
      json(res, 200, {
        errors: [
          {
            message: 'User not found',
            detail: `Could not find user with username: ${username}.`,
            type: `${service.url}/problems/resource-not-found`,
          },
        ],
      })
      return
    }

    json(res, 200, { data: found, meta: { result_type: 'users' } })
  })

  service.on('GET', '/2/users/:id', (req, res) => {
    const id = String(req.params.id)

    if (id.includes('fail')) {
      json(res, 200, {
        errors: [
          {
            message: 'User not found',
            detail: `Could not find user with id: ${id}.`,
            type: `${service.url}/problems/resource-not-found`,
          },
        ],
      })
      return
    }

    const found = [...service.state.users.values()].find((user) => user.id === id)

    if (!found) {
      json(res, 200, {
        errors: [
          {
            message: 'User not found',
            detail: `Could not find user with id: ${id}.`,
            type: `${service.url}/problems/resource-not-found`,
          },
        ],
      })
      return
    }

    json(res, 200, { data: found })
  })

  service.on('POST', '/2/tweets', (req, res) => {
    const body = req.json ?? {}

    if (!body.text) {
      json(res, 400, {
        errors: [
          {
            message: 'The `text` field is required',
            detail: 'Please provide a text for the tweet.',
            type: `${service.url}/problems/invalid-request`,
          },
        ],
      })
      return
    }

    const id = nextTweet()

    const tweet = {
      id,
      text: body.text,
      created_at: new Date().toISOString(),
      author_id: me.id,
      edit_history_tweet_ids: [id],
      public_metrics: {
        retweet_count: 0,
        reply_count: 0,
        like_count: 0,
        quote_count: 0,
        impression_count: 0,
      },
    }

    service.state.tweets.set(id, tweet)

    json(res, 201, { data: tweet })
  })

  service.on('GET', '/2/tweets/:id', (req, res) => {
    const found = service.state.tweets.get(String(req.params.id))

    if (!found) {
      json(res, 200, {
        errors: [
          {
            message: 'Could not find tweet with id: [' + req.params.id + '].',
            type: `${service.url}/problems/resource-not-found`,
          },
        ],
      })
      return
    }

    json(res, 200, { data: found })
  })

  service.on('GET', '/2/users/:id/tweets', (req, res) => {
    const tweets = [...service.state.tweets.values()]

    json(res, 200, {
      data: tweets,
      meta: {
        result_count: tweets.length,
        newest_id: tweets.at(-1)?.id ?? null,
        oldest_id: tweets[0]?.id ?? null,
        next_token: null,
      },
    })
  })

  service.on('GET', '/2/users/:id/followers', (req, res) => {
    const followers = [...service.state.users.values()].filter((user) => user.id !== req.params.id)

    json(res, 200, {
      data: followers,
      meta: { result_count: followers.length, next_token: null },
    })
  })

  service.on('GET', '/2/users/:id/mentions', (req, res) => {
    const tweets = [...service.state.tweets.values()]

    json(res, 200, {
      data: tweets,
      meta: { result_count: tweets.length, next_token: null },
    })
  })

  service.on('GET', '/2/users/:id/liked_tweets', (req, res) => {
    const tweets = [...service.state.tweets.values()]

    json(res, 200, {
      data: tweets,
      meta: { result_count: tweets.length, next_token: null },
    })
  })

  return service
}
