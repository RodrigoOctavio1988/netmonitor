const { ipToInt, intToIp, sanitizeString } = require('../utils/ipUtils');
const { parseCIDR, generateIpRange } = require('../services/scannerService');

describe('ipUtils e scannerService', () => {
  test('ipToInt deve converter IPv4 para número de 32 bits', () => {
    expect(ipToInt('192.168.1.1')).toBe(3232235777);
    expect(ipToInt('127.0.0.1')).toBe(2130706433);
    expect(ipToInt('invalido')).toBe(0);
  });

  test('intToIp deve converter número de 32 bits para string IPv4', () => {
    expect(intToIp(3232235777)).toBe('192.168.1.1');
    expect(intToIp(2130706433)).toBe('127.0.0.1');
  });

  test('parseCIDR deve calcular corretamente o range do bloco CIDR', () => {
    const parsed = parseCIDR('192.168.1.0/24');
    expect(parsed).not.toBeNull();
    expect(intToIp(parsed.startInt)).toBe('192.168.1.1');
    expect(intToIp(parsed.endInt)).toBe('192.168.1.254');
  });

  test('generateIpRange deve gerar a lista correta de IPs', () => {
    const ips = generateIpRange('192.168.1.1', '192.168.1.3', null);
    expect(ips).toEqual(['192.168.1.1', '192.168.1.2', '192.168.1.3']);
  });

  test('sanitizeString deve remover tags HTML e limitar comprimento', () => {
    const input = '<script>alert("xss")</script>Servidor DB';
    expect(sanitizeString(input)).toBe('alert("xss")Servidor DB');
  });
});
