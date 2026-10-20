// Minimal robots.txt support: Allow/Disallow for our agent (or *), with
// wildcards and $ anchors, longest match wins. Also collects Sitemap lines.

function ruleToRegex(path) {
  let s = path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  if (s.endsWith('\\$')) s = s.slice(0, -2) + '$';
  return new RegExp('^' + s);
}

export function parseRobots(text = '') {
  const groups = [];
  const sitemaps = [];
  let cur = null;
  for (let line of text.split(/\r?\n/)) {
    line = line.replace(/#.*/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
    } else if ((key === 'allow' || key === 'disallow') && cur && val) {
      cur.rules.push({ allow: key === 'allow', path: val, re: ruleToRegex(val) });
    } else if (key === 'sitemap' && val) {
      sitemaps.push(val);
    }
  }
  const group =
    groups.find((g) => g.agents.some((a) => a.includes('graveyardshift'))) ||
    groups.find((g) => g.agents.includes('*'));
  const rules = group ? group.rules : [];

  return {
    sitemaps,
    isAllowed(pathAndQuery) {
      let best = null;
      for (const r of rules) {
        if (!r.re.test(pathAndQuery)) continue;
        if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
      }
      return !best || best.allow;
    },
  };
}
