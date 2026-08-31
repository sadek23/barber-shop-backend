import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, sql } from 'drizzle-orm';
import { users, salons, appointments } from '../db/schema';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { hashPassword } from '../utils/crypto';
import { Env } from '../types';

const adminRoutes = new Hono<Env>();

adminRoutes.use('*', authMiddleware, requireAdmin);

adminRoutes.get('/stats', async (c) => {
  const db = drizzle(c.env.DB);

  const [totalSalons] = await db.select({ count: sql<number>`count(*)` }).from(salons);
  const [totalAppointments] = await db.select({ count: sql<number>`count(*)` }).from(appointments);
  const [totalOwners] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, 'owner'));
  const [totalCustomers] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, 'customer'));

  return c.json({
    data: {
      salons: totalSalons?.count || 0,
      appointments: totalAppointments?.count || 0,
      owners: totalOwners?.count || 0,
      customers: totalCustomers?.count || 0,
    },
  });
});

adminRoutes.get('/owners', async (c) => {
  const db = drizzle(c.env.DB);
  const ownersList = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    phone: users.phone,
    role: users.role,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.role, 'owner')).all();

  return c.json({ data: ownersList });
});

adminRoutes.post('/owners', async (c) => {
  const body = await c.req.json();
  const { name, email, password, phone } = body;

  if (!name || !email || !password) {
    return c.json({ message: 'Name, email, and password are required.' }, 422);
  }

  const db = drizzle(c.env.DB);
  const existingUser = await db.select().from(users).where(eq(users.email, email.toLowerCase())).get();

  if (existingUser) {
    return c.json({ message: 'Email address already taken.' }, 422);
  }

  const passwordHash = await hashPassword(password);
  const [newOwner] = await db.insert(users).values({
    name,
    email: email.toLowerCase(),
    password: passwordHash,
    phone: phone || null,
    role: 'owner',
  }).returning();

  return c.json({
    data: {
      id: newOwner.id,
      name: newOwner.name,
      email: newOwner.email,
      phone: newOwner.phone,
      role: newOwner.role,
    },
    message: 'Owner account created successfully.',
  }, 201);
});

export default adminRoutes;
