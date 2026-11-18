import { describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';

const { isPrivateIp, validateUrlHost, safeFetchHtml, isDisallowedByRobots } = require('../src/services/ssrfGuard.js');

describe('public URL preview guard', () => {
  it('blocks private, loopback, link-local, documentation, and non-global IPv6 addresses', () => {
    for (const address of ['127.0.0.1', '10.2.3.4', '169.254.169.254', '192.168.1.2', '198.51.100.4', '::1', 'fc00::1', 'fe80::1', '2001:db8::1']) {
      expect(isPrivateIp(address), address).toBe(true);
    }
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('2606:4700:4700::1111')).toBe(false);
  });

  it('rejects a hostname if any DNS answer is private, including rebinding-style mixed results', async () => {
    const lookup = vi.fn().mockResolvedValue([
      { address: '8.8.8.8', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]);
    await expect(validateUrlHost('https://rebind.example/product', lookup)).rejects.toThrow(/private IP/i);
  });

  it('honors matching robots.txt disallow rules while allowing a more specific allow rule', () => {
    const url = new URL('https://shop.example/products/public/item');
    expect(isDisallowedByRobots('User-agent: *\nDisallow: /products/\nAllow: /products/public/', url)).toBe(false);
    expect(isDisallowedByRobots('User-agent: *\nDisallow: /products/', new URL('https://shop.example/products/private'))).toBe(true);
  });

  it('pins the request to the validated address and validates each redirect target', async () => {
    const lookup = vi.fn().mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    const pinnedIps = [];
    const requestImpl = vi.fn((url, options, callback) => {
      options.lookup(url.hostname, {}, (_error, address) => pinnedIps.push(address));
      const req = {
        setTimeout: vi.fn(),
        once: vi.fn().mockReturnThis(),
        end: () => {
          const response = Readable.from([]);
          response.statusCode = url.pathname === '/robots.txt' ? 404 : 302;
          response.headers = { location: 'http://169.254.169.254/latest/meta-data/' };
          callback(response);
        },
        destroy: vi.fn(),
      };
      return req;
    });

    await expect(safeFetchHtml('https://shop.example/item', { lookup, requestImpl })).rejects.toThrow(/private IP.*blocked/i);
    expect(requestImpl).toHaveBeenCalledTimes(2);
    expect(pinnedIps).toEqual(['8.8.8.8', '8.8.8.8']);
  });
});
