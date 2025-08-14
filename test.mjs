import * as chai from 'chai';
import chaiHttp from 'chai-http';

import app from './backend/api/server.js';
import pool from './backend/db.js';

const { expect } = chai;
chai.use(chaiHttp);

describe('API Tests', () => {
  let token;

  before(async () => {
    const res = await chai.request(app)
      .post('/api/auth/login')
      .send({ studentId: 'TEST123' });

    token = res.body.token;
  });

  it('should record mood', async () => {
    const res = await chai.request(app)
      .post('/api/mood')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId: 'TEST123', mood: 4 });

    expect(res).to.have.status(201);
  });

  it('should book appointment', async () => {
    const res = await chai.request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        studentId: 'STUD123',
        counselorId: 1,
        datetime: new Date(Date.now() + 86400000).toISOString()
      });

    expect(res).to.have.status(201);
    expect(res.body).to.have.property('id');
  });
});
