// Ghost types: what each one means, its ghost-story label, and the one-line fix.
// Labels are the fun part; fix text is the useful part. Every ghost gets both.

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

export const GHOST_TYPES = {
  dead: { name: 'Dead link', confidence: 'confirmed', weight: 10 },
  possessed: { name: 'Possessed link', confidence: 'maybe', weight: 6 },
  chain: { name: 'Redirect chain', confidence: 'confirmed', weight: 4 },
  nameless: { name: 'Nameless page', confidence: 'confirmed', weight: 6 },
  speechless: { name: 'Speechless page', confidence: 'confirmed', weight: 3 },
  'stale-year': { name: 'Stale year', confidence: 'confirmed', weight: 5 },
  'past-event': { name: 'Past event', confidence: 'maybe', weight: 7 },
  locked: { name: 'Locked door', confidence: 'unverified', weight: 0 },
};

export function describe(type, d = {}) {
  switch (type) {
    case 'dead':
      if (d.reason === 'malformed') {
        return {
          label: 'A link to nowhere. The address itself is broken.',
          fix: 'Fix the typo in the link, or remove it.',
        };
      }
      if (d.reason === 'dns') {
        return {
          label: 'The whole house is gone. Its domain no longer exists.',
          fix: 'Remove the link, or point it to where that content lives now.',
        };
      }
      if (d.status >= 500) {
        return {
          label: `Groans with a ${d.status} every time you knock.`,
          fix: 'Check the page is up. If it was removed, remove or replace the link.',
        };
      }
      return {
        label: 'This page left no forwarding address.',
        fix: 'Remove the link, or point it to the replacement page.',
      };
    case 'chain':
      if (d.loop) {
        return {
          label: 'Trapped in a redirect loop, forever.',
          fix: 'Fix the redirect rules so this URL ends on a real page.',
        };
      }
      return {
        label: `Wanders through ${d.hops} hops to find its way home.`,
        fix: `Link straight to ${d.finalUrl}`,
      };
    case 'possessed':
      return {
        label: `Now possessed by another site: ${d.finalHost}.`,
        fix: `It now lands on ${d.finalUrl}. Check that still makes sense, or update the link.`,
      };
    case 'nameless':
      return {
        label: 'A page with no name on its stone.',
        fix: 'Add a unique title of about 50 to 60 characters.',
      };
    case 'speechless':
      return {
        label: 'Has nothing to say for itself.',
        fix: 'Add a meta description of about 120 to 160 characters.',
      };
    case 'stale-year':
      return {
        label: `Still believes it's ${d.year}.`,
        fix: 'Update the year, or have your site fill in the current year automatically.',
      };
    case 'past-event': {
      const when = d.date ? `${MONTH_NAMES[d.date.getUTCMonth()]} ${d.date.getUTCFullYear()}` : 'a while ago';
      return {
        label: `Still waiting for a party that ended in ${when}.`,
        fix: 'Remove the invite, or mark the event as past and add the recording link.',
      };
    }
    case 'locked':
      return {
        label: "Won't let us in, so we can't say if it's alive.",
        fix: 'Open it in your browser once. Many sites block bots but work fine for people.',
      };
    default:
      return { label: 'Something stirs.', fix: 'Take a look.' };
  }
}

export function scoreGhosts(ghosts) {
  let score = 0;
  for (const g of ghosts) {
    const w = GHOST_TYPES[g.type]?.weight ?? 0;
    // A ghost found on many pages is worse, but cap it so one footer doesn't dominate.
    score += w * Math.min(1 + (g.foundOn.length - 1) * 0.25, 3);
  }
  score = Math.round(score);
  let rank;
  if (score === 0) rank = 'At peace';
  else if (score <= 20) rank = 'Restless';
  else if (score <= 50) rank = 'Haunted';
  else if (score <= 100) rank = 'Possessed';
  else rank = 'Cursed';
  return { score, rank };
}

const ORDER = ['dead', 'possessed', 'past-event', 'stale-year', 'nameless', 'chain', 'speechless', 'locked'];
export function sortGhosts(ghosts) {
  return ghosts.sort((a, b) =>
    ORDER.indexOf(a.type) - ORDER.indexOf(b.type) || b.foundOn.length - a.foundOn.length);
}
