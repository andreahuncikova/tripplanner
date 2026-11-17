import { describe, it, expect } from 'vitest';
import { checkExpense } from '../src/validation';
import { mayChangeExpense } from '../src/socket/helpers';
import { expenseShares, splitEqually } from '../../shared/money';

const members = ['mia', 'theo', 'sara'];
const base = { description: ' Scooter rental ', amount: 60, currency: 'EUR', paidByUserId: 'mia' };

describe('splitEqually', () => {
  it('gives the cents that do not divide evenly to the first people, so the parts add up', () => {
    expect(splitEqually(10, 3, 'EUR')).toEqual([3.34, 3.33, 3.33]);
    expect(splitEqually(100, 3, 'JPY')).toEqual([34, 33, 33]);   // yen have no cents
    expect(splitEqually(10, 0, 'EUR')).toEqual([]);
  });
});

describe('expenseShares', () => {
  it('splits equally, or uses the exact amounts when they are set', () => {
    expect(expenseShares({ amount: 10, currency: 'EUR', splitAmongUserIds: ['a', 'b'] }))
      .toEqual([{ userId: 'a', amount: 5 }, { userId: 'b', amount: 5 }]);
    const shares = [{ userId: 'a', amount: 7 }, { userId: 'b', amount: 3 }];
    expect(expenseShares({ amount: 10, currency: 'EUR', splitAmongUserIds: ['a', 'b'], shares })).toEqual(shares);
  });
});

describe('checkExpense', () => {
  it('splits between the whole group when nobody is chosen', () => {
    const r = checkExpense(base, members, 'EUR');
    expect(r).toEqual({ ok: true, value: { description: 'Scooter rental', amount: 60, currency: 'EUR', paidByUserId: 'mia', splitAmongUserIds: members } });
  });

  it('uses the group currency when none is sent', () => {
    const r = checkExpense({ ...base, currency: '' }, members, 'DKK');
    expect(r.ok && r.value.currency).toBe('DKK');
  });

  it('accepts exact amounts that add up to the whole, and leaves out people with 0', () => {
    const r = checkExpense({ ...base, amount: 0.3, shares: [{ userId: 'mia', amount: 0.1 }, { userId: 'theo', amount: 0.2 }, { userId: 'sara', amount: 0 }] }, members, 'EUR');
    expect(r).toMatchObject({ ok: true, value: { splitAmongUserIds: ['mia', 'theo'], shares: [{ userId: 'mia', amount: 0.1 }, { userId: 'theo', amount: 0.2 }] } });
  });

  it('refuses exact amounts that do not add up', () => {
    const r = checkExpense({ ...base, shares: [{ userId: 'mia', amount: 30 }, { userId: 'theo', amount: 20 }] }, members, 'EUR');
    expect(r).toEqual({ ok: false, error: 'The amounts add up to 50 EUR, not 60 EUR' });
  });

  it('refuses people who are not in the trip, twice, or below zero', () => {
    expect(checkExpense({ ...base, shares: [{ userId: 'eve', amount: 60 }] }, members, 'EUR').ok).toBe(false);
    expect(checkExpense({ ...base, shares: [{ userId: 'mia', amount: 30 }, { userId: 'mia', amount: 30 }] }, members, 'EUR').ok).toBe(false);
    expect(checkExpense({ ...base, shares: [{ userId: 'mia', amount: 70 }, { userId: 'theo', amount: -10 }] }, members, 'EUR').ok).toBe(false);
    expect(checkExpense({ ...base, splitAmongUserIds: ['mia', 'eve'] }, members, 'EUR').ok).toBe(false);
    expect(checkExpense({ ...base, paidByUserId: 'eve' }, members, 'EUR').ok).toBe(false);
  });

  it('refuses an empty description, a missing amount and objects instead of text', () => {
    expect(checkExpense({ ...base, description: ' ' }, members, 'EUR').ok).toBe(false);
    for (const amount of [0, -5, 'a lot', null]) expect(checkExpense({ ...base, amount }, members, 'EUR').ok).toBe(false);
    expect(checkExpense({ ...base, description: { $ne: '' } }, members, 'EUR').ok).toBe(false);
  });

  it('rounds to the decimals of the currency', () => {
    expect((r => r.ok && r.value.amount)(checkExpense({ ...base, amount: 1500.4, currency: 'JPY' }, members, 'EUR'))).toBe(1500);
    expect((r => r.ok && r.value.amount)(checkExpense({ ...base, amount: 12.345 }, members, 'EUR'))).toBe(12.35);
  });
});

describe('mayChangeExpense', () => {
  const g = { adminUserId: 'mia', members: [{ userId: 'mia' }, { userId: 'theo' }] } as never;

  it('lets only the person who added the expense change it, not the organiser', () => {
    expect(mayChangeExpense(g, 'theo', 'theo')).toBe(true);
    expect(mayChangeExpense(g, 'theo', 'mia')).toBe(false);   // the old app let the admin do this
    expect(mayChangeExpense(g, 'mia', 'theo')).toBe(false);
  });

  it('lets the organiser change it when its author has left the trip', () => {
    expect(mayChangeExpense(g, 'sara', 'mia')).toBe(true);
    expect(mayChangeExpense(g, 'sara', 'theo')).toBe(false);
  });
});
