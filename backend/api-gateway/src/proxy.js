const http = require('node:http');
const https = require('node:https');

// Streams a request to an internal service and the response back, without
// buffering bodies (large photo uploads pass straight through).

const HOP_BY_HOP = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'upgrade', 'transfer-encoding'];
const agents = { 'http:': new http.Agent({ keepAlive: true, maxSockets: 256, keepAliveMsecs: 30000 }), 'https:': new https.Agent({ keepAlive: true, maxSockets: 256 }) };

function forward(req, res, target, { timeoutMs = 60000, logger, service } = {}) {
  const url = new URL(req.originalUrl, `${target}/`);
  const headers = { ...req.headers };
  for (const name of HOP_BY_HOP) if (name !== 'transfer-encoding') delete headers[name];
  headers.host = url.host;
  headers['x-request-id'] = req.id;
  headers['x-forwarded-for'] = req.get('x-forwarded-for') ? `${req.get('x-forwarded-for')}, ${req.socket.remoteAddress}` : req.socket.remoteAddress;
  headers['x-forwarded-proto'] = req.get('x-forwarded-proto') || req.protocol;
  headers['x-forwarded-host'] = req.get('x-forwarded-host') || req.get('host') || '';
  if (req.auth) { headers['x-gateway-user-id'] = req.auth.id; headers['x-gateway-user-role'] = req.auth.role; }
  else { delete headers['x-gateway-user-id']; delete headers['x-gateway-user-role']; }

  const lib = url.protocol === 'https:' ? https : http;
  const upstream = lib.request({ method: req.method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers, agent: agents[url.protocol], timeout: timeoutMs }, upstreamRes => {
    const out = { ...upstreamRes.headers };
    for (const name of HOP_BY_HOP) delete out[name];
    // CORS is decided once, at the gateway.
    for (const name of Object.keys(out)) if (name.startsWith('access-control-')) delete out[name];
    delete out['x-powered-by'];
    res.status(upstreamRes.statusCode);
    for (const [name, value] of Object.entries(out)) res.setHeader(name, value);
    res.setHeader('x-served-by', service);
    upstreamRes.pipe(res);
  });

  upstream.on('timeout', () => upstream.destroy(Object.assign(new Error('Upstream timed out'), { code: 'ETIMEDOUT' })));
  upstream.on('error', error => {
    logger?.warn('upstream error', { requestId: req.id, target: service, code: error.code, error });
    if (res.headersSent) { res.destroy(); return; }
    const timedOut = error.code === 'ETIMEDOUT';
    res.status(timedOut ? 504 : 503).json({ success: false, msg: timedOut ? 'The service took too long to respond. Please try again.' : 'This part of BookMyVilla is temporarily unavailable. Please try again shortly.', requestId: req.id });
  });
  req.on('aborted', () => upstream.destroy());
  req.pipe(upstream);
}

// GET a JSON endpoint with a short timeout (health aggregation).
function probe(target, pathName, timeoutMs = 2000) {
  return new Promise(resolve => {
    const url = new URL(pathName, `${target}/`);
    const lib = url.protocol === 'https:' ? https : http;
    const request = lib.get(url, { timeout: timeoutMs, agent: agents[url.protocol] }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { if (body.length < 4096) body += chunk; });
      response.on('end', () => { let json = null; try { json = JSON.parse(body); } catch { /* not JSON */ } resolve({ ok: response.statusCode === 200, status: response.statusCode, body: json }); });
    });
    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', error => resolve({ ok: false, status: 0, error: error.message }));
  });
}

module.exports = { forward, probe };
