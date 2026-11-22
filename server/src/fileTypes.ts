// Which files may be uploaded, read from the file's own first bytes.
// The type the browser claims (Content-Type, the file name) is not trusted: anyone can rename a script to .jpg.
// Kept apart from files.ts so it can be tested without a database.

import type { FileKind } from '../../shared/types';

export type FileType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf';

const starts = (buf: Buffer, bytes: number[], at = 0) => buf.length >= at + bytes.length && bytes.every((b, i) => buf[at + i] === b);
const ascii = (s: string) => [...s].map(c => c.charCodeAt(0));

// The type of a file from its first bytes, or null for anything we do not accept
export function detectType(buf: Buffer): FileType | null {
  if (starts(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (starts(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (starts(buf, ascii('GIF87a')) || starts(buf, ascii('GIF89a'))) return 'image/gif';
  if (starts(buf, ascii('RIFF')) && starts(buf, ascii('WEBP'), 8)) return 'image/webp';
  if (starts(buf, ascii('%PDF-'))) return 'application/pdf';
  return null;
}

// What each kind of upload may be. The client makes photos smaller before it uploads them,
// so the limits are well above a normal photo and only stop very large files.
export const UPLOAD_RULES: Record<FileKind, { types: FileType[]; maxBytes: number }> = {
  avatar: { types: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 2 * 1024 * 1024 },
  chat:   { types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'], maxBytes: 10 * 1024 * 1024 },
  stay:   { types: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 10 * 1024 * 1024 },
};

export const isFileKind = (v: unknown): v is FileKind => v === 'avatar' || v === 'chat' || v === 'stay';

const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

// The type of an upload, or the reason it is refused
export function checkUpload(kind: FileKind, buf: Buffer): { ok: true; type: FileType } | { ok: false; error: string } {
  const rules = UPLOAD_RULES[kind];
  if (!buf.length) return { ok: false, error: 'The file is empty' };
  if (buf.length > rules.maxBytes) return { ok: false, error: `The file is too large — at most ${mb(rules.maxBytes)}` };
  const type = detectType(buf);
  if (!type || !rules.types.includes(type)) {
    return { ok: false, error: kind === 'chat' ? 'Only photos (JPG, PNG, WebP, GIF) and PDF files can be sent' : 'Please choose a JPG, PNG or WebP photo' };
  }
  return { ok: true, type };
}

// The file name shown in the chat: no folders, no control characters, at most 120 characters.
// It is only ever shown as text, never used as a path.
export function cleanFileName(v: unknown): string {
  let name = '';
  try { name = decodeURIComponent(String(v ?? '')); } catch { name = String(v ?? ''); }
  name = name.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f"]/g, '').trim();
  return name.slice(0, 120) || 'file';
}
