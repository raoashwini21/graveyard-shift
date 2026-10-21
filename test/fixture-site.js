// A small haunted website for tests. Every ghost here is planted on purpose,
// next to look-alikes that must NOT be flagged.

import http from 'node:http';

const FOOTER_OLD = '<footer><p>© 2022 Spooky Co. All rights reserved.</p></footer>';
const FOOTER_OK = '<footer><p>© 2019–2026 Spooky Co.</p></footer>';

const page = (title, body, { desc = 'A page that knows exactly what it is about.', footer = FOOTER_OLD, head = '' } = {}) => `<!doctype html>
<html><head>${title !== null ? `<title>${title}</title>` : ''}
${desc !== null ? `<meta name="description" content="${desc}">` : ''}${head}</head>
<body>${body}${footer}</body></html>`;

const routes = {
  '/': () => [200, 'text/html', page('Spooky Co', `
    <h1>Welcome to Spooky Co</h1>
    <p>Founded in 2015. Helping teams since 2019.</p>
    <a href="#top">Back to top</a>
    <a href="mailto:hi@example.com">Email</a> <a href="tel:+100">Call</a>
    <a href="/about">About</a>
    <a href="/old-page">Old page</a>
    <a href="/gone">Gone</a>
    <a href="/broken">Broken</a>
    <a href="/hop1">Wandering link</a>
    <a href="/moved">Moved once</a>
    <a href="/loop-a">Loop</a>
    <a href="/private">Members only</a>
    <a href="/slow">Slow but alive</a>
    <a href="/events">Events</a>
    <a href="/blog/2021-recap">Blog</a>
    <a href="/files/guide.pdf">Guide (PDF)</a>
    <a href="/noindex-page">Hidden</a>
    <a href="/untitled">Untitled</a>
    <a href="/admin">Admin</a>
    <a href="https://n">Typo link</a>
    <a href="/bot-shy">Shy</a> <a href="/busy">Busy</a> <a href="/rate">Rate</a> <a href="/challenge">Challenge</a>`)],
  '/about': () => [200, 'text/html', page('About Spooky Co', '<p>We are friendly ghosts.</p><a href="/">Home</a>', { footer: FOOTER_OK })],
  '/events': () => [200, 'text/html', page('Events', `
    <h2>Upcoming webinar: Growth Night</h2>
    <p>March 12, 2025 at 6 PM</p>
    <a href="/register">Register now</a>
    <hr><h2>Spring Meetup</h2>
    <p>April 3, 2025</p>
    <a href="/rec">Watch the recording</a>
    <hr><h2>Winter Summit</h2>
    <p>January 15, 2027</p>
    <a href="/register">Register now</a>`)],
  '/register': () => [200, 'text/html', page('Register', '<p>Form here.</p>')],
  '/rec': () => [200, 'text/html', page('Recording', '<p>Video.</p>')],
  '/blog/2021-recap': () => [200, 'text/html', page('2021 recap', `
    <p>Published March 3, 2021</p>
    <p>Join us! Our meetup is on June 5, 2021. Register now.</p>`)],
  '/untitled': () => [200, 'text/html', page(null, '<p>No name, no words.</p>', { desc: null })],
  '/noindex-page': () => [200, 'text/html', page(null, '<p>Hidden on purpose.</p>', { desc: null, head: '<meta name="robots" content="noindex">' })],
  '/files/guide.pdf': () => [200, 'application/pdf', '%PDF-1.4 fake'],
  '/gone': () => [410, 'text/html', 'gone'],
  '/broken': () => [500, 'text/html', 'oops'],
  '/private': () => [403, 'text/html', 'no'],
  '/robots.txt': (port) => [200, 'text/plain', `User-agent: *\nDisallow: /admin\nSitemap: http://127.0.0.1:${port}/sitemap.xml\n`],
  '/sitemap.xml': (port) => [200, 'application/xml', `<?xml version="1.0"?>
<urlset><url><loc>http://127.0.0.1:${port}/</loc></url><url><loc>http://127.0.0.1:${port}/about</loc></url>
<url><loc>http://127.0.0.1:${port}/events</loc></url><url><loc>http://127.0.0.1:${port}/ghost-page</loc></url></urlset>`],
};

const redirects = {
  '/hop1': '/hop2', '/hop2': '/hop3', '/hop3': '/about',
  '/moved': '/about',
  '/loop-a': '/loop-b', '/loop-b': '/loop-a',
};

export function startFixtureSite() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const path = new URL(req.url, 'http://x').pathname;
      const port = server.address().port;
      if (redirects[path]) { res.writeHead(301, { location: redirects[path] }); return res.end(); }
      if (path === '/slow') {
        return setTimeout(() => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page('Slow', '<p>ok</p>')); }, 1200);
      }
      if (path === '/admin') { res.writeHead(500); return res.end('robots should have stopped you'); }
      // Shows bots a 404 but serves people the page: must not be called dead.
      if (path === '/bot-shy') {
        const human = /Mozilla/.test(req.headers['user-agent'] || '');
        res.writeHead(human ? 200 : 404, { 'content-type': 'text/html' }); return res.end(human ? page('Fine', '<p>ok</p>') : 'not found');
      }
      if (path === '/busy') { res.writeHead(503, { 'content-type': 'text/html' }); return res.end('busy'); }
      if (path === '/rate') { res.writeHead(429, { 'content-type': 'text/html' }); return res.end('slow down'); }
      if (path === '/challenge') { res.writeHead(403, { 'content-type': 'text/html', 'cf-mitigated': 'challenge' }); return res.end('just a moment'); }
      const route = routes[path];
      if (!route) { res.writeHead(404, { 'content-type': 'text/html' }); return res.end('not found'); }
      const [status, type, body] = route(port);
      res.writeHead(status, { 'content-type': type });
      res.end(req.method === 'HEAD' ? undefined : body);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` }));
  });
}
