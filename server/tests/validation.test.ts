import { describe, it, expect } from 'vitest';
import { checkAreaName } from '../src/validation';
import { MESSAGE_MAX, checkLogin, checkMessage, checkConfirmDates, checkDestinationName, checkNewTrip, checkPasswordChange, checkTripChanges, checkTripLength, cleanUnavailableDays, checkRegister, normalizeInviteCode } from '../src/validation';

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

describe('checkMessage', () => {
  it('accepts a message and trims it', () => {
    expect(checkMessage('  See you in Lisbon!  ')).toEqual({ ok: true, value: 'See you in Lisbon!' });
  });

  it('rejects empty messages and anything that is not text', () => {
    expect(checkMessage('   ').ok).toBe(false);
    expect(checkMessage(undefined).ok).toBe(false);
    expect(checkMessage({ $gt: '' }).ok).toBe(false);
  });

  it('accepts MESSAGE_MAX characters but not one more', () => {
    expect(checkMessage('a'.repeat(MESSAGE_MAX)).ok).toBe(true);
    expect(checkMessage('a'.repeat(MESSAGE_MAX + 1)).ok).toBe(false);
  });
});

describe('checkNewTrip', () => {
  const today = '2026-11-10';
  const base = { name: 'Bali with friends', currency: 'eur' };

  it('accepts known dates', () => {
    const r = checkNewTrip({ ...base, destination: ' Bali ', dates: { mode: 'known', start: '2027-03-12', end: '2027-03-22' } }, today);
    expect(r).toEqual({ ok: true, value: {
      name: 'Bali with friends', destination: 'Bali', currency: 'EUR',
      knownDates: { start: '2027-03-12', end: '2027-03-22' }, window: null,
    } });
  });

  it('turns the chosen months into a window from the first to the last day', () => {
    const r = checkNewTrip({ ...base, dates: { mode: 'find', fromMonth: '2027-02', toMonth: '2027-04' } }, today);
    expect(r.ok && r.value.window).toEqual({ start: '2027-02-01', end: '2027-04-30' });
    expect(r.ok && r.value.destination).toBeNull();
  });

  it('knows that February 2028 has 29 days', () => {
    const r = checkNewTrip({ ...base, dates: { mode: 'find', fromMonth: '2028-02', toMonth: '2028-02' } }, today);
    expect(r.ok && r.value.window?.end).toBe('2028-02-29');
  });

  it('allows no dates at all, like the old app', () => {
    const r = checkNewTrip({ name: 'Trip' }, today);
    expect(r.ok && r.value).toMatchObject({ knownDates: null, window: null, currency: 'EUR' });
  });

  it('needs a name', () => {
    expect(checkNewTrip({ ...base, name: '  ' }, today).ok).toBe(false);
    expect(checkNewTrip({ ...base, name: 'x'.repeat(61) }, today).ok).toBe(false);
  });

  it('rejects wrong or impossible dates', () => {
    const known = (start: string, end: string) => checkNewTrip({ ...base, dates: { mode: 'known', start, end } }, today).ok;
    expect(known('2027-02-30', '2027-03-02')).toBe(false);     // there is no 30 February
    expect(known('2027-03-22', '2027-03-12')).toBe(false);     // end before start
    expect(known('2026-11-01', '2026-11-05')).toBe(false);     // in the past
    expect(known('2027-01-01', '2027-04-30')).toBe(false);     // longer than 90 days
    expect(known('2026-11-09', '2026-11-12')).toBe(true);      // yesterday is fine (time zones)
  });

  it('rejects wrong months', () => {
    const find = (fromMonth: string, toMonth: string) => checkNewTrip({ ...base, dates: { mode: 'find', fromMonth, toMonth } }, today).ok;
    expect(find('2027-05', '2027-03')).toBe(false);            // last before first
    expect(find('2026-10', '2026-12')).toBe(false);            // starts in the past
    expect(find('2027-01', '2028-01')).toBe(false);            // 13 months
    expect(find('2027-13', '2027-13')).toBe(false);            // no month 13
    expect(find('2026-11', '2026-11')).toBe(true);             // this month is fine
  });

  it('rejects a currency that is not three letters and objects instead of text', () => {
    expect(checkNewTrip({ ...base, currency: 'EURO' }, today).ok).toBe(false);
    expect(checkNewTrip({ ...base, name: { $gt: '' } }, today).ok).toBe(false);
  });
});

