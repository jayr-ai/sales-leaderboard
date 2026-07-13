// Production server for Railway. Reads index.html into memory once at startup and
// serves it as-is; because it reads at startup, always redeploy after regenerating
// index.html (a running process never picks up a changed file on disk).
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache'
  });
  res.end(HTML);
});

server.listen(PORT, () => {
  console.log('Sales Leaderboard Dashboard on ' + PORT);
});
