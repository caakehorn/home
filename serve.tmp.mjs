import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'
const ROOT = 'dist'
const T = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webm':'video/webm','.svg':'image/svg+xml','.woff2':'font/woff2','.txt':'text/plain' }
createServer(async (req,res)=>{
  const u = decodeURIComponent((req.url||'/').split('?')[0])
  if (u === '/gate/verify.enc') { res.writeHead(404); res.end('no verifier'); return }
  let p = join(ROOT, u==='/'?'/index.html':u)
  try { if ((await stat(p)).isDirectory()) p = join(p,'index.html'); const b = await readFile(p)
    res.writeHead(200,{'content-type':T[extname(p)]||'application/octet-stream'}); res.end(b)
  } catch { const b = await readFile(join(ROOT,'404.html')); res.writeHead(200,{'content-type':'text/html'}); res.end(b) }
}).listen(8813,'127.0.0.1',()=>console.log('up'))