describe('checkTripChanges', () => {
  const today = '2026-11-10';

  it('changes only what is sent', () => {
    expect(checkTripChanges({ name: ' Bali 2027 ' }, today)).toEqual({ ok: true, value: { name: 'Bali 2027' } });
    expect(checkTripChanges({ currency: 'dkk' }, today)).toEqual({ ok: true, value: { currency: 'DKK' } });
    expect(checkTripChanges({ dates: { start: '2027-03-12', end: '2027-03-22' } }, today))
      .toEqual({ ok: true, value: { dates: { start: '2027-03-12', end: '2027-03-22' } } });
  });

  it('rejects an empty change', () => {
    expect(checkTripChanges({}, today).ok).toBe(false);
    expect(checkTripChanges(null, today).ok).toBe(false);
  });

  it('uses the same rules as a new trip', () => {
    expect(checkTripChanges({ name: '  ' }, today).ok).toBe(false);
    expect(checkTripChanges({ name: 'x'.repeat(61) }, today).ok).toBe(false);
    expect(checkTripChanges({ currency: 'EURO' }, today).ok).toBe(false);
    expect(checkTripChanges({ dates: { start: '2027-02-30', end: '2027-03-02' } }, today).ok).toBe(false);
    expect(checkTripChanges({ dates: { start: '2026-11-01', end: '2026-11-05' } }, today).ok).toBe(false);
    expect(checkTripChanges({ name: { $gt: '' } }, today).ok).toBe(false);
  });
});

describe('checkAreaName', () => {
  it('keeps a normal name and tidies the spaces', () => {
    expect(checkAreaName('  Nusa   Penida ')).toEqual({ ok: true, value: 'Nusa Penida' });
  });
  it('refuses empty names, names over 40 characters and anything that is not text', () => {
    expect(checkAreaName('   ').ok).toBe(false);
    expect(checkAreaName('x'.repeat(41)).ok).toBe(false);
    expect(checkAreaName({ $gt: '' }).ok).toBe(false);
    expect(checkAreaName(undefined).ok).toBe(false);
  });
});

describe('planning steps', () => {
  it('checks a suggested destination', () => {
    expect(checkDestinationName('  Bali, Indonesia ')).toEqual({ ok: true, value: 'Bali, Indonesia' });
    expect(checkDestinationName(' ').ok).toBe(false);
    expect(checkDestinationName('x'.repeat(61)).ok).toBe(false);
    expect(checkDestinationName({ $ne: '' }).ok).toBe(false);
  });

  it('keeps only real days inside the trip months, each once and in order', () => {
    const days = cleanUnavailableDays(['2027-03-05', '2027-03-04', '2027-03-05', '2027-02-30', '2027-04-01', 'soon', 5, { $gt: '' }], '2027-03-01', '2027-03-31');
    expect(days).toEqual(['2027-03-04', '2027-03-05']);
    expect(cleanUnavailableDays('2027-03-04', '2027-03-01', '2027-03-31')).toEqual([]);
  });

  it('accepts a trip length from 1 to 90 whole days', () => {
    expect(checkTripLength(10)).toEqual({ ok: true, value: 10 });
    expect(checkTripLength('7')).toEqual({ ok: true, value: 7 });
    for (const bad of [0, 91, 2.5, 'ten', null]) expect(checkTripLength(bad).ok).toBe(false);
  });

  it('confirms only dates that fit inside the free window', () => {
    const range = { start: '2027-03-10', end: '2027-03-24' };   // 15 free days
    expect(checkConfirmDates(range, '2027-03-12', 10)).toEqual({ ok: true, value: { start: '2027-03-12', days: 10 } });
    expect(checkConfirmDates(range, '2027-03-15', 10)).toEqual({ ok: true, value: { start: '2027-03-15', days: 10 } });  // last day 24 March
    expect(checkConfirmDates(range, '2027-03-16', 10).ok).toBe(false);   // would end on 25 March
    expect(checkConfirmDates(range, '2027-03-09', 10).ok).toBe(false);   // starts before the window
    expect(checkConfirmDates(range, 'tomorrow', 10).ok).toBe(false);
  });

  it('without a start or a length, takes the whole window', () => {
    expect(checkConfirmDates({ start: '2027-03-10', end: '2027-03-24' }, undefined, null))
      .toEqual({ ok: true, value: { start: '2027-03-10', days: 15 } });
  });
});
