import { describe, it, expect } from 'vitest';
import { checkActivity, checkAreaName, checkEmailChange, checkProfile, checkStayDetails, checkStayNights, paypalMeName, checkPayment, mobilePayNumber } from '../src/validation';
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

describe('checkStayNights', () => {
  const trip = { start: '2027-06-10', end: '2027-06-20' };

  it('accepts nights inside the trip, check-out on its last day', () => {
    expect(checkStayNights({ checkIn: '2027-06-17', checkOut: '2027-06-20' }, trip))
      .toEqual({ ok: true, value: { checkIn: '2027-06-17', checkOut: '2027-06-20' } });
  });

  it('clears the nights with null', () => {
    expect(checkStayNights(null, trip)).toEqual({ ok: true, value: null });
  });

  it('needs at least one night', () => {
    expect(checkStayNights({ checkIn: '2027-06-12', checkOut: '2027-06-12' }, trip).ok).toBe(false);
    expect(checkStayNights({ checkIn: '2027-06-13', checkOut: '2027-06-12' }, trip).ok).toBe(false);
  });

  it('refuses nights outside the trip dates', () => {
    expect(checkStayNights({ checkIn: '2027-06-09', checkOut: '2027-06-12' }, trip).ok).toBe(false);
    expect(checkStayNights({ checkIn: '2027-06-18', checkOut: '2027-06-21' }, trip).ok).toBe(false);
  });

  it('allows any nights while the trip has no dates yet', () => {
    expect(checkStayNights({ checkIn: '2027-08-01', checkOut: '2027-08-05' }, null).ok).toBe(true);
  });

  it('refuses days that do not exist and anything that is not a day', () => {
    expect(checkStayNights({ checkIn: '2027-02-30', checkOut: '2027-03-02' }, null).ok).toBe(false);
    expect(checkStayNights({ checkIn: { $gt: '' }, checkOut: '2027-03-02' }, null).ok).toBe(false);
    expect(checkStayNights('2027-03-01', null).ok).toBe(false);
  });
});

describe('checkStayDetails', () => {
  const photo = '/api/files/' + 'a1'.repeat(24);

  it('takes the form, trims it and rounds the price to cents', () => {
    expect(checkStayDetails({ title: '  Casa  Azul ', price: { amount: 89.456, currency: 'eur' }, location: 'Lisbon, Portugal', image: photo }))
      .toEqual({ ok: true, value: { title: 'Casa Azul', price: { amount: 89.46, currency: 'EUR' }, location: 'Lisbon, Portugal', image: photo } });
  });

  it('lets fields be empty, and keeps or removes the photo', () => {
    expect(checkStayDetails({ title: '', price: null, location: ' ', image: 'keep' }))
      .toEqual({ ok: true, value: { title: null, price: null, location: null, image: 'keep' } });
    expect(checkStayDetails({ title: 'A', price: null, location: '', image: null }).ok).toBe(true);
  });

  it('refuses a price of zero or below, and a missing currency', () => {
    expect(checkStayDetails({ title: 'A', price: { amount: 0, currency: 'EUR' }, location: '', image: 'keep' }).ok).toBe(false);
    expect(checkStayDetails({ title: 'A', price: { amount: '50', currency: 'EUR' }, location: '', image: 'keep' }).ok).toBe(false);
    expect(checkStayDetails({ title: 'A', price: { amount: 50, currency: '' }, location: '', image: 'keep' }).ok).toBe(false);
  });

  it('refuses a photo that is not one of our own files, and text that is too long', () => {
    expect(checkStayDetails({ title: 'A', price: null, location: '', image: 'https://evil.example/x.jpg' }).ok).toBe(false);
    expect(checkStayDetails({ title: 'A', price: null, location: '', image: '/api/files/../../etc' }).ok).toBe(false);
    expect(checkStayDetails({ title: 'x'.repeat(121), price: null, location: '', image: 'keep' }).ok).toBe(false);
    expect(checkStayDetails({ title: { $gt: '' }, price: null, location: '', image: 'keep' }))
      .toEqual({ ok: true, value: { title: null, price: null, location: null, image: 'keep' } });
  });
});

describe('checkActivity', () => {
  const trip = { start: '2027-03-12', end: '2027-03-17' };

  it('takes an activity with a day, time, place and note', () => {
    expect(checkActivity({ text: ' Dinner  in Ubud ', calDate: '2027-03-12', calTime: '19:30', place: 'Locavore', note: 'Book a table' }, trip))
      .toEqual({ ok: true, value: { text: 'Dinner in Ubud', calDate: '2027-03-12', calTime: '19:30', place: 'Locavore', note: 'Book a table' } });
  });

  it('keeps an activity without a day as an idea, and drops its time', () => {
    expect(checkActivity({ text: 'Rafting', calTime: '10:00' }, trip))
      .toEqual({ ok: true, value: { text: 'Rafting', calDate: null, calTime: null, place: null, note: null } });
  });

  it('needs a text, a day of the trip and a real time', () => {
    expect(checkActivity({ text: '  ' }, trip).ok).toBe(false);
    expect(checkActivity({ text: 'A', calDate: '2027-03-18' }, trip)).toEqual({ ok: false, error: 'Please choose a day of the trip' });
    expect(checkActivity({ text: 'A', calDate: '2027-02-30' }, null).ok).toBe(false);
    expect(checkActivity({ text: 'A', calDate: '2027-03-12', calTime: '24:00' }, trip).ok).toBe(false);
    expect(checkActivity({ text: 'A', calDate: '2027-03-12', calTime: '9:5' }, trip).ok).toBe(false);
  });

  it('refuses text that is too long and objects instead of text', () => {
    expect(checkActivity({ text: 'x'.repeat(81) }, trip).ok).toBe(false);
    expect(checkActivity({ text: 'A', note: 'x'.repeat(501) }, trip).ok).toBe(false);
    expect(checkActivity({ text: { $gt: '' } }, trip).ok).toBe(false);
  });
});

