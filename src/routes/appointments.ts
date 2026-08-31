import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { appointments, services, salons, stylists } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { calculateAvailableSlots } from '../services/availability';
import { Env } from '../types';

const appointmentRoutes = new Hono<Env>();

appointmentRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const {
    salon_id,
    service_id,
    stylist_id,
    appointment_date,
    start_time,
    guest_name,
    guest_email,
    guest_phone,
    notes,
  } = body;

  if (!salon_id || !service_id || !stylist_id || !appointment_date || !start_time) {
    return c.json({ message: 'Missing required booking fields.' }, 422);
  }

  const db = drizzle(c.env.DB);
  const service = await db.select().from(services).where(eq(services.id, Number(service_id))).get();

  if (!service) {
    return c.json({ message: 'Selected service not found.' }, 404);
  }

  // Check slot availability
  const availableSlots = await calculateAvailableSlots(db, Number(stylist_id), Number(service_id), appointment_date);
  const matchedSlot = availableSlots.find((s) => s.start_time === start_time);

  if (!matchedSlot) {
    return c.json({ message: 'Selected time slot is no longer available.' }, 422);
  }

  // Extract auth user if token provided
  let customerId: number | null = null;
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const user = c.get('user');
      if (user) customerId = user.id;
    } catch (_) {}
  }

  const [newAppointment] = await db.insert(appointments).values({
    salonId: Number(salon_id),
    serviceId: Number(service_id),
    stylistId: Number(stylist_id),
    customerId,
    guestName: guest_name || null,
    guestEmail: guest_email || null,
    guestPhone: guest_phone || null,
    appointmentDate: appointment_date,
    startTime: matchedSlot.start_time,
    endTime: matchedSlot.end_time,
    totalPrice: service.price,
    status: 'pending',
    notes: notes || null,
  }).returning();

  return c.json({
    data: newAppointment,
    message: 'Appointment booked successfully.',
  }, 201);
});

appointmentRoutes.get('/', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);

  const userAppointments = await db.select({
    id: appointments.id,
    salonId: appointments.salonId,
    serviceId: appointments.serviceId,
    stylistId: appointments.stylistId,
    appointmentDate: appointments.appointmentDate,
    startTime: appointments.startTime,
    endTime: appointments.endTime,
    totalPrice: appointments.totalPrice,
    status: appointments.status,
    notes: appointments.notes,
    salonName: salons.name,
    serviceName: services.name,
    stylistName: stylists.name,
  })
  .from(appointments)
  .leftJoin(salons, eq(appointments.salonId, salons.id))
  .leftJoin(services, eq(appointments.serviceId, services.id))
  .leftJoin(stylists, eq(appointments.stylistId, stylists.id))
  .where(eq(appointments.customerId, user.id))
  .all();

  const formatted = userAppointments.map((appt) => ({
    ...appt,
    salon: { id: appt.salonId, name: appt.salonName },
    service: { id: appt.serviceId, name: appt.serviceName },
    stylist: { id: appt.stylistId, name: appt.stylistName },
  }));

  return c.json({ data: formatted });
});

appointmentRoutes.get('/:id', authMiddleware, async (c) => {
  const id = Number(c.req.param('id'));
  const user = c.get('user');
  const db = drizzle(c.env.DB);

  const appt = await db.select().from(appointments).where(eq(appointments.id, id)).get();
  if (!appt || appt.customerId !== user.id) {
    return c.json({ message: 'Appointment not found.' }, 404);
  }

  const salon = await db.select().from(salons).where(eq(salons.id, appt.salonId)).get();
  const service = await db.select().from(services).where(eq(services.id, appt.serviceId)).get();
  const stylist = await db.select().from(stylists).where(eq(stylists.id, appt.stylistId)).get();

  return c.json({
    data: {
      ...appt,
      salon,
      service,
      stylist,
    },
  });
});

appointmentRoutes.patch('/:id/cancel', authMiddleware, async (c) => {
  const id = Number(c.req.param('id'));
  const user = c.get('user');
  const db = drizzle(c.env.DB);

  const appt = await db.select().from(appointments).where(eq(appointments.id, id)).get();
  if (!appt || (appt.customerId !== user.id && user.role !== 'admin' && user.role !== 'owner')) {
    return c.json({ message: 'Appointment not found.' }, 404);
  }

  const [updated] = await db.update(appointments)
    .set({ status: 'cancelled' })
    .where(eq(appointments.id, id))
    .returning();

  return c.json({ data: updated, message: 'Appointment cancelled.' });
});

export default appointmentRoutes;
