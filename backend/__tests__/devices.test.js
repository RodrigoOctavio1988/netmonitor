const request = require('supertest');
process.env.NODE_ENV = 'test';
const { app } = require('../server');

describe('API de Dispositivos e Health (/api)', () => {
  test('GET /api/health deve retornar status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBe('3.0.0');
  });

  test('GET /api/devices deve retornar array de dispositivos', async () => {
    const res = await request(app).get('/api/devices');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/devices deve validar IP obrigatorio', async () => {
    const res = await request(app).post('/api/devices').send({ name: 'Teste Sem IP' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
