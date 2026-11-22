// File storage: chat photos, attachments and profile photos.
// Render's disk is wiped on every deploy and restart, so the files are kept in MongoDB with GridFS,
// which splits a file into chunks of 255 KB (collections files.files and files.chunks).
// No extra service or key is needed, but the free Atlas cluster has 512 MB for everything,
// so the client makes photos smaller first and the server stops taking files at MAX_TOTAL_BYTES.

import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import type { FileKind, UploadedFile } from '../../shared/types';
import type { FileType } from './fileTypes';

// Leaves room in the 512 MB cluster for the trips, messages and stays themselves
export const MAX_TOTAL_BYTES = 300 * 1024 * 1024;

// The id in a file's address: 24 random bytes as hex. A MongoDB ObjectId would be partly guessable
// (it starts with the time), and the address is the only thing that protects a file, because <img> cannot send the log-in token.
export const newFileId = () => crypto.randomBytes(24).toString('hex');
export const isFileId = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{48}$/.test(v);
export const fileUrl = (id: string) => `/api/files/${id}`;

interface FileMeta {
  kind: FileKind;
  type: FileType;
  name: string;
  uploadedByUserId: Types.ObjectId;
  groupId: Types.ObjectId | null;   // the trip, for chat files; deleted with the trip
}

let bucket: mongoose.mongo.GridFSBucket | null = null;
function files() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('The database is not connected');
  if (!bucket) {
    bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'files' });
    // Deleting a trip looks for its files by trip
    db.collection('files.files').createIndex({ 'metadata.groupId': 1 }).catch(e => console.error('[files:index]', e.message));
  }
  return bucket;
}

// How many bytes all saved files take together
export async function totalBytes(): Promise<number> {
  const [row] = await mongoose.connection.db!.collection('files.files')
    .aggregate<{ sum: number }>([{ $group: { _id: null, sum: { $sum: '$length' } } }]).toArray();
  return row?.sum ?? 0;
}

export async function saveFile(buf: Buffer, meta: FileMeta): Promise<UploadedFile> {
  const id = newFileId();
  await new Promise<void>((resolve, reject) => {
    const up = files().openUploadStream(id, { metadata: meta });
    up.once('finish', () => resolve());
    up.once('error', reject);
    up.end(buf);
  });
  return { id, url: fileUrl(id), type: meta.type, size: buf.length, name: meta.name };
}

// The stored file with this id, or null
export async function findFile(id: string) {
  const [f] = await files().find({ filename: id }).limit(1).toArray();
  return f ? { _id: f._id, length: f.length, meta: f.metadata as FileMeta } : null;
}

export const openFile = (fileId: Types.ObjectId) => files().openDownloadStream(fileId);

export async function deleteFile(fileId: Types.ObjectId) {
  await files().delete(fileId);
}

// When a trip is deleted, its chat files go too
export async function deleteTripFiles(groupId: Types.ObjectId | string) {
  if (!mongoose.connection.db) return;
  const list = await files().find({ 'metadata.groupId': new Types.ObjectId(String(groupId)) }, { projection: { _id: 1 } }).toArray();
  for (const f of list) await files().delete(f._id);
}
