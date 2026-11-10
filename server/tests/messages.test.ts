import { describe, it, expect } from 'vitest';
import { messagesToMove } from '../src/migrations/messages';
import { toChat } from '../src/messages';

describe('messagesToMove', () => {
  const createdAt = new Date('2026-10-01T10:00:00Z');
  const oldTrip = {
    _id: 'g1', createdAt,
    messages: [
      { username: 'System', text: 'Trip "Lisbon" created!', time: '10:00', system: true },
      { userId: 'u-mia', username: 'Mia', color: '#E8572A', text: 'Hi all', time: '10:05' },
      { username: 'Ben', text: '', time: '10:06' },   // empty, not moved
    ],
  };

  it('makes one document per message, linked to the trip', () => {
    const list = messagesToMove(oldTrip);
    expect(list).toHaveLength(2);
    expect(list.every(m => m.groupId === 'g1')).toBe(true);
    expect(list[0]).toMatchObject({ username: 'System', text: 'Trip "Lisbon" created!', system: true });
    expect(list[1]).toMatchObject({ userId: 'u-mia', username: 'Mia', color: '#E8572A', text: 'Hi all', time: '10:05', system: false });
  });

  it('keeps the order of the old array', () => {
    const [a, b] = messagesToMove(oldTrip);
    expect(a.createdAt.getTime()).toBe(createdAt.getTime());
    expect(b.createdAt.getTime()).toBeGreaterThan(a.createdAt.getTime());
  });

  it('moves nothing from a trip without messages', () => {
    expect(messagesToMove({ _id: 'g2' })).toEqual([]);
    expect(messagesToMove({ _id: 'g2', messages: [] })).toEqual([]);
  });
});

describe('toChat', () => {
  it('sends the client only the message fields, user id as text', () => {
    const fromDb = { _id: 'm1', groupId: 'g1', userId: { toString: () => 'u-mia' }, username: 'Mia', color: '#000',
      text: 'Hi', time: '9:30', system: false, createdAt: new Date() };
    expect(toChat(fromDb)).toEqual({ userId: 'u-mia', username: 'Mia', color: '#000', text: 'Hi', time: '9:30' });
  });

  it('marks system messages', () => {
    expect(toChat({ username: 'System', text: 'Mia joined the trip.', time: '9:31', system: true }))
      .toEqual({ username: 'System', text: 'Mia joined the trip.', time: '9:31', system: true });
  });
});
