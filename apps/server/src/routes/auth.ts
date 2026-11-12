import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import * as argon2 from 'argon2';
import { isKnownTownId, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from '@botifarra/shared';
import type {
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
} from '@botifarra/shared';

export const authRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/auth/register
  app.post<{ Body: RegisterRequest }>('/register', async (request, reply) => {
    const { username, password, townId } = request.body;

    if (
      typeof username !== 'string' ||
      username.length < USERNAME_MIN_LENGTH ||
      username.length > USERNAME_MAX_LENGTH
    ) {
      return reply.status(400).send({ error: 'Username must be between 3 and 20 characters' });
    }
    if (!password || password.length < 6) {
      return reply.status(400).send({ error: 'Password must be at least 6 characters' });
    }
    if (!isKnownTownId(townId)) {
      return reply.status(400).send({ error: 'Town must be selected from the list' });
    }

    const existing = await app.prisma.user.findUnique({ where: { username } });
    if (existing) {
      return reply.status(409).send({ error: 'Username already taken' });
    }

    const passwordHash = await argon2.hash(password);

    const user = await app.prisma.user.create({
      data: {
        username,
        passwordHash,
        townId,
        stats: { create: {} },
      },
    });

    const response: RegisterResponse = {
      userId: user.id,
      username: user.username,
    };
    return reply.status(201).send(response);
  });

  // POST /api/auth/login
  app.post<{ Body: LoginRequest }>('/login', async (request, reply) => {
    const { username, password } = request.body;

    const user = await app.prisma.user.findUnique({ where: { username } });
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const accessToken = app.jwt.sign(
      { sub: user.id, username: user.username },
      { expiresIn: '7d' },
    );

    const response: LoginResponse = {
      accessToken,
      userId: user.id,
      username: user.username,
    };
    return reply.send(response);
  });
};
