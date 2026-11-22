import { describe, it, expect } from 'vitest';
import { checkUpload, cleanFileName, detectType, UPLOAD_RULES } from '../src/fileTypes';
import { isFileId, newFileId } from '../src/files';

const bytes = (...parts: (number[] | string)[]) =>
  Buffer.concat(parts.map(p => (typeof p === 'string' ? Buffer.from(p, 'latin1') : Buffer.from(p))));

const jpeg = bytes([0xff, 0xd8, 0xff, 0xe0], 'rest of a photo');
const png = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'IHDR');
const gif = bytes('GIF89a', [1, 0, 1, 0]);
const webp = bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8 ');
const pdf = bytes('%PDF-1.7\n');

describe('detectType', () => {
  it('reads the type from the first bytes', () => {
    expect(detectType(jpeg)).toBe('image/jpeg');
    expect(detectType(png)).toBe('image/png');
    expect(detectType(gif)).toBe('image/gif');
    expect(detectType(webp)).toBe('image/webp');
    expect(detectType(pdf)).toBe('application/pdf');
  });

  it('does not accept other files, whatever their name says', () => {
    expect(detectType(bytes('<html><script>alert(1)</script>'))).toBeNull();
    expect(detectType(bytes('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(detectType(bytes('RIFF', [0, 0, 0, 0], 'WAVE'))).toBeNull();
    expect(detectType(bytes([0xff, 0xd8]))).toBeNull();
    expect(detectType(Buffer.alloc(0))).toBeNull();
  });
});

describe('checkUpload', () => {
  it('takes photos as profile photos, but not GIFs or PDFs', () => {
    expect(checkUpload('avatar', jpeg)).toEqual({ ok: true, type: 'image/jpeg' });
    expect(checkUpload('avatar', webp).ok).toBe(true);
    expect(checkUpload('avatar', gif).ok).toBe(false);
    expect(checkUpload('avatar', pdf).ok).toBe(false);
  });

  it('takes photos, GIFs and PDFs in the chat', () => {
    for (const f of [jpeg, png, gif, webp, pdf]) expect(checkUpload('chat', f).ok).toBe(true);
  });

  it('refuses empty and too large files', () => {
    expect(checkUpload('chat', Buffer.alloc(0))).toEqual({ ok: false, error: 'The file is empty' });
    const big = Buffer.concat([jpeg, Buffer.alloc(UPLOAD_RULES.avatar.maxBytes)]);
    expect(checkUpload('avatar', big)).toEqual({ ok: false, error: 'The file is too large — at most 2 MB' });
    expect(checkUpload('chat', big).ok).toBe(true);
  });
});

describe('cleanFileName', () => {
  it('keeps a normal name, also with accents', () => {
    expect(cleanFileName(encodeURIComponent('Lístky do Lisabonu.pdf'))).toBe('Lístky do Lisabonu.pdf');
  });

  it('drops folders, quotes and control characters', () => {
    expect(cleanFileName('..%2F..%2Fetc%2Fpasswd')).toBe('passwd');
    expect(cleanFileName('C:\\Users\\mia\\ticket.pdf')).toBe('ticket.pdf');
    expect(cleanFileName('a"b\r\nc.jpg')).toBe('abc.jpg');
  });

  it('gives a name when there is none, and cuts long ones', () => {
    expect(cleanFileName(undefined)).toBe('file');
    expect(cleanFileName('%E0%A4%A')).toBe('%E0%A4%A');
    expect(cleanFileName('x'.repeat(300))).toHaveLength(120);
  });
});

describe('file ids', () => {
  it('are 48 random hex characters', () => {
    const a = newFileId(), b = newFileId();
    expect(isFileId(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(isFileId('64b000000000000000000001')).toBe(false);
    expect(isFileId('../' + a.slice(3))).toBe(false);
  });
});
