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
```

## What it finds

| Ghost | How it's found | Confidence |
| --- | --- | --- |
| Dead link | 404, 410, or 5xx after a retry | Confirmed |
| Redirect chain | 2 or more hops, or a loop | Confirmed |
| Nameless page | Missing title | Confirmed |
| Speechless page | Missing meta description | Confirmed |
| Stale year | Copyright year older than this year | Confirmed in the footer, maybe elsewhere |
| Past event | "Register", "upcoming" and similar next to a date that has passed | Maybe |
| Locked door | 403, 429, or no answer (often a bot block) | Unverified |

## Tests

```bash
npm test
```

The tests run a small haunted site locally with planted ghosts and look-alikes
that must not be flagged.

## License

MIT
