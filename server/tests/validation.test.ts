import { describe, it, expect } from 'vitest';
import { checkLogin, checkPasswordChange, checkRegister, normalizeInviteCode } from '../src/validation';

const valid = { email: 'mia@example.com', password: 'password1', username: 'Mia Novak' };

describe('checkRegister', () => {
  it('accepts a normal sign-up', () => {
    expect(checkRegister(valid)).toEqual({ ok: true, value: valid });
  });

  it('stores the email in lower case and without spaces around it', () => {
    const r = checkRegister({ ...valid, email: '  Mia@Example.COM ' });
    expect(r.ok && r.value.email).toBe('mia@example.com');
  });

  it('trims the name', () => {
    const r = checkRegister({ ...valid, username: '  Mia  ' });
    expect(r.ok && r.value.username).toBe('Mia');
  });

  it('needs every field', () => {
    expect(checkRegister({ ...valid, username: '   ' })).toEqual({ ok: false, error: 'Please fill in all fields' });
    expect(checkRegister({ email: valid.email })).toEqual({ ok: false, error: 'Please fill in all fields' });
    expect(checkRegister(undefined)).toEqual({ ok: false, error: 'Please fill in all fields' });
  });

  it('needs a password of at least 8 characters', () => {
    expect(checkRegister({ ...valid, password: '1234567' }).ok).toBe(false);
    expect(checkRegister({ ...valid, password: '12345678' }).ok).toBe(true);
  });

  it('rejects an email without @ or domain', () => {
    expect(checkRegister({ ...valid, email: 'mia.example.com' }).ok).toBe(false);
    expect(checkRegister({ ...valid, email: 'mia@example' }).ok).toBe(false);
  });

  it('rejects a name longer than 30 characters', () => {
    expect(checkRegister({ ...valid, username: 'x'.repeat(31) }).ok).toBe(false);
  });

  it('rejects objects instead of text (NoSQL injection)', () => {
    expect(checkRegister({ ...valid, email: { $gt: '' } }).ok).toBe(false);
    expect(checkRegister({ ...valid, password: { $ne: null } }).ok).toBe(false);
  });
});

describe('checkLogin', () => {
  it('accepts email and password and normalizes the email', () => {
    expect(checkLogin({ email: 'MIA@example.com', password: 'secret' }))
      .toEqual({ ok: true, value: { email: 'mia@example.com', password: 'secret' } });
  });

  it('still accepts old passwords shorter than 8 characters', () => {
    // Accounts from before the 8-character rule must still be able to log in
    expect(checkLogin({ email: 'mia@example.com', password: 'abc123' }).ok).toBe(true);
  });

  it('rejects missing fields and objects instead of text', () => {
    expect(checkLogin({ email: 'mia@example.com' }).ok).toBe(false);
    expect(checkLogin({ email: { $gt: '' }, password: 'x' }).ok).toBe(false);
  });
});

describe('checkPasswordChange', () => {
  it('accepts a new password of at least 8 characters', () => {
    expect(checkPasswordChange({ currentPassword: 'old-pass', newPassword: 'new-pass1' }))
      .toEqual({ ok: true, value: { currentPassword: 'old-pass', newPassword: 'new-pass1' } });
  });

  it('needs both passwords', () => {
    expect(checkPasswordChange({ newPassword: 'new-pass1' }).ok).toBe(false);
  });

  it('needs a new password of at least 8 characters', () => {
    expect(checkPasswordChange({ currentPassword: 'old-pass', newPassword: '1234567' }).ok).toBe(false);
  });

  it('needs a new password that is different from the current one', () => {
    expect(checkPasswordChange({ currentPassword: 'same-pass', newPassword: 'same-pass' }).ok).toBe(false);
  });

  it('rejects objects instead of text', () => {
    expect(checkPasswordChange({ currentPassword: { $ne: null }, newPassword: 'new-pass1' }).ok).toBe(false);
  });
});

describe('normalizeInviteCode', () => {
  it('accepts 8 letters and numbers and returns them in capitals', () => {
    expect(normalizeInviteCode('a3bf92c1')).toBe('A3BF92C1');
    expect(normalizeInviteCode(' A3BF92C1 ')).toBe('A3BF92C1');
  });

  it('rejects codes of the wrong length or with other characters', () => {
    expect(normalizeInviteCode('A3BF92C')).toBeNull();
    expect(normalizeInviteCode('A3BF92C12')).toBeNull();
    expect(normalizeInviteCode('A3BF-2C1')).toBeNull();
    expect(normalizeInviteCode({ $gt: '' })).toBeNull();
  });
});
