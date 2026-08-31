import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { sign } from 'hono/jwt';
import { users } from '../db/schema';
import { hashPassword, verifyPassword } from '../utils/crypto';
import { authMiddleware } from '../middleware/auth';
import { Env } from '../types';

const auth = new Hono<Env>();

auth.post('/register', async (c) => {
  const body = await c.req.json();
  const { name, email, password, phone, role } = body;

  if (!name || !email || !password) {
    return c.json({ message: 'Name, email, and password are required.' }, 422);
  }

  const db = drizzle(c.env.DB);
  const existingUser = await db.select().from(users).where(eq(users.email, email.toLowerCase())).get();

  if (existingUser) {
    return c.json({ message: 'The email address has already been taken.' }, 422);
  }

  const passwordHash = await hashPassword(password);
  const userRole = (role === 'owner' || role === 'admin') ? role : 'customer';

  const [newUser] = await db.insert(users).values({
    name,
    email: email.toLowerCase(),
    password: passwordHash,
    phone: phone || null,
    role: userRole,
  }).returning();

  const token = await sign(
    { id: newUser.id, email: newUser.email, role: newUser.role },
    c.env.JWT_SECRET
  );

  return c.json({
    data: {
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
      },
      token,
    },
    message: 'User registered successfully.',
  }, 201);
});

auth.post('/login', async (c) => {
  const body = await c.req.json();
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ message: 'Email and password are required.' }, 422);
  }

  const db = drizzle(c.env.DB);
  const user = await db.select().from(users).where(eq(users.email, email.toLowerCase())).get();

  if (!user) {
    return c.json({ message: 'Invalid credentials.' }, 401);
  }

  const isPasswordValid = await verifyPassword(password, user.password);
  if (!isPasswordValid) {
    return c.json({ message: 'Invalid credentials.' }, 401);
  }

  // On-the-fly migration: upgrade legacy bcrypt hashes to fast Web Crypto PBKDF2 format
  if (user.password.startsWith('$2y$') || user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
    try {
      const newHash = await hashPassword(password);
      await db.update(users).set({ password: newHash }).where(eq(users.id, user.id));
    } catch (_) {}
  }

  const token = await sign(
    { id: user.id, email: user.email, role: user.role },
    c.env.JWT_SECRET
  );

  return c.json({
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      token,
    },
    message: 'Logged in successfully.',
  });
});

auth.get('/me', authMiddleware, async (c) => {
  const userPayload = c.get('user');
  const db = drizzle(c.env.DB);
  const user = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    phone: users.phone,
    role: users.role,
  }).from(users).where(eq(users.id, userPayload.id)).get();

  if (!user) {
    return c.json({ message: 'User not found.' }, 404);
  }

  return c.json({ data: user });
});

auth.post('/logout', authMiddleware, async (c) => {
  return c.json({ message: 'Logged out successfully.' });
});

export default auth;
