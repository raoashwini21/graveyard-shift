# Graveyard Shift 🏮

Find the ghosts on your website: dead links, redirect chains, pages with no title,
"© 2022" footers, and invites to events that already happened.

Free, open source, no signup and no API keys.

> Work in progress for [Hackyard Yard #5: Haunted](https://hackyard.tech/yards/yard-5).
> Full README coming Thursday.

## Run it

```bash
npm install
npm start            # open http://localhost:3000
```

Or from the terminal:

```bash
node bin/graveyard.js yoursite.com
node bin/graveyard.js yoursite.com --format md --out report.md
node bin/graveyard.js yoursite.com --max-pages 300 --internal-only
```

Links to other sites are checked by default, because that's where most dead links hide.
Your own links are always checked first.

## What it finds

| Ghost | How it's found | Confidence |
| --- | --- | --- |
| Dead link | 404, 410, 5xx after a retry, or a broken address like `https://n/` | Confirmed |
| Redirect chain | 2 or more hops, or a loop | Confirmed |
| Nameless page | Missing title | Confirmed |
| Speechless page | Missing meta description | Confirmed |
| Stale year | Copyright year older than this year | Confirmed in the footer, maybe elsewhere |
| Past event | "Register", "upcoming" and similar next to a date that has passed | Maybe |
| Locked door | 403, 429, no answer, or any error from sites that hide pages from bots (LinkedIn, X and similar) | Unverified |

## Tests

```bash
npm test
```

The tests run a small haunted site locally with planted ghosts and look-alikes
that must not be flagged.

## License

MIT