describe('checkProfile', () => {
  const photo = '/api/files/' + 'a1'.repeat(24);

  it('takes a new name, trimmed, and a photo from the file storage', () => {
    expect(checkProfile({ username: '  Mia K ' })).toEqual({ ok: true, value: { username: 'Mia K' } });
    expect(checkProfile({ photo })).toEqual({ ok: true, value: { photoId: 'a1'.repeat(24) } });
    expect(checkProfile({ photo: null })).toEqual({ ok: true, value: { photoId: null } });
  });

  it('refuses an empty or too long name, a photo from somewhere else, and nothing at all', () => {
    expect(checkProfile({ username: '   ' }).ok).toBe(false);
    expect(checkProfile({ username: 'x'.repeat(31) }).ok).toBe(false);
    expect(checkProfile({ photo: 'https://evil.example/me.jpg' }).ok).toBe(false);
    expect(checkProfile({ photo: { $ne: null } }).ok).toBe(false);
    expect(checkProfile({})).toEqual({ ok: false, error: 'Nothing to change' });
  });
});

describe('checkEmailChange', () => {
  it('takes a new address in lower case with the password', () => {
    expect(checkEmailChange({ email: ' New@Example.com ', password: 'secret12' }, 'mia@example.com'))
      .toEqual({ ok: true, value: { email: 'new@example.com', password: 'secret12' } });
  });

  it('refuses the same address, a wrong shape, a missing password and objects', () => {
    expect(checkEmailChange({ email: 'MIA@example.com', password: 'x' }, 'mia@example.com')).toEqual({ ok: false, error: 'This is already your e-mail' });
    expect(checkEmailChange({ email: 'not-an-email', password: 'x' }, 'mia@example.com').ok).toBe(false);
    expect(checkEmailChange({ email: 'new@example.com' }, 'mia@example.com').ok).toBe(false);
    expect(checkEmailChange({ email: { $gt: '' }, password: 'x' }, 'mia@example.com').ok).toBe(false);
  });
});

describe('paypalMeName', () => {
  it('finds the name in what people paste', () => {
    for (const v of ['paypal.me/miakarlsen', 'https://www.paypal.me/miakarlsen', 'https://paypal.me/miakarlsen/20EUR',
      'https://www.paypal.com/paypalme/miakarlsen', '@miakarlsen', ' miakarlsen ']) expect(paypalMeName(v)).toBe('miakarlsen');
  });

  it('refuses other links, signs and too long names', () => {
    for (const v of ['https://evil.example/miakarlsen', 'mia karlsen', 'mia.karlsen', 'x'.repeat(21), '', { $ne: null }]) expect(paypalMeName(v)).toBeNull();
  });

  it('is saved, or removed with null, through the profile', () => {
    expect(checkProfile({ paypalMe: 'paypal.me/MiaK' })).toEqual({ ok: true, value: { paypalMe: 'MiaK' } });
    expect(checkProfile({ paypalMe: null })).toEqual({ ok: true, value: { paypalMe: null } });
    expect(checkProfile({ paypalMe: 'https://evil.example' }).ok).toBe(false);
  });
});

describe('checkPayment', () => {
  const members = ['mia', 'theo'];
  it('accepts a payment to someone else in the trip, rounded to the currency', () => {
    expect(checkPayment({ toUserId: 'mia', amount: 45.004 }, members, 'theo', 'EUR')).toEqual({ ok: true, value: { toUserId: 'mia', amount: 45 } });
  });

  it('refuses paying yourself, someone outside the trip, or no amount', () => {
    expect(checkPayment({ toUserId: 'theo', amount: 5 }, members, 'theo', 'EUR').ok).toBe(false);
    expect(checkPayment({ toUserId: 'eve', amount: 5 }, members, 'theo', 'EUR').ok).toBe(false);
    for (const amount of [0, -5, 'a lot', null]) expect(checkPayment({ toUserId: 'mia', amount }, members, 'theo', 'EUR').ok).toBe(false);
    expect(checkPayment({ toUserId: { $ne: '' }, amount: 5 }, members, 'theo', 'EUR').ok).toBe(false);
  });
});

describe('mobilePayNumber', () => {
  it('reads Danish and Finnish numbers as people write them', () => {
    expect(mobilePayNumber('12 34 56 78')).toBe('+4512345678');
    expect(mobilePayNumber('+45 12-34-56-78')).toBe('+4512345678');
    expect(mobilePayNumber('0045 12345678')).toBe('+4512345678');
    expect(mobilePayNumber('040 123 4567')).toBe('+358401234567');
    expect(mobilePayNumber('+358 40 123 4567')).toBe('+358401234567');
  });

  it('refuses what is not a number MobilePay uses', () => {
    for (const v of ['123', '1234567', '+44 7700 900123', 'abc', { $ne: '' }]) expect(mobilePayNumber(v)).toBeNull();
  });

  it('is part of the profile, and empty removes it', () => {
    expect(checkProfile({ mobilePay: '12345678' })).toEqual({ ok: true, value: { mobilePay: '+4512345678' } });
    expect(checkProfile({ mobilePay: '' })).toEqual({ ok: true, value: { mobilePay: null } });
    expect(checkProfile({ mobilePay: '123' }).ok).toBe(false);
  });
});
