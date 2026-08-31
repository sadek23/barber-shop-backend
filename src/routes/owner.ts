import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { salons, services, stylists, stylistSchedules, stylistBreaks, scheduleOverrides, appointments, salonImages } from '../db/schema';
import { authMiddleware, requireOwner } from '../middleware/auth';
import { Env } from '../types';

const ownerRoutes = new Hono<Env>();

ownerRoutes.use('*', authMiddleware, requireOwner);

// --- Salon Management ---
ownerRoutes.get('/salon', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);

  const salon = await db.select().from(salons).where(eq(salons.ownerId, user.id)).get();
  if (!salon) {
    return c.json({ data: null, message: 'No salon found for this owner.' });
  }

  const images = await db.select().from(salonImages).where(eq(salonImages.salonId, salon.id)).all();
  return c.json({ data: { ...salon, images } });
});

ownerRoutes.post('/salon', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { name, area_id, address, phone, description } = body;

  if (!name || !area_id || !address) {
    return c.json({ message: 'Name, area_id, and address are required.' }, 422);
  }

  const db = drizzle(c.env.DB);
  let salon = await db.select().from(salons).where(eq(salons.ownerId, user.id)).get();

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

  if (salon) {
    [salon] = await db.update(salons)
      .set({ name, areaId: Number(area_id), address, phone: phone || null, description: description || null })
      .where(eq(salons.id, salon.id))
      .returning();
  } else {
    [salon] = await db.insert(salons).values({
      ownerId: user.id,
      areaId: Number(area_id),
      name,
      slug: `${slug}-${Date.now().toString().slice(-4)}`,
      address,
      phone: phone || null,
      description: description || null,
      isActive: true,
    }).returning();
  }

  return c.json({ data: salon, message: 'Salon details saved.' });
});

// Image upload to R2
ownerRoutes.post('/salon/upload-image', async (c) => {
  const user = c.get('user');
  const formData = await c.req.parseBody();
  const file = formData['file'];

  if (!file || typeof file === 'string') {
    return c.json({ message: 'Valid file is required.' }, 422);
  }

  const db = drizzle(c.env.DB);
  const salon = await db.select().from(salons).where(eq(salons.ownerId, user.id)).get();

  if (!salon) {
    return c.json({ message: 'Please create a salon first.' }, 404);
  }

  const filename = `salons/${salon.id}/${Date.now()}-${file.name}`;
  const arrayBuffer = await file.arrayBuffer();

  await c.env.STORAGE.put(filename, arrayBuffer, {
    httpMetadata: { contentType: file.type },
  });

  const imageUrl = `https://images.crownandcuts.com/${filename}`; // Or custom R2 domain

  const [imageRecord] = await db.insert(salonImages).values({
    salonId: salon.id,
    imageUrl,
    isPrimary: false,
  }).returning();

  return c.json({ data: imageRecord, message: 'Image uploaded successfully.' });
});

// --- Services CRUD ---
ownerRoutes.get('/services', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);
  const salon = await db.select().from(salons).where(eq(salons.ownerId, user.id)).get();
  if (!salon) return c.json({ data: [] });

  const result = await db.select().from(services).where(eq(services.salonId, salon.id)).all();
  return c.json({ data: result });
});

ownerRoutes.post('/services', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { name, description, price, duration_minutes } = body;

  const db = drizzle(c.env.DB);
  const salon = await db.select().from(salons).where(eq(salons.ownerId, user.id)).get();
  if (!salon) return c.json({ message: 'Salon not found.' }, 404);

  const [newService] = await db.insert(services).values({
    salonId: salon.id,
    name,
    description: description || null,
    price: Number(price),
    durationMinutes: Number(duration_minutes),
    isActive: true,
  }).returning();

  return c.json({ data: newService, message: 'Service created.' }, 201);
});

ownerRoutes.put('/services/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const { name, description, price, duration_minutes, is_active } = body;

  const db = drizzle(c.env.DB);
  const [updated] = await db.update(services)
    .set({
      name,
      description: description || null,
      price: Number(price),
      durationMinutes: Number(duration_minutes),
      isActive: is_active ?? true,
    })
    .where(eq(services.id, id))
    .returning();

  return c.json({ data: updated, message: 'Service updated.' });
});

ownerRoutes.delete('/services/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const db = drizzle(c.env.DB);
  await db.delete(services).where(eq(services.id, id));
  return c.json({ message: 'Service deleted.' });
});

// --- Stylists CRUD ---
ownerRoutes.get('/stylists', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);
  const salon = await db.select().from(salons).where(eq(salons.ownerId, user.id)).get();
  if (!salon) return c.json({ data: [] });

  const result = await db.select().from(stylists).where(eq(stylists.salonId, salon.id)).all();
  return c.json({ data: result });
});

