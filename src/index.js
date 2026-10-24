import {
  createStripeMock as stripeMock,
  createResendMock as resendMock,
  createXeroMock as xeroMock,
  createCloudflareMock as cloudflareMock,
} from './providers/commerce.js'
import {
  createPaypalMock as paypalMock,
  createSquareMock as squareMock,
  createAdyenMock as adyenMock,
} from './providers/payments.js'
import {
  createShippoMock as shippoMock,
  createEasyPostMock as easypostMock,
  createFedexMock as fedexMock,
  createUpsMock as upsMock,
  createDhlMock as dhlMock,
} from './providers/shipping.js'
import {
  createAmazonSpApiMock as amazonSpApiMock,
  createShopifyMock as shopifyMock,
  createEbayMock as ebayMock,
  createEtsyMock as etsyMock,
  createWalmartMock as walmartMock,
} from './providers/marketplaces.js'
import {
  createSendGridMock as sendgridMock,
  createMailchimpMock as mailchimpMock,
  createKlaviyoMock as klaviyoMock,
  createPostmarkMock as postmarkMock,
} from './providers/email-marketing.js'
import {
  createPaystackMock as paystackMock,
  createInterswitchMock as interswitchMock,
  createYouVerifyMock as youverifyMock,
  createOneSignalMock as onesignalMock,
  createTwilioMock as twilioMock,
} from './providers/nigeria.js'
import {
  createFlutterwaveMock as flutterwaveMock,
  createMonnifyMock as monnifyMock,
} from './providers/fintech.js'
import {
  createSmileIdMock as smileidMock,
  createIdentityPassMock as identitypassMock,
} from './providers/identity.js'
import {
  createTermiiMock as termiiMock,
  createWhatsAppMock as whatsappMock,
  createFcmMock as fcmMock,
} from './providers/messaging.js'
import { createOpenAIMock as openaiMock } from './providers/ai.js'
import { createS3Mock as s3Mock } from './providers/storage.js'
import {
  createFacebookMock as facebookMock,
  createInstagramMock as instagramMock,
  createXMock as xMock,
} from './providers/social.js'
import {
  createBlueskyMock as blueskyMock,
  createTelegramMock as telegramMock,
  createRedditMock as redditMock,
  createLinkedinMock as linkedinMock,
} from './providers/community.js'
import { createTiktokMock as tiktokMock, createYoutubeMock as youtubeMock } from './providers/video.js'
import { createSpecMock as specMock, createSpecMockFromFile as specMockFromFile } from './spec.js'
import { attachViews } from './ui/index.js'

/**
 * api-mock-services
 *
 * Stand-ins for the outside world: the payment gateways, the identity checks,
 * the email provider, the accounting service, the DNS provider, the
 * messaging and the AI and storage services.
 *
 * One implementation, used by every project. A test starts the mock it needs,
 * points the app at it, and can then say what was actually asked for.
 *
 * The engine (`harness.js`) knows nothing about HTML. Everything a person
 * sees lives in `ui/`, and is put on a mock by `attachViews`.
 */

export { MockService, MockRequest, json, text, readBody, toMatcher } from './harness.js'

/** The categories the mocks are grouped into. */
export const CATEGORIES = {
  payments: { title: 'Payments', description: 'The card and the bank rails' },
  identity: { title: 'Identity', description: 'The KYC and the verification checks' },
  messaging: { title: 'Messaging', description: 'The text, the WhatsApp and the push' },
  email: { title: 'Email', description: 'The sending domains and the mail itself' },
  accounting: { title: 'Accounting', description: 'The books' },
  dns: { title: 'DNS', description: 'The zones and the records' },
  ai: { title: 'AI', description: 'The model calls' },
  storage: { title: 'Storage', description: 'The buckets and the objects' },
  shipping: { title: 'Shipping', description: 'The labels, the rates and the tracking' },
  marketplaces: { title: 'Marketplaces', description: 'The stores and the orders' },
  social: { title: 'Social', description: 'The networks, the video platforms and the community apps' },
}

