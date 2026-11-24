import { describe, expect, it } from 'vitest';
import { paypalLink, settleUp } from '../../shared/money';

const rates = { EUR: 1, DKK: 7.46, IDR: 17000 };
const e = (paidByUserId: string, amount: number, splitAmongUserIds: string[], currency = 'EUR', shares?: { userId: string; amount: number }[]) =>
  ({ paidByUserId, amount, currency, splitAmongUserIds, shares });

const pay = (fromUserId: string, toUserId: string, amount: number, currency = 'EUR') => ({ fromUserId, toUserId, amount, currency });

describe('settleUp with payments', () => {
  it('leaves nothing to pay after the whole debt is paid', () => {
    expect(settleUp([e('mia', 90, ['mia', 'theo'])], 'EUR', rates, [pay('theo', 'mia', 45)])).toEqual([]);
  });

  it('leaves the rest after a part is paid', () => {
    expect(settleUp([e('mia', 90, ['mia', 'theo'])], 'EUR', rates, [pay('theo', 'mia', 20)]))
      .toEqual([{ from: 'theo', to: 'mia', amount: 25 }]);
  });

  it('counts a payment made in the old currency of the group in the new one', () => {
    // 74.60 DKK is 10 EUR
    expect(settleUp([e('mia', 90, ['mia', 'theo'])], 'EUR', rates, [pay('theo', 'mia', 74.6, 'DKK')]))
      .toEqual([{ from: 'theo', to: 'mia', amount: 35 }]);
  });
});

describe('settleUp', () => {
  it('pays back the one who paid', () => {
    expect(settleUp([e('mia', 90, ['mia', 'theo'])], 'EUR', rates)).toEqual([{ from: 'theo', to: 'mia', amount: 45 }]);
  });

  it('nets out what people paid for each other', () => {
    // Mia paid 90 for both, Theo paid 30 for both: Theo owes 45 - 15 = 30
    expect(settleUp([e('mia', 90, ['mia', 'theo']), e('theo', 30, ['mia', 'theo'])], 'EUR', rates))
      .toEqual([{ from: 'theo', to: 'mia', amount: 30 }]);
  });

  it('uses as few payments as the simple method gives, the biggest debts first', () => {
    // Mia paid 120 for four and Leo 40 for four, so each part is 40 in all: Theo and Sara each owe Mia 40,
    // and Leo is even. Two payments, nobody pays Leo and Leo pays nobody.
    const t = settleUp([e('mia', 120, ['mia', 'theo', 'sara', 'leo']), e('leo', 40, ['mia', 'theo', 'sara', 'leo'])], 'EUR', rates);
    expect(t).toEqual([{ from: 'theo', to: 'mia', amount: 40 }, { from: 'sara', to: 'mia', amount: 40 }]);
  });

  it('follows exact amounts and loses no cent to rounding', () => {
    const t = settleUp([e('mia', 10, ['mia', 'theo', 'sara'])], 'EUR', rates);
    expect(t.reduce((s, x) => s + x.amount, 0)).toBeCloseTo(6.66, 2);
    expect(settleUp([e('mia', 30, ['mia', 'theo'], 'EUR', [{ userId: 'mia', amount: 10 }, { userId: 'theo', amount: 20 }])], 'EUR', rates))
      .toEqual([{ from: 'theo', to: 'mia', amount: 20 }]);
  });

  it('converts other currencies to the group currency and leaves out expenses without a rate', () => {
    expect(settleUp([e('mia', 74.6, ['mia', 'theo'], 'DKK')], 'EUR', rates)).toEqual([{ from: 'theo', to: 'mia', amount: 5 }]);
    expect(settleUp([e('mia', 100, ['mia', 'theo'], 'XYZ')], 'EUR', rates)).toEqual([]);
  });

  it('is empty when everyone is even', () => {
    expect(settleUp([e('mia', 20, ['mia', 'theo']), e('theo', 20, ['mia', 'theo'])], 'EUR', rates)).toEqual([]);
  });
});

describe('paypalLink', () => {
  it('fills in the amount and the currency PayPal takes', () => {
    expect(paypalLink('miakarlsen', 45.2, 'EUR')).toBe('https://paypal.me/miakarlsen/45.20EUR');
    expect(paypalLink('miakarlsen', 300, 'DKK')).toBe('https://paypal.me/miakarlsen/300.00DKK');
    expect(paypalLink('miakarlsen', 1500, 'JPY')).toBe('https://paypal.me/miakarlsen/1500JPY');
  });

  it('leaves the amount out for a currency PayPal does not take', () => {
    expect(paypalLink('miakarlsen', 50000, 'IDR')).toBe('https://paypal.me/miakarlsen');
  });
});