ownerRoutes.post('/stylists', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { name, title, avatar_url, buffer_time_minutes } = body;

  const db = drizzle(c.env.DB);
  const salon = await db.select().from(salons).where(eq(salons.ownerId, user.id)).get();
  if (!salon) return c.json({ message: 'Salon not found.' }, 404);

  const [newStylist] = await db.insert(stylists).values({
    salonId: salon.id,
    name,
    title: title || null,
    avatarUrl: avatar_url || null,
    bufferTimeMinutes: Number(buffer_time_minutes) || 15,
    isActive: true,
  }).returning();

  // Create default 7-day schedules
  for (let day = 0; day <= 6; day++) {
    const isWeekend = day === 0 || day === 6;
    await db.insert(stylistSchedules).values({
      stylistId: newStylist.id,
      dayOfWeek: day,
      startTime: '09:00',
      endTime: '18:00',
      isWorking: !isWeekend,
    });
  }

  return c.json({ data: newStylist, message: 'Stylist created.' }, 201);
});

ownerRoutes.put('/stylists/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const { name, title, avatar_url, buffer_time_minutes, is_active } = body;

  const db = drizzle(c.env.DB);
  const [updated] = await db.update(stylists)
    .set({
      name,
      title: title || null,
      avatarUrl: avatar_url || null,
      bufferTimeMinutes: Number(buffer_time_minutes) || 15,
      isActive: is_active ?? true,
    })
    .where(eq(stylists.id, id))
    .returning();

  return c.json({ data: updated, message: 'Stylist updated.' });
});

ownerRoutes.delete('/stylists/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const db = drizzle(c.env.DB);
  await db.delete(stylists).where(eq(stylists.id, id));
  return c.json({ message: 'Stylist deleted.' });
});

// --- Schedules & Overrides ---
ownerRoutes.get('/schedules/:stylistId', async (c) => {
  const stylistId = Number(c.req.param('stylistId'));
  const db = drizzle(c.env.DB);

  const schedules = await db.select().from(stylistSchedules).where(eq(stylistSchedules.stylistId, stylistId)).all();
  const allBreaks = await db.select().from(stylistBreaks).all();
  const overrides = await db.select().from(scheduleOverrides).where(eq(scheduleOverrides.stylistId, stylistId)).all();

  const schedulesWithBreaks = schedules.map((sch) => ({
    ...sch,
    breaks: allBreaks.filter((b) => b.scheduleId === sch.id),
  }));

  return c.json({ data: { schedules: schedulesWithBreaks, overrides } });
});

ownerRoutes.post('/schedules/:stylistId', async (c) => {
  const stylistId = Number(c.req.param('stylistId'));
  const body = await c.req.json();
  const { schedules } = body; // Array of schedule items

  const db = drizzle(c.env.DB);

  if (Array.isArray(schedules)) {
    for (const item of schedules) {
      const existing = await db.select().from(stylistSchedules)
        .where(and(eq(stylistSchedules.stylistId, stylistId), eq(stylistSchedules.dayOfWeek, item.day_of_week)))
        .get();

      if (existing) {
        await db.update(stylistSchedules)
          .set({ startTime: item.start_time, endTime: item.end_time, isWorking: item.is_working })
          .where(eq(stylistSchedules.id, existing.id));
      } else {
        await db.insert(stylistSchedules).values({
          stylistId,
          dayOfWeek: item.day_of_week,
          startTime: item.start_time,
          endTime: item.end_time,
          isWorking: item.is_working,
        });
      }
    }
  }

  return c.json({ message: 'Schedule updated.' });
});

ownerRoutes.post('/schedules/:stylistId/overrides', async (c) => {
  const stylistId = Number(c.req.param('stylistId'));
  const body = await c.req.json();
  const { date, is_day_off, start_time, end_time } = body;

  const db = drizzle(c.env.DB);
  const [override] = await db.insert(scheduleOverrides).values({
    stylistId,
    date,
    isDayOff: is_day_off ?? false,
    startTime: start_time || null,
    endTime: end_time || null,
  }).returning();

  return c.json({ data: override, message: 'Override added.' }, 201);
});

ownerRoutes.delete('/schedules/:stylistId/overrides/:overrideId', async (c) => {
  const overrideId = Number(c.req.param('overrideId'));
  const db = drizzle(c.env.DB);
  await db.delete(scheduleOverrides).where(eq(scheduleOverrides.id, overrideId));
  return c.json({ message: 'Override deleted.' });
});

// --- Owner Appointments Management ---
ownerRoutes.get('/appointments', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);
  const salon = await db.select().from(salons).where(eq(salons.ownerId, user.id)).get();
  if (!salon) return c.json({ data: [] });

  const result = await db.select({
    id: appointments.id,
    appointmentDate: appointments.appointmentDate,
    startTime: appointments.startTime,
    endTime: appointments.endTime,
    totalPrice: appointments.totalPrice,
    status: appointments.status,
    guestName: appointments.guestName,
    guestEmail: appointments.guestEmail,
    guestPhone: appointments.guestPhone,
    notes: appointments.notes,
    serviceName: services.name,
    stylistName: stylists.name,
  })
  .from(appointments)
  .leftJoin(services, eq(appointments.serviceId, services.id))
  .leftJoin(stylists, eq(appointments.stylistId, stylists.id))
  .where(eq(appointments.salonId, salon.id))
  .all();

  return c.json({ data: result });
});

ownerRoutes.patch('/appointments/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const { status } = body;

  const db = drizzle(c.env.DB);
  const [updated] = await db.update(appointments)
    .set({ status })
    .where(eq(appointments.id, id))
    .returning();

  return c.json({ data: updated, message: 'Status updated.' });
});

export default ownerRoutes;
