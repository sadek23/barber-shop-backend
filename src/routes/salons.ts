import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, like, sql } from 'drizzle-orm';
import { salons, areas, cities, salonImages, services, stylists } from '../db/schema';
import { Env } from '../types';

const salonRoutes = new Hono<Env>();

salonRoutes.get('/', async (c) => {
  const db = drizzle(c.env.DB);
  const { city_id, area_id, search } = c.req.query();

  let query = db.select({
    id: salons.id,
    ownerId: salons.ownerId,
    areaId: salons.areaId,
    name: salons.name,
    slug: salons.slug,
    address: salons.address,
    phone: salons.phone,
    description: salons.description,
    rating: salons.rating,
    isActive: salons.isActive,
    areaName: areas.name,
    cityId: cities.id,
    cityName: cities.name,
  })
  .from(salons)
  .leftJoin(areas, eq(salons.areaId, areas.id))
  .leftJoin(cities, eq(areas.cityId, cities.id))
  .where(eq(salons.isActive, true));

  const allSalons = await query.all();
  const allImages = await db.select().from(salonImages).all();

  let filtered = allSalons;
  if (city_id) {
    filtered = filtered.filter((s) => s.cityId === Number(city_id));
  }
  if (area_id) {
    filtered = filtered.filter((s) => s.areaId === Number(area_id));
  }
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter((s) =>
      s.name.toLowerCase().includes(searchLower) ||
      (s.description && s.description.toLowerCase().includes(searchLower)) ||
      (s.address && s.address.toLowerCase().includes(searchLower))
    );
  }

  const result = filtered.map((salon) => {
    const images = allImages.filter((img) => img.salonId === salon.id);
    const primaryImg = images.find((img) => img.isPrimary) || images[0];
    return {
      ...salon,
      image: primaryImg ? primaryImg.imageUrl : null,
      images,
      area: { id: salon.areaId, name: salon.areaName, city_id: salon.cityId },
      city: { id: salon.cityId, name: salon.cityName },
    };
  });

  return c.json({ data: result });
});

salonRoutes.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const db = drizzle(c.env.DB);

  let salon;
  if (!isNaN(Number(slug))) {
    salon = await db.select().from(salons).where(eq(salons.id, Number(slug))).get();
  } else {
    salon = await db.select().from(salons).where(eq(salons.slug, slug)).get();
  }

  if (!salon) {
    return c.json({ message: 'Salon not found.' }, 404);
  }

  const area = await db.select().from(areas).where(eq(areas.id, salon.areaId)).get();
  const city = area ? await db.select().from(cities).where(eq(cities.id, area.cityId)).get() : null;
  const images = await db.select().from(salonImages).where(eq(salonImages.salonId, salon.id)).all();
  const salonServices = await db.select().from(services).where(and(eq(services.salonId, salon.id), eq(services.isActive, true))).all();
  const salonStylists = await db.select().from(stylists).where(and(eq(stylists.salonId, salon.id), eq(stylists.isActive, true))).all();

  return c.json({
    data: {
      ...salon,
      area,
      city,
      images,
      services: salonServices,
      stylists: salonStylists,
    },
  });
});

salonRoutes.get('/:salonId/services', async (c) => {
  const salonId = Number(c.req.param('salonId'));
  const db = drizzle(c.env.DB);
  const salonServices = await db.select().from(services).where(and(eq(services.salonId, salonId), eq(services.isActive, true))).all();
  return c.json({ data: salonServices });
});

salonRoutes.get('/:salonId/stylists', async (c) => {
  const salonId = Number(c.req.param('salonId'));
  const db = drizzle(c.env.DB);
  const salonStylists = await db.select().from(stylists).where(and(eq(stylists.salonId, salonId), eq(stylists.isActive, true))).all();
  return c.json({ data: salonStylists });
});

export default salonRoutes;
