const dns = require('node:dns/promises');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');

function isPrivateIp(ipAddress) {
  if (!ipAddress || typeof ipAddress !== 'string') return true;
  let cleanIp = ipAddress.replace(/^\[|\]$/g, '');
  const mapped = cleanIp.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) cleanIp = mapped[1];
  const version = net.isIP(cleanIp);

  if (version === 4) {
    const [a, b, c] = cleanIp.split('.').map(Number);
    return a === 0 || a === 10 || (a === 100 && b >= 64 && b <= 127) || a === 127
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 0 || b === 168)) || (a === 198 && (b === 18 || b === 19))
      || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)
      || (a >= 224);
  }

  if (version === 6) {
    const lower = cleanIp.toLowerCase();
    if (lower.startsWith('::ffff:')) return isPrivateIp(lower.slice(7));
    const firstSegment = Number.parseInt(lower.split(':')[0] || '0', 16);
    // Only globally routed 2000::/3 addresses are eligible for URL previews.
    return (firstSegment & 0xe000) !== 0x2000
      || lower.startsWith('2001:db8:')
      || lower.startsWith('2001:10:')
      || lower.startsWith('2002:');
  }
  return true;
}

async function validateUrlHost(urlString, lookup = dns.lookup) {
  let url;
  try { url = new URL(urlString); } catch { throw new Error('Invalid URL format'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS protocols are permitted');
  if (url.username || url.password) throw new Error('URL credentials are not permitted');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (!hostname) throw new Error('Missing URL hostname');
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error(`Access to private IP address ${hostname} is blocked`);
    return { url, addresses: [{ address: hostname, family: net.isIP(hostname) }] };
  }

  const lowerHost = hostname.toLowerCase();
  if (lowerHost === 'localhost' || lowerHost.endsWith('.localhost') || lowerHost.endsWith('.internal')
    || lowerHost.endsWith('.local') || lowerHost.endsWith('.lan') || lowerHost === 'metadata.google.internal') {
    throw new Error(`Access to host ${hostname} is blocked`);
  }
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses?.length) throw new Error(`Could not resolve hostname ${hostname}`);
  if (addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error(`Hostname ${hostname} resolves to a blocked private IP address`);
  }
  return { url, addresses };
}

const MAX_BYTES = 1024 * 1024;
const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const ROBOTS_MAX_BYTES = 64 * 1024;

function requestPinned(validated, requestImpl) {
  const { url, addresses } = validated;
  const address = addresses[0];
  const transport = url.protocol === 'https:' ? https : http;
  const makeRequest = requestImpl || transport.request.bind(transport);
  return new Promise((resolve, reject) => {
    const req = makeRequest(url, {
      method: 'GET',
      headers: { 'User-Agent': 'VYUMI-ShopWithMe/1.0', Accept: 'text/html,application/xhtml+xml' },
      servername: net.isIP(url.hostname.replace(/^\[|\]$/g, '')) ? undefined : url.hostname,
      // Pin the connection to the address we validated to prevent DNS rebinding.
      lookup: (_hostname, options, callback) => {
        if (options?.all) callback(null, [address]);
        else callback(null, address.address, address.family);
      },
    }, resolve);
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error('Target server timed out after 5 seconds')));
    req.once('error', reject);
    req.end();
  });
}

async function safeFetchHtml(initialUrl, { lookup = dns.lookup, requestImpl } = {}) {
  let currentUrl = initialUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const validated = await validateUrlHost(currentUrl, lookup);
    const robotsUrl = new URL('/robots.txt', validated.url.origin).toString();
    const robotsTarget = await validateUrlHost(robotsUrl, lookup);
    const robotsResponse = await requestPinned(robotsTarget, requestImpl);
    let robotsText = '';
    if (REDIRECT_STATUSES.has(robotsResponse.statusCode)) {
      robotsResponse.resume();
      throw new Error('Redirects from robots.txt are not followed');
    }
    if (robotsResponse.statusCode >= 200 && robotsResponse.statusCode < 300
      && /^text\/plain(?:;|$)/i.test(robotsResponse.headers['content-type'] || '')) {
      const pieces = [];
      let length = 0;
      for await (const piece of robotsResponse) {
        length += piece.length;
        if (length > ROBOTS_MAX_BYTES) {
          robotsResponse.destroy();
          throw new Error('robots.txt exceeds 64 KB limit');
        }
        pieces.push(piece);
      }
      robotsText = Buffer.concat(pieces).toString('utf8');
    } else {
      robotsResponse.resume();
    }
    if (isDisallowedByRobots(robotsText, validated.url)) {
      throw new Error('URL is disallowed by robots.txt');
    }
    const response = await requestPinned(validated, requestImpl);
    if (REDIRECT_STATUSES.has(response.statusCode)) {
      response.resume();
      if (redirects === MAX_REDIRECTS) throw new Error('Too many redirects (max 3 allowed)');
      const location = response.headers.location;
      if (!location) throw new Error('Redirect missing Location header');
      currentUrl = new URL(location, validated.url).toString();
      continue;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      response.resume();
      throw new Error(`HTTP error ${response.statusCode} from target server`);
    }
    const contentType = response.headers['content-type'] || '';
    if (!/^(text\/html|application\/xhtml\+xml)(;|$)/i.test(contentType)) {
      response.resume();
      throw new Error(`Invalid content type: expected HTML, got ${contentType}`);
    }
    const length = Number(response.headers['content-length']);
    if (Number.isFinite(length) && length > MAX_BYTES) {
      response.destroy();
      throw new Error('Response size exceeds maximum 1 MB limit');
    }
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response) {
      bytes += chunk.length;
      if (bytes > MAX_BYTES) {
        response.destroy();
        throw new Error('Response size exceeds maximum 1 MB limit');
      }
      chunks.push(chunk);
    }
    return { url: currentUrl, status: response.statusCode, html: Buffer.concat(chunks).toString('utf8') };
  }
  throw new Error('Too many redirects');
}

function isDisallowedByRobots(text, url) {
  const groups = [];
  let group = null;
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.split('#', 1)[0].trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === 'user-agent') {
      if (!group || group.hasRules) {
        group = { agents: [], rules: [], hasRules: false };
        groups.push(group);
      }
      group.agents.push(value.toLowerCase());
    } else if ((key === 'allow' || key === 'disallow') && group) {
      group.rules.push({ allow: key === 'allow', path: value });
      group.hasRules = true;
    }
  }
  const exactGroups = groups.filter((item) => item.agents.some((agent) => agent !== '*' && 'vyumi-shopwithme'.startsWith(agent)));
  const applicable = exactGroups.length ? exactGroups : groups.filter((item) => item.agents.includes('*'));
  const requestPath = `${url.pathname}${url.search}`;
  const rules = applicable.flatMap((item) => item.rules).filter((rule) => rule.path);
  const matches = rules.filter((rule) => {
    const hasEndAnchor = rule.path.endsWith('$');
    const unanchored = hasEndAnchor ? rule.path.slice(0, -1) : rule.path;
    const pattern = unanchored.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + (hasEndAnchor ? '$' : '');
    return new RegExp(`^${pattern}`).test(requestPath);
  }).sort((a, b) => b.path.length - a.path.length);
  return Boolean(matches[0] && !matches[0].allow);
}

module.exports = { isPrivateIp, validateUrlHost, safeFetchHtml, isDisallowedByRobots };
