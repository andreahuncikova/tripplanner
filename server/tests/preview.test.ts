import { describe, it, expect } from 'vitest';
import { parsePreview, platformOf, toAmount, decodeEntities, detailsFromUrl } from '../src/preview/parse';
import { checkLink, isBlockedAddress } from '../src/preview/fetchPage';

// A hotel page as booking sites write it for search engines: Open Graph tags and a schema.org Hotel
const hotelPage = `<!doctype html><html><head>
  <title>Casa Azul, Lisbon – Updated 2026 Prices</title>
  <meta property="og:title" content="Casa Azul &amp; Garden">
  <meta property="og:image" content="//cf.example-cdn.com/images/casa-azul.jpg">
  <script type="application/ld+json">
    { "@context": "https://schema.org", "@graph": [
      { "@type": "WebSite", "name": "Stays" },
      { "@type": "Hotel", "name": "Casa Azul",
        "address": { "@type": "PostalAddress", "addressLocality": "Lisbon", "addressRegion": "Lisbon", "addressCountry": "Portugal" },
        "offers": { "@type": "Offer", "price": "1.234,50", "priceCurrency": "eur" } } ] }
  </script>
</head><body></body></html>`;

// A home page with only Open Graph data, the way rental sites often share it
const homePage = `<html><head>
  <meta name="twitter:title" content="Loft with a view">
  <meta property='og:image' content='http://img.example.com/loft.jpg'>
  <meta property="og:locality" content="Porto"><meta property="og:country-name" content="Portugal">
  <meta property="product:price:amount" content="89"><meta property="product:price:currency" content="EUR">
</head></html>`;

describe('parsePreview', () => {
  it('reads title, photo, price and location from a hotel page', () => {
    const p = parsePreview(hotelPage, 'https://www.booking.com/hotel/pt/casa-azul.html');
    expect(p).toEqual({
      url: 'https://www.booking.com/hotel/pt/casa-azul.html',
      platform: 'booking',
      title: 'Casa Azul & Garden',
      image: 'https://cf.example-cdn.com/images/casa-azul.jpg',
      price: { amount: 1234.5, currency: 'EUR' },
      location: 'Lisbon, Portugal',
      complete: true,
    });
  });

  it('reads Open Graph only pages and turns http photos into https', () => {
    const p = parsePreview(homePage, 'https://www.airbnb.com/rooms/1');
    expect(p).toMatchObject({
      platform: 'airbnb', title: 'Loft with a view', image: 'https://img.example.com/loft.jpg',
      price: { amount: 89, currency: 'EUR' }, location: 'Porto, Portugal', complete: true,
    });
  });

  it('marks a page without stay data as not complete', () => {
    const p = parsePreview('<html><head><title>Just a moment…</title></head></html>', 'https://example.com/x');
    expect(p).toEqual({ url: 'https://example.com/x', platform: 'other', title: 'Just a moment…', complete: false });
  });

  it('skips a broken JSON-LD block and still reads the rest', () => {
    const html = '<script type="application/ld+json">{ broken</script><meta property="og:title" content="Hostel">';
    expect(parsePreview(html, 'https://www.hostelworld.com/a').title).toBe('Hostel');
  });
});

describe('toAmount', () => {
  it('understands both decimal styles and thousands', () => {
    expect(toAmount('1.234,50')).toBe(1234.5);
    expect(toAmount('1,234.50')).toBe(1234.5);
    expect(toAmount('1.234')).toBe(1234);
    expect(toAmount('€ 120')).toBe(120);
    expect(toAmount(99.9)).toBe(99.9);
  });
  it('gives nothing for text that is not a price', () => {
    expect(toAmount('free')).toBeUndefined();
    expect(toAmount(0)).toBeUndefined();
    expect(toAmount(undefined)).toBeUndefined();
  });
});

describe('platformOf', () => {
  it('knows the booking sites by their address', () => {
    expect(platformOf('https://www.booking.com/hotel/x.html')).toBe('booking');
    expect(platformOf('https://de.airbnb.co.uk/rooms/1')).toBe('airbnb');
    expect(platformOf('https://www.vrbo.com/123')).toBe('vrbo');
    expect(platformOf('https://notbooking.com/x')).toBe('other');
    expect(platformOf('not a link')).toBe('other');
  });
});

describe('decodeEntities', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeEntities('A &amp; B &#39;C&#x27; &quot;D&quot;')).toBe(`A & B 'C' "D"`);
  });
});

describe('isBlockedAddress', () => {
  it('blocks addresses inside the server and private networks', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0',
      '100.64.0.1', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1']) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });
  it('allows public addresses', () => {
    for (const ip of ['8.8.8.8', '151.101.1.1', '172.32.0.1', '2a00:1450:4001::200e']) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });
});

describe('checkLink', () => {
  it('accepts normal http and https links and drops the #part', () => {
    expect(checkLink(' https://www.booking.com/hotel/x.html#photos ').href).toBe('https://www.booking.com/hotel/x.html');
    expect(checkLink('http://example.com/').protocol).toBe('http:');
  });
  it('refuses links that could reach the server itself or are not web links', () => {
    for (const bad of ['', 'hello', 'ftp://example.com', 'file:///etc/passwd', 'javascript:alert(1)',
      'http://localhost:3000/api', 'http://127.0.0.1/', 'http://[::1]/', 'http://169.254.169.254/latest/meta-data',
      'http://example.com:8080/', 'https://user:pass@example.com/', 'http://db.internal/']) {
      expect(() => checkLink(bad), bad).toThrow();
    }
    expect(() => checkLink(42)).toThrow();
  });
});

describe('detailsFromUrl', () => {
  it('reads the hotel name and country from a Booking address', () => {
    expect(detailsFromUrl('https://www.booking.com/hotel/vn/freebeach.html')).toEqual({ title: 'Freebeach', location: 'Vietnam' });
    expect(detailsFromUrl('https://www.booking.com/hotel/pt/lisbon-destination-hostel.en-gb.html?label=x'))
      .toEqual({ title: 'Lisbon Destination Hostel', location: 'Portugal' });
  });
  it('reads nothing from other addresses', () => {
    expect(detailsFromUrl('https://www.booking.com/Share-gLV8c4')).toEqual({});
    expect(detailsFromUrl('https://www.airbnb.com/rooms/1')).toEqual({});
    expect(detailsFromUrl('not a link')).toEqual({});
  });
});
