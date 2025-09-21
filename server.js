const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3001);
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const sendNotFound = (res) => {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
};

const serveFile = (res, filepath, cache = false) => {
  fs.readFile(filepath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        sendNotFound(res);
        return;
      }
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
      return;
    }

    const ext = path.extname(filepath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    const headers = { 'Content-Type': mime };
    if (cache) {
      headers['Cache-Control'] = 'public, max-age=86400';
    }

    res.writeHead(200, headers);
    res.end(content);
  });
};

const server = http.createServer((req, res) => {
  if (!req.url) {
    sendNotFound(res);
    return;
  }

  const urlPath = req.url.split('?')[0];

  if (urlPath === '/' || urlPath === '') {
    res.writeHead(302, { Location: '/login' });
    res.end();
    return;
  }

  if (urlPath === '/login') {
    serveFile(res, path.join(PUBLIC_DIR, 'login.html'));
    return;
  }

  if (urlPath === '/dashboard') {
    serveFile(res, path.join(PUBLIC_DIR, 'dashboard.html'));
    return;
  }

  if (urlPath.startsWith('/slack-mock/')) {
    serveFile(res, path.join(PUBLIC_DIR, 'slack-mock.html'));
    return;
  }

  if (urlPath === '/favicon.ico') {
    sendNotFound(res);
    return;
  }

  if (urlPath.startsWith('/static/')) {
    const relativePath = urlPath.replace('/static/', '');
    const targetPath = path.join(PUBLIC_DIR, relativePath);

    if (!targetPath.startsWith(PUBLIC_DIR)) {
      sendNotFound(res);
      return;
    }

    const isCacheable = targetPath.endsWith('.js') || targetPath.endsWith('.css');
    serveFile(res, targetPath, isCacheable);
    return;
  }

  sendNotFound(res);
});

server.listen(PORT, HOST, () => {
  console.log(`SlackNews mock app running at http://${HOST}:${PORT}`);
});
