# hivechainmini-frontend

**Hive Chain Mini** is a friendly, Reddit-style front end for the [Hive](https://hive.io) blockchain, made for people who are brand new to Hive.

- Browse communities, posts, comments and profiles without an account.
- Log in with **Hive Keychain** (desktop extension) or **HiveAuth** (phone wallet) to upvote, comment, post, follow people and join communities.
- **No token values anywhere.** Only vote counts and comment counts are shown.
- Fully static: no backend, no secrets, no environment variables. The browser talks straight to public Hive API nodes.

## Run it locally

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install && npm run dev
```

Then open the URL it prints (usually http://localhost:5173).

To check the production build: `npm run build && npm run preview`.

## Deploy to Cloudflare Pages

The app is a plain static site: build with `npm run build`, and the output is in `dist/`.

First time only:

```bash
npx wrangler login
npx wrangler pages project create hivechainmini-frontend --production-branch main
```

Every deploy after that:

```bash
npm run deploy
```

`npm run deploy` builds the app, runs the no-token-value check (below), and uploads `dist/` with `wrangler pages deploy`. Wrangler prints the live URL (`https://hivechainmini-frontend.pages.dev` or similar).

**Deep links work out of the box.** Cloudflare Pages treats a site with no top-level `404.html` as a single-page app and serves `index.html` for any path, so URLs like `/p/author/permlink` load directly. Don't add a `404.html` to `public/`.

You can also connect the Git repo in the Cloudflare dashboard instead (build command `npm run build`, output directory `dist`).

## Settings

Everything you might want to change is in [`src/config.ts`](src/config.ts):

| Setting | What it does |
| --- | --- |
| `APP_NAME` | The app's name, used in the header, page titles and wallet prompts. |
| `SHOW_REWARDS` | `false` hides all token values. The only place they could ever render is `src/components/RewardInfo.tsx`. |
| `VOTE_WEIGHT_PERCENT` | Upvote strength (1–100). |
| `DEFAULT_COMMUNITIES` | The communities pre-selected on the welcome screen. |
| `API_NODES` | Public Hive API nodes, tried in order with automatic failover. |
| `NODE_TIMEOUT_MS`, `FEED_CACHE_TTL_MS` | Per-node timeout and how long feed responses are cached in memory. |
| `POST_SOFT_CAP`, `COMMENT_SOFT_CAP` | When the friendly "that's a long one" hint appears. |
| `HIVEAUTH_HOST` | The HiveAuth relay server. |

## The no-token-value check

```bash
npm run build && npm run check:rewards
```

This scans every file in `dist/` for reward fields (`pending_payout_value` and friends), HBD, Hive Power, and dollar amounts, and fails if it finds any. It runs automatically as part of `npm run deploy`.

## How it works

- **Reads** go over JSON-RPC to public nodes (`src/lib/rpc.ts`). A node that times out or errors moves to the back of the list, and the next one is tried. Feed calls are cached for 60 seconds.
- **Writes** are built as plain Hive operations and signed by the user's wallet (`src/auth/`). The app asks only for **posting** authority and never sees, asks for or stores any private key. For HiveAuth, the app keeps a random session encryption key, which is not a Hive key, so the phone wallet can recognize later requests.
- **Communities**: your picks live in the browser. When you log in, on-chain subscriptions are merged in. Joining or leaving while logged in also updates your Hive account, and it fails silently if that doesn't work.
- **Markdown** is rendered with `marked` and sanitized with DOMPurify (`src/lib/markdown.ts`). Scripts, iframes, forms, inline styles and non-http(s) links are stripped, and images load through the Hive image proxy.
- **Friendly errors**: raw chain errors are mapped to plain language in `src/lib/errors.ts`. For example, running out of Resource Credits shows "Your energy is recharging".

## Not included (on purpose)

Wallet, payouts, downvotes, search, notifications, editing or deleting, image upload, translations.
