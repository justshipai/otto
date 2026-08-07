import { describe, expect, it } from 'vitest';
import { htmlToText, refuseUrl } from '@/lib/search/read-page';

describe('refuseUrl — research reads the public web only', () => {
  it('accepts ordinary public urls', () => {
    expect(refuseUrl('https://example.com/news')).toBeUndefined();
    expect(refuseUrl('http://blog.example.co.uk/post?id=1')).toBeUndefined();
  });

  it('refuses non-http protocols', () => {
    expect(refuseUrl('file:///etc/passwd')).toBeTruthy();
    expect(refuseUrl('ftp://example.com')).toBeTruthy();
    expect(refuseUrl('not a url')).toBeTruthy();
  });

  it('refuses local and private-network addresses', () => {
    for (const url of [
      'http://localhost:3000/api/settings',
      'http://127.0.0.1/admin',
      'http://0.0.0.0:9091',
      'http://10.1.2.3/internal',
      'http://192.168.1.1/router',
      'http://172.16.0.1/',
      'http://172.31.255.255/',
      'http://169.254.169.254/latest/meta-data',
      'http://[::1]:8080/',
      'http://printer.local/',
    ]) {
      expect(refuseUrl(url), url).toBeTruthy();
    }
  });
});

describe('htmlToText', () => {
  it('strips tags, scripts and styles but keeps prose', () => {
    const html = `<html><head><title>Murphy AI raises $40M</title><style>.x{color:red}</style>
      <script>alert('tracking')</script></head>
      <body><h1>Murphy AI raises $40M</h1><p>The startup, founded in 2024, builds agents.</p>
      <ul><li>Series A</li><li>120 people</li></ul></body></html>`;
    const text = htmlToText(html);
    expect(text).toContain('Murphy AI raises $40M');
    expect(text).toContain('founded in 2024');
    expect(text).toContain('Series A');
    expect(text).not.toContain('alert');
    expect(text).not.toContain('color:red');
    expect(text).not.toContain('<');
  });

  it('decodes common entities', () => {
    expect(htmlToText('<p>Q&amp;A &quot;live&quot; &#39;now&#39;</p>')).toBe('Q&A "live" \'now\'');
  });
});
