const { setIntervalSec, getIntervalSec } = require('../services/pingService');

describe('pingService', () => {
  test('setIntervalSec deve atualizar corretamente o intervalo em segundos', () => {
    expect(setIntervalSec(10)).toBe(true);
    expect(getIntervalSec()).toBe(10);
  });

  test('setIntervalSec deve rejeitar valores fora dos limites (1-300s)', () => {
    expect(setIntervalSec(0)).toBe(false);
    expect(setIntervalSec(500)).toBe(false);
  });
});
