import { MockService, json, counter } from '../harness.js'

/**
 * The video platforms.
 *
 * TikTok and YouTube — the two an app publishes to when it wants a video
 * watched.
 *
 * Both answer with the envelope the real API uses, and both keep what was
 * published, so a test can look at it.
 */

/** The code the API uses to say something went wrong. */
const FAILED = 4001

/**
 * Does the reference say it failed?
 *
 * This is the rule the project keeps: a reference that says `fail` comes
 * back failed, so a test can ask for either outcome without a special
 * flag.
 */
const failedReference = (reference) => String(reference ?? '').includes('fail')

/**
 * TikTok.
 *
 * The Business and Display API: every answer is wrapped in `code`,
 * `message` and `data`. A code of zero means it worked.
 *
 * The reference decides: a video id that says `fail` comes back failed, with
 * the code the API uses for it.
 */
export function createTiktokMock() {
  const service = new MockService('tiktok')

  /** The videos that were published, by id. */
  service.state.videos = new Map()

  const nextPublishId = counter('v_pub')

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'tiktok-mock' })
  })

  /** The time the video was published, the way TikTok counts it. */
  const now = () => Math.floor(Date.now() / 1000)

  service.on('POST', /^\/v1\.3\/video\/publish\/?$/, (req, res) => {
    const body = req.json ?? {}
    const videoId = String(body.video_id ?? '')

    if (!videoId) {
      json(res, 400, { code: FAILED, message: 'video_id is required', data: null })
      return
    }

    const failed = failedReference(body.reference ?? videoId)

    service.state.videos.set(videoId, {
      id: videoId,
      title: body.title ?? '',
      description: body.description ?? '',
      privacy_level: body.privacy_level ?? 'PUBLIC',
      creator_id: String(body.creator_id ?? 'mock_creator'),
      status: failed ? 'FAILED' : 'PUBLISHED',
      publish_time: now(),
      like_count: 0,
      comment_count: 0,
      share_count: 0,
      view_count: 0,
    })

    if (failed) {
      json(res, 200, { code: FAILED, message: 'The video could not be published', data: null })
      return
    }

    json(res, 200, {
      code: 0,
      message: 'success',
      data: {
        publish_id: nextPublishId(),
        upload_url: `https://example.test/upload/${videoId}`,
      },
    })
  })

  service.on('GET', /^\/v1\.3\/video\/query\/?$/, (req, res) => {
    const videoId = String(req.query.video_id ?? req.query.publish_id ?? '')
    const known = service.state.videos.get(videoId)
    const failed = failedReference(videoId)

    const video = known ?? {
      id: videoId,
      status: failed ? 'FAILED' : 'PUBLISHED',
      publish_time: now(),
      like_count: 1204,
      comment_count: 86,
      share_count: 42,
      view_count: 88400,
      title: '',
      description: '',
      creator_id: 'mock_creator',
    }

    const data = {
      id: video.id,
      status: failed ? 'FAILED' : video.status,
      publish_time: video.publish_time,
      like_count: video.like_count,
      comment_count: video.comment_count,
      share_count: video.share_count,
      view_count: video.view_count,
      title: video.title,
      description: video.description,
      creator_id: video.creator_id,
    }

    if (failed) {
      json(res, 200, {
        code: FAILED,
        message: 'The video failed to publish',
        data,
      })
      return
    }

    json(res, 200, { code: 0, message: 'success', data })
  })

  service.on('GET', /^\/v1\.3\/user\/info\/?$/, (req, res) => {
    const openId = String(req.query.open_id ?? '')

    json(res, 200, {
      code: 0,
      message: 'success',
      data: {
        open_id: openId,
        union_id: `union_${openId}`,
        nickname: 'Ada Nwosu',
        avatar_url: 'https://example.test/avatar.jpeg',
        follower_count: 12480,
        video_count: 42,
      },
    })
  })

  service.on('GET', /^\/v1\.3\/comment\/list\/?$/, (req, res) => {
    const videoId = String(req.query.video_id ?? '')

    // A video that failed to publish has no comments to show.
    if (failedReference(videoId)) {
      json(res, 200, { code: FAILED, message: 'The video failed to publish', data: null })
      return
    }

    json(res, 200, {
      code: 0,
      message: 'success',
      data: {
        comments: [
          {
            text: 'This is a good video.',
            create_time: now(),
            commenter: { open_id: 'mock_commenter', nickname: 'Chidi Okafor' },
            reply_id: '0',
          },
        ],
        has_more: false,
      },
    })
  })

  return service
}

/**
 * YouTube.
 *
 * The Data API: every answer has a `kind` and the `items` that were asked
 * for, and the parts that were asked for are the parts that come back.
 *
 * The videos that were uploaded are kept, so they can be asked for again.
 */
