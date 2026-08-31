import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './types';
import authRoutes from './routes/auth';
import cityRoutes from './routes/cities';
import salonRoutes from './routes/salons';
import availabilityRoutes from './routes/availability';
import appointmentRoutes from './routes/appointments';
import ownerRoutes from './routes/owner';
import adminRoutes from './routes/admin';

const app = new Hono<Env>();

// Global Middlewares
app.use('*', logger());
app.use('*', cors({
  origin: (origin, c) => {
    return c.env.FRONTEND_URL || origin || '*';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
  credentials: true,
}));

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount Route Modules under /api
app.route('/api/auth', authRoutes);
app.route('/api/cities', cityRoutes);
app.route('/api/salons', salonRoutes);
app.route('/api/stylists', availabilityRoutes);
app.route('/api/appointments', appointmentRoutes);
app.route('/api/owner', ownerRoutes);
app.route('/api/admin', adminRoutes);

// Global Error Handler
app.onError((err, c) => {
  console.error('Unhandled Worker Error:', err);
  return c.json({
    message: err.message || 'Internal Server Error',
  }, 500);
});

// 404 Handler
app.notFound((c) => {
  return c.json({ message: 'Route Not Found' }, 404);
});

export default app;
