#!/usr/bin/env node
/*
 * سرور محلی خودکفا برای ابزارهای سنجش
 *
 * چرا؟ jsdom با منبع file:// حافظه‌ی محلی (localStorage) را رد می‌کند و بدون آن برنامه بوت نمی‌شود؛
 * پس ابزارها مجبور بودند یک URL با منبع http بدهند. قبلاً این URL ثابت «127.0.0.1:8080» بود و
 * به‌طور اتفاقی از سرور پیش‌نمایش زنده‌ی کاربر (که همان مخزن جلسه را سرو می‌کند) تغذیه می‌شد؛
 * یعنی سنجش یک درخت دیگر، در واقع اسکریپت‌های مخزن جلسه را می‌خواند. این ماژول به هر ابزار
 * سرور موقت خودش را با ریشه‌ی همان درختی که اندازه می‌گیرد می‌دهد تا نتیجه هرگز آلوده نشود.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

function serve(root) {
  const base = path.resolve(root);
  const server = http.createServer((request, response) => {
    let target = decodeURIComponent((request.url || '/').split('?')[0]);
    if (target === '/' || target === '') target = '/index.html';
    const file = path.join(base, target);
    if (!file.startsWith(base)) {
      response.writeHead(403).end('forbidden');
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        response.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
        return;
      }
      response.writeHead(200, {
        'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      response.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        port,
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

module.exports = { serve };
