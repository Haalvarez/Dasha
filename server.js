const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const rootDir = __dirname;
const port = 3000;

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function isSafeRootFile(fileName) {
  return typeof fileName === 'string' && /^[A-Za-z0-9._-]+\.json$/.test(fileName);
}

function serveFile(reqPath, res) {
  const normalizedPath = reqPath === '/' ? '/index.html' : reqPath;
  const decodedPath = decodeURIComponent(normalizedPath);
  const safePath = path.normalize(decodedPath).replace(/^([.][.][\/\\])+/, '');
  const filePath = path.join(rootDir, safePath);

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': contentTypes[ext] || 'application/octet-stream',
      'Content-Length': stats.size
    });

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal server error');
    });
    stream.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'POST' && requestUrl.pathname === '/save') {
    const fileName = requestUrl.searchParams.get('file');
    if (!isSafeRootFile(fileName)) {
      sendJson(res, 400, { ok: false, error: 'Invalid file name' });
      return;
    }

    const targetPath = path.join(rootDir, fileName);
    let rawBody = '';

    req.on('data', chunk => {
      rawBody += chunk;
      if (rawBody.length > 5 * 1024 * 1024) {
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        const parsed = JSON.parse(rawBody || '{}');
        const serialized = `${JSON.stringify(parsed, null, 2)}\n`;
        fs.writeFile(targetPath, serialized, 'utf8', err => {
          if (err) {
            sendJson(res, 500, { ok: false, error: 'Write failed' });
            return;
          }
          sendJson(res, 200, { ok: true });
        });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: 'Invalid JSON body' });
      }
    });

    req.on('error', () => {
      sendJson(res, 500, { ok: false, error: 'Request error' });
    });
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    serveFile(requestUrl.pathname, res);
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Method not allowed');
});

server.listen(port, () => {
  console.log('Dasha server running on http://localhost:3000');
});
