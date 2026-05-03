const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3003;
const FILE = path.join(__dirname, 'mockup.html');

http.createServer((req, res) => {
  fs.readFile(FILE, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('mockup.html not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`mockup → http://localhost:${PORT}`);
});