/** Every mock this package can start. */
export const MOCKS = {
  stripe: {
    create: stripeMock,
    port: 4001,
    category: 'payments',
    description: 'The card payments',
  },
  resend: {
    create: resendMock,
    port: 4002,
    category: 'email',
    description: 'The email',
  },
  xero: {
    create: xeroMock,
    port: 4003,
    category: 'accounting',
    description: 'The accounting',
  },
  cloudflare: {
    create: cloudflareMock,
    port: 4004,
    category: 'dns',
    description: 'The DNS',
  },
  paystack: {
    create: paystackMock,
    port: 4005,
    category: 'payments',
    description: 'The card payments (Nigeria)',
  },
  interswitch: {
    create: interswitchMock,
    port: 4006,
    category: 'payments',
    description: 'The card payments (Nigeria, Interswitch)',
  },
  youverify: {
    create: youverifyMock,
    port: 4007,
    category: 'identity',
    description: 'The identity checks',
  },
  onesignal: {
    create: onesignalMock,
    port: 4008,
    category: 'messaging',
    description: 'The push notifications',
  },
  twilio: {
    create: twilioMock,
    port: 4009,
    category: 'messaging',
    description: 'The SMS',
  },
  flutterwave: {
    create: flutterwaveMock,
    port: 4010,
    category: 'payments',
    description: 'The card payments (Nigeria, Flutterwave)',
  },
  monnify: {
    create: monnifyMock,
    port: 4011,
    category: 'payments',
    description: 'The bank rails (Nigeria, Monnify)',
  },
  termii: {
    create: termiiMock,
    port: 4012,
    category: 'messaging',
    description: 'The SMS (Nigeria, Termii)',
  },
  smileid: {
    create: smileidMock,
    port: 4013,
    category: 'identity',
    description: 'The identity checks (Nigeria, Smile ID)',
  },
  identitypass: {
    create: identitypassMock,
    port: 4014,
    category: 'identity',
    description: 'The identity checks (Nigeria, Identity Pass)',
  },
  whatsapp: {
    create: whatsappMock,
    port: 4015,
    category: 'messaging',
    description: 'The WhatsApp messages',
  },
  fcm: {
    create: fcmMock,
    port: 4016,
    category: 'messaging',
    description: 'The push notifications (Firebase)',
  },
  openai: {
    create: openaiMock,
    port: 4017,
    category: 'ai',
    description: 'The model calls (OpenAI and Anthropic shapes)',
  },
  s3: {
    create: s3Mock,
    port: 4018,
    category: 'storage',
    description: 'The buckets and the objects (S3)',
  },
  facebook: {
    create: facebookMock,
    port: 4019,
    category: 'social',
    description: 'The social network (Facebook Graph API)',
  },
  instagram: {
    create: instagramMock,
    port: 4020,
    category: 'social',
    description: 'The photo sharing (Instagram Graph API)',
  },
  x: {
    create: xMock,
    port: 4021,
    category: 'social',
    description: 'The short messages (X, formerly Twitter)',
  },
  bluesky: {
    create: blueskyMock,
    port: 4022,
    category: 'social',
    description: 'The open protocol (Bluesky, AT Protocol)',
  },
  telegram: {
    create: telegramMock,
    port: 4023,
    category: 'social',
    description: 'The channels and the bots (Telegram)',
  },
  reddit: {
    create: redditMock,
    port: 4024,
    category: 'social',
    description: 'The communities (Reddit)',
  },
  linkedin: {
    create: linkedinMock,
    port: 4025,
    category: 'social',
    description: 'The professional network (LinkedIn)',
  },
  tiktok: {
    create: tiktokMock,
    port: 4026,
    category: 'social',
    description: 'The short video (TikTok)',
  },
  youtube: {
    create: youtubeMock,
    port: 4027,
    category: 'social',
    description: 'The video library (YouTube)',
  },
  paypal: {
    create: paypalMock,
    port: 4028,
    category: 'payments',
    description: 'The card and digital payments (PayPal Orders API v2)',
  },
  square: {
    create: squareMock,
    port: 4029,
    category: 'payments',
    description: 'The card payments (Square Payments API)',
  },
  adyen: {
    create: adyenMock,
    port: 4030,
    category: 'payments',
    description: 'The global payments (Adyen Payments API v68)',
  },
  shippo: {
    create: shippoMock,
    port: 4031,
    category: 'shipping',
    description: 'The shipping labels and tracking (Shippo)',
  },
  easypost: {
    create: easypostMock,
    port: 4032,
    category: 'shipping',
    description: 'The shipping labels and tracking (EasyPost)',
  },
  fedex: {
    create: fedexMock,
    port: 4033,
    category: 'shipping',
    description: 'The shipping labels and tracking (FedEx)',
  },
  ups: {
    create: upsMock,
    port: 4034,
    category: 'shipping',
    description: 'The shipping labels and tracking (UPS)',
  },
  dhl: {
    create: dhlMock,
    port: 4035,
    category: 'shipping',
    description: 'The shipping labels and tracking (DHL)',
  },
  'amazon-sp-api': {
    create: amazonSpApiMock,
    port: 4036,
    category: 'marketplaces',
    description: 'The selling partner API (Amazon SP-API)',
  },
  shopify: {
    create: shopifyMock,
    port: 4037,
    category: 'marketplaces',
    description: 'The e-commerce platform (Shopify Admin API)',
  },
  ebay: {
    create: ebayMock,
    port: 4038,
    category: 'marketplaces',
    description: 'The marketplace (eBay Sell API)',
  },
  etsy: {
    create: etsyMock,
    port: 4039,
    category: 'marketplaces',
    description: 'The handmade marketplace (Etsy Open API)',
  },
  walmart: {
    create: walmartMock,
    port: 4040,
    category: 'marketplaces',
    description: 'The marketplace (Walmart Marketplace API)',
  },
  sendgrid: {
    create: sendgridMock,
    port: 4041,
    category: 'email',
    description: 'The email API (SendGrid Web API v3)',
  },
  mailchimp: {
    create: mailchimpMock,
    port: 4042,
    category: 'email',
    description: 'The email marketing (Mailchimp Marketing API)',
  },
  klaviyo: {
    create: klaviyoMock,
    port: 4043,
    category: 'email',
    description: 'The email marketing (Klaviyo API)',
  },
  postmark: {
    create: postmarkMock,
    port: 4044,
    category: 'email',
    description: 'The transactional email (Postmark API)',
  },
}

