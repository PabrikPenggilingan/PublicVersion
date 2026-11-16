const request = require('supertest');
const app = require('../src/app');

describe('Process (Milling) API - Integration Tests', () => {

  it('harus memastikan server siap menerima request /api/processes', async () => {
    // Karena rute processes dilindungi oleh JWT middleware (verifyToken),
    // tanpa token, sistem harus menolak dengan 401 atau 403.
    // Ini mengonfirmasi bahwa keamanan rute telah aktif.
    const res = await request(app).get('/api/processes');
    expect([401, 403]).toContain(res.statusCode);
  });

});
