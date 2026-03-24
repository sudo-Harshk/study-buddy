import request from 'supertest';
import { app } from '../server';
import { expectLoginResponseShape, expectRegisterResponseShape, expectAuthMeResponseShape, expectErrorShape } from './testContracts';

describe('Auth Routes', () => {

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
        });
      expect(res.statusCode).toEqual(201);
      expectRegisterResponseShape(res.body);
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.user.profile.avatarUrl).toBeNull();
      expect(res.body.user.profile.gender).toBeNull();
    });

    it('should register a new user with study habits', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          email: 'habits@example.com',
          password: 'password123',
          firstName: 'Habit',
          lastName: 'User',
          major: 'Computer Science',
          studyHabits: 'Pomodoro, Flashcards',
          avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Habit-User',
          gender: 'FEMALE',
        });
      expect(res.statusCode).toEqual(201);
      expectRegisterResponseShape(res.body);
      expect(res.body.user.profile.major).toBe('Computer Science');
      expect(res.body.user.profile.studyHabits).toBe('Pomodoro, Flashcards');
      expect(res.body.user.profile.avatarUrl).toBe('https://api.dicebear.com/7.x/initials/svg?seed=Habit-User');
      expect(res.body.user.profile.gender).toBe('FEMALE');
    });

    it('should return 400 for invalid register body (missing email)', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ password: 'password123', firstName: 'T', lastName: 'U' });
      expect(res.statusCode).toEqual(400);
      expectErrorShape(res.body);
    });

    it('should return 400 for invalid avatarUrl in register body', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          email: 'badavatar@example.com',
          password: 'password123',
          firstName: 'Bad',
          lastName: 'Avatar',
          avatarUrl: 'not-a-url',
        });
      expect(res.statusCode).toEqual(400);
      expectErrorShape(res.body);
    });

    it('should return 400 for oversized avatarUrl in register body', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          email: 'bigavatar@example.com',
          password: 'password123',
          firstName: 'Big',
          lastName: 'Avatar',
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${'a'.repeat(600)}`,
        });
      expect(res.statusCode).toEqual(400);
      expectErrorShape(res.body);
    });

    it('should return 400 for invalid gender in register body', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          email: 'badgender@example.com',
          password: 'password123',
          firstName: 'Bad',
          lastName: 'Gender',
          gender: 'UNKNOWN',
        });
      expect(res.statusCode).toEqual(400);
      expectErrorShape(res.body);
    });

    it('should not register a user with an existing email', async () => {
        await request(app)
            .post('/auth/register')
            .send({
                email: 'test@example.com',
                password: 'password123',
                firstName: 'Test',
                lastName: 'User',
            });
        const res = await request(app)
            .post('/auth/register')
            .send({
            email: 'test@example.com',
            password: 'password123',
            firstName: 'Test',
            lastName: 'User',
            });
        expect(res.statusCode).toEqual(409);
        expect(res.body).toHaveProperty('error', 'Resource already exists');
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
        // Create a user to login with
        await request(app)
            .post('/auth/register')
            .send({
                email: 'test@example.com',
                password: 'password123',
                firstName: 'Test',
                lastName: 'User',
            });
    });

    it('should login an existing user successfully', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });
      expect(res.statusCode).toEqual(200);
      expectLoginResponseShape(res.body);
    });

    it('should return 400 for invalid login body (missing email)', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ password: 'password123' });
      expect(res.statusCode).toEqual(400);
      expectErrorShape(res.body);
    });

    it('should not login with a wrong password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should not login a non-existent user', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'nouser@example.com',
          password: 'password123',
        });
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });
  });
  describe('GET /me', () => {
    let token: string;
    beforeEach(async () => {
        await request(app)
            .post('/auth/register')
            .send({
                email: 'test@example.com',
                password: 'password123',
                firstName: 'Test',
                lastName: 'User',
            });
        const res = await request(app)
            .post('/auth/login')
            .send({
                email: 'test@example.com',
                password: 'password123',
            });
        token = res.body.accessToken;
    });

    it('should get the current user with a valid token', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expectAuthMeResponseShape(res.body);
      expect(res.body.user.email).toBe('test@example.com');
    });

    it('should not get the current user without a token', async () => {
        const res = await request(app).get('/auth/me');
        expect(res.statusCode).toEqual(401);
    });

    it('should not get the current user with an invalid token', async () => {
        const res = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalidtoken');
        expect(res.statusCode).toEqual(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return new tokens with valid refresh token', async () => {
      await request(app)
        .post('/auth/register')
        .send({ email: 'refresh@example.com', password: 'password123', firstName: 'R', lastName: 'U' });
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'refresh@example.com', password: 'password123' });
      const { refreshToken } = loginRes.body;
      const res = await request(app).post('/auth/refresh').send({ refreshToken });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe('refresh@example.com');
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app).post('/auth/refresh').send({ refreshToken: 'invalid' });
      expect(res.statusCode).toEqual(401);
      expectErrorShape(res.body);
    });

    it('should return 400 when refresh token is missing in body', async () => {
      const res = await request(app).post('/auth/refresh').send({});
      expect(res.statusCode).toEqual(400);
      expectErrorShape(res.body);
    });
  });

  describe('POST /auth/logout', () => {
    it('should return 204 with or without body', async () => {
      const res = await request(app).post('/auth/logout').send({});
      expect(res.statusCode).toEqual(204);
    });
  });

  describe('POST /auth/logout-all', () => {
    let token: string;
    beforeEach(async () => {
      await request(app)
        .post('/auth/register')
        .send({ email: 'logoutall@example.com', password: 'password123', firstName: 'L', lastName: 'A' });
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'logoutall@example.com', password: 'password123' });
      token = res.body.accessToken;
    });

    it('should return 204 when authenticated', async () => {
      const res = await request(app)
        .post('/auth/logout-all')
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toEqual(204);
    });

    it('should return 401 without a token', async () => {
      const res = await request(app).post('/auth/logout-all');
      expect(res.statusCode).toEqual(401);
    });
  });

  describe('Refresh token rotation', () => {
    it('should reject an old refresh token after rotation', async () => {
      await request(app)
        .post('/auth/register')
        .send({ email: 'rotation@example.com', password: 'password123', firstName: 'R', lastName: 'T' });
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'rotation@example.com', password: 'password123' });
      const { refreshToken: originalToken } = loginRes.body;

      // First rotation: consume the original token and get a new one
      const rotateRes = await request(app).post('/auth/refresh').send({ refreshToken: originalToken });
      expect(rotateRes.statusCode).toEqual(200);

      // Attempting to reuse the original (now revoked) token should fail
      const reuseRes = await request(app).post('/auth/refresh').send({ refreshToken: originalToken });
      expect(reuseRes.statusCode).toEqual(401);
      expectErrorShape(reuseRes.body);
    });
  });
});