/**
 * Start a mock.
 *
 * The returned object has the URL it is on, everything it was asked, and the
 * state it keeps — so a test can look at what really happened.
 */
export async function startMock(name, options = {}) {
  const entry = MOCKS[name]

  if (!entry) {
    throw new Error(
      `There is no mock called "${name}". The ones there are: ${Object.keys(MOCKS).join(', ')}.`,
    )
  }

  const service = entry.create(options)

  attachViews(service)

  await service.listen(options.port ?? 0, options.host ?? '127.0.0.1')

  return service
}

/** Start several mocks at once. */
export async function startMocks(names, options = {}) {
  const started = []

  for (const name of names) {
    started.push(await startMock(name, options))
  }

  return started
}

/**
 * A mock, with the browser layer on it.
 *
 * The panel and the checkout are all the UI layer adds, so every mock a
 * caller gets has them.
 */
const withViews = (factory) => (options) => attachViews(factory(options))

export const createStripeMock = withViews(stripeMock)
export const createResendMock = withViews(resendMock)
export const createXeroMock = withViews(xeroMock)
export const createCloudflareMock = withViews(cloudflareMock)
export const createPaystackMock = withViews(paystackMock)
export const createInterswitchMock = withViews(interswitchMock)
export const createYouVerifyMock = withViews(youverifyMock)
export const createOneSignalMock = withViews(onesignalMock)
export const createTwilioMock = withViews(twilioMock)
export const createFlutterwaveMock = withViews(flutterwaveMock)
export const createMonnifyMock = withViews(monnifyMock)
export const createTermiiMock = withViews(termiiMock)
export const createSmileIdMock = withViews(smileidMock)
export const createIdentityPassMock = withViews(identitypassMock)
export const createWhatsAppMock = withViews(whatsappMock)
export const createFcmMock = withViews(fcmMock)
export const createOpenAIMock = withViews(openaiMock)
export const createS3Mock = withViews(s3Mock)
export const createFacebookMock = withViews(facebookMock)
export const createInstagramMock = withViews(instagramMock)
export const createXMock = withViews(xMock)
export const createBlueskyMock = withViews(blueskyMock)
export const createTelegramMock = withViews(telegramMock)
export const createRedditMock = withViews(redditMock)
export const createLinkedinMock = withViews(linkedinMock)
export const createTiktokMock = withViews(tiktokMock)
export const createYoutubeMock = withViews(youtubeMock)
export const createPaypalMock = withViews(paypalMock)
export const createSquareMock = withViews(squareMock)
export const createAdyenMock = withViews(adyenMock)
export const createShippoMock = withViews(shippoMock)
export const createEasyPostMock = withViews(easypostMock)
export const createFedexMock = withViews(fedexMock)
export const createUpsMock = withViews(upsMock)
export const createDhlMock = withViews(dhlMock)
export const createAmazonSpApiMock = withViews(amazonSpApiMock)
export const createShopifyMock = withViews(shopifyMock)
export const createEbayMock = withViews(ebayMock)
export const createEtsyMock = withViews(etsyMock)
export const createWalmartMock = withViews(walmartMock)
export const createSendGridMock = withViews(sendgridMock)
export const createMailchimpMock = withViews(mailchimpMock)
export const createKlaviyoMock = withViews(klaviyoMock)
export const createPostmarkMock = withViews(postmarkMock)

/** A mock written as a route file rather than as code. */
export const createSpecMock = withViews(specMock)

/** A mock written as a route file on disk. */
export const createSpecMockFromFile = async (path) => attachViews(await specMockFromFile(path))

export { attachViews } from './ui/index.js'
