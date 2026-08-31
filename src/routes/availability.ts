import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { calculateAvailableSlots } from '../services/availability';
import { Env } from '../types';

const availabilityRoutes = new Hono<Env>();

availabilityRoutes.get('/:stylistId/availability', async (c) => {
  const stylistId = Number(c.req.param('stylistId'));
  const { date, service_id } = c.req.query();

  if (!date || !service_id) {
    return c.json({ message: 'Date and service_id are required parameters.' }, 422);
  }

  const db = drizzle(c.env.DB);
  try {
    const slots = await calculateAvailableSlots(db, stylistId, Number(service_id), date);
    return c.json({
      data: slots,
      message: 'Available slots calculated.',
    });
  } catch (err: any) {
    return c.json({
      data: [],
      message: err.message || 'Error calculating slots.',
    }, 200);
  }
});

export default availabilityRoutes;
