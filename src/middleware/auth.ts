import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import { Env, UserPayload } from '../types';

export const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ message: 'Unauthenticated.' }, 401);
  }

  const token = authHeader.substring(7);
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as unknown as UserPayload;
    if (!payload || !payload.id) {
      return c.json({ message: 'Invalid or expired token.' }, 401);
    }
    c.set('user', payload);
    await next();
  } catch (err) {
    return c.json({ message: 'Unauthenticated.' }, 401);
  }
});

export const requireOwner = createMiddleware<Env>(async (c, next) => {
  const user = c.get('user');
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
    return c.json({ message: 'Forbidden: Owner access required.' }, 403);
  }
  await next();
});

export const requireAdmin = createMiddleware<Env>(async (c, next) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json({ message: 'Forbidden: Admin access required.' }, 403);
  }
  await next();
});
