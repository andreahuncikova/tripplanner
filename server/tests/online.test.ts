import { describe, it, expect } from 'vitest';
import { toOnline } from '../src/socket/helpers';

const mia  = { userId: 'u1', username: 'Mia', color: '#E4572E', code: 'A3BF92C1' };
const theo = { userId: 'u2', username: 'Theo', color: '#2E86AB', code: 'A3BF92C1' };

describe('toOnline', () => {
  it('sends only the name and colour of each person', () => {
    expect(toOnline([mia, theo])).toEqual([
      { username: 'Mia', color: '#E4572E' },
      { username: 'Theo', color: '#2E86AB' },
    ]);
  });

  it('lists someone with the trip open in two tabs once', () => {
    expect(toOnline([mia, theo, { ...mia }])).toHaveLength(2);
  });
});