export function createYoutubeMock() {
  const service = new MockService('youtube')

  /** The videos that were uploaded, by id. */
  service.state.videos = new Map()

  // The first upload is `mockVideo002`, so it never lands on the video that
  // came with the mock.
  let videoNumber = 1

  service.on('GET', '/health', (req, res) => {
    json(res, 200, { status: 'healthy', service: 'youtube-mock' })
  })

  /** The id of a new video, the way YouTube writes one. */
  const nextVideoId = () => {
    videoNumber += 1

    return `mockVideo${String(videoNumber).padStart(3, '0')}`
  }

  /** A video that was never uploaded, made up for the asking. */
  const makeVideo = (id) => ({
    id,
    kind: 'youtube#video',
    snippet: {
      title: `Video ${id}`,
      description: 'A video the mock made up.',
      publishedAt: '2026-08-01T10:00:00Z',
      channelId: 'UCmockChannel0001',
      tags: [],
      thumbnails: {
        default: { url: `https://example.test/thumbnails/${id}.jpg`, height: 90, width: 120 },
      },
    },
    status: { privacyStatus: 'public', uploadStatus: 'uploaded' },
    statistics: { viewCount: '1024', likeCount: '48', commentCount: '6' },
  })

  /** The video with that id, uploaded or not. */
  const videoOf = (id) => service.state.videos.get(id) ?? makeVideo(id)

  service.on('GET', '/youtube/v3/videos', (req, res) => {
    const asked = String(req.query.id ?? '')
    const ids = asked
      ? asked
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : [...service.state.videos.keys()]

    const items = ids.map((id) => {
      const video = videoOf(id)

      return {
        id: video.id,
        kind: 'youtube#video',
        snippet: {
          publishedAt: video.snippet.publishedAt,
          channelId: video.snippet.channelId,
          title: video.snippet.title,
          description: video.snippet.description,
          tags: video.snippet.tags,
          thumbnails: video.snippet.thumbnails,
        },
        statistics: {
          viewCount: video.statistics.viewCount,
          likeCount: video.statistics.likeCount,
          commentCount: video.statistics.commentCount,
        },
      }
    })

    json(res, 200, {
      kind: 'youtube#videoListResponse',
      pageInfo: { totalResults: items.length, resultsPerPage: items.length },
      items,
    })
  })

  service.on('GET', '/youtube/v3/channels', (req, res) => {
    const id = String(req.query.id ?? 'UCmockChannel0001')

    json(res, 200, {
      kind: 'youtube#channelListResponse',
      items: [
        {
          id,
          kind: 'youtube#channel',
          snippet: {
            title: 'Ada Explains',
            description: 'Short videos about the internet.',
            customUrl: '@adaexplains',
            subscriberCount: '12400',
            videoCount: '86',
            publishedAt: '2021-02-11T10:00:00Z',
          },
        },
      ],
    })
  })

  service.on('GET', '/youtube/v3/search', (req, res) => {
    const term = String(req.query.q ?? '').toLowerCase()

    const items = [...service.state.videos.values()]
      .filter((video) => !term || video.snippet.title.toLowerCase().includes(term))
      .map((video) => ({
        id: { kind: 'youtube#video', videoId: video.id },
        snippet: {
          title: video.snippet.title,
          description: video.snippet.description,
          channelId: video.snippet.channelId,
          publishedAt: video.snippet.publishedAt,
        },
      }))

    json(res, 200, { kind: 'youtube#searchListResponse', items })
  })

  service.on('GET', '/youtube/v3/comments', (req, res) => {
    const videoId = String(req.query.videoId ?? '')

    json(res, 200, {
      kind: 'youtube#commentListResponse',
      items: [
        {
          id: 'mockComment001',
          kind: 'youtube#comment',
          snippet: {
            authorDisplayName: 'Chidi Okafor',
            authorProfileImageUrl: 'https://example.test/chidi.jpg',
            textDisplay: 'This helped, thank you.',
            textOriginal: 'This helped, thank you.',
            publishedAt: '2026-09-30T12:00:00Z',
            likeCount: 12,
            videoId,
          },
        },
      ],
    })
  })

  service.on('GET', '/youtube/v3/playlists', (req, res) => {
    const id = String(req.query.id ?? 'PLmockPlaylist01')

    json(res, 200, {
      kind: 'youtube#playlistListResponse',
      items: [
        {
          id,
          kind: 'youtube#playlist',
          snippet: {
            title: 'The best of the channel',
            description: 'Videos worth watching again.',
            channelId: 'UCmockChannel0001',
            itemCount: '12',
          },
        },
      ],
    })
  })

  service.on('POST', '/youtube/v3/videos', (req, res) => {
    const body = req.json ?? {}

    const id = nextVideoId()
    const title = body.snippet?.title ?? 'Untitled'
    const description = body.snippet?.description ?? ''
    const publishedAt = new Date().toISOString()
    const privacyStatus = body.status?.privacyStatus ?? 'private'

    service.state.videos.set(id, {
      id,
      kind: 'youtube#video',
      snippet: {
        title,
        description,
        publishedAt,
        channelId: 'UCmockChannel0001',
        tags: body.snippet?.tags ?? [],
        thumbnails: {
          default: { url: `https://example.test/thumbnails/${id}.jpg`, height: 90, width: 120 },
        },
      },
      status: { privacyStatus, uploadStatus: 'uploaded' },
      statistics: { viewCount: '0', likeCount: '0', commentCount: '0' },
    })

    json(res, 200, {
      id,
      kind: 'youtube#video',
      snippet: { title, description, publishedAt },
      status: { privacyStatus, uploadStatus: 'uploaded' },
    })
  })

  // A first video, so the channel is not empty when a test looks at it.
  service.state.videos.set('mockVideo001', {
    id: 'mockVideo001',
    kind: 'youtube#video',
    snippet: {
      title: 'How to make coffee at home',
      description: 'Six ways to brew coffee without a machine.',
      publishedAt: '2026-09-01T08:00:00Z',
      channelId: 'UCmockChannel0001',
      tags: ['coffee', 'howto'],
      thumbnails: {
        default: {
          url: 'https://example.test/thumbnails/mockVideo001.jpg',
          height: 90,
          width: 120,
        },
      },
    },
    status: { privacyStatus: 'public', uploadStatus: 'uploaded' },
    statistics: { viewCount: '88400', likeCount: '3200', commentCount: '186' },
  })

  return service
}
