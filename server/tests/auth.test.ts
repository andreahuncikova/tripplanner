import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { readBearer, verifyToken } from '../src/middleware/auth';
import { JWT_SECRET } from '../src/config';

const user = { _id: '64b000000000000000000001', email: 'anna@test.dev', username: 'Anna', color: '#E8572A' };
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

describe('readBearer', () => {
  it('reads the token from "Bearer <token>"', () => {
    expect(readBearer('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('rejects anything else', () => {
    expect(readBearer(undefined)).toBeNull();
    expect(readBearer('')).toBeNull();
    expect(readBearer('abc.def.ghi')).toBeNull();
    expect(readBearer('Token abc.def.ghi')).toBeNull();
    expect(readBearer('Bearer')).toBeNull();
  });
});

describe('verifyToken', () => {
  it('accepts a token signed by the server', () => {
    const token = jwt.sign(user, JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
    expect(verifyToken(token)).toMatchObject(user);
  });

  it('rejects a token signed with another secret', () => {
    const token = jwt.sign(user, 'x'.repeat(64), { algorithm: 'HS256' });
    expect(() => verifyToken(token)).toThrow();
  });

  it('rejects a token with the "none" algorithm', () => {
    const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(user)}.`;
    expect(() => verifyToken(token)).toThrow();
  });

  it('rejects the right secret with another algorithm', () => {
    const token = jwt.sign(user, JWT_SECRET, { algorithm: 'HS512' });
    expect(() => verifyToken(token)).toThrow();
  });

  it('rejects an expired token', () => {
    const token = jwt.sign({ ...user, exp: Math.floor(Date.now() / 1000) - 60 }, JWT_SECRET, { algorithm: 'HS256' });
    expect(() => verifyToken(token)).toThrow();
  });

  it('rejects a token whose content was changed', () => {
    const [header, , signature] = jwt.sign(user, JWT_SECRET, { algorithm: 'HS256' }).split('.');
    const changed = `${header}.${b64({ ...user, username: 'Admin' })}.${signature}`;
    expect(() => verifyToken(changed)).toThrow();
  });
});
