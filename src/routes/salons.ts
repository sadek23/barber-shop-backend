import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { salons, areas, cities, salonImages, services, stylists } from '../db/schema';
import { Env } from '../types';

const salonRoutes = new Hono<Env>();

salonRoutes.get('/', async (c) => {
  const db = drizzle(c.env.DB);
  const { city, city_id, area, area_id, service, search, query, sort } = c.req.query();

  const targetCity = city || city_id;
  const targetArea = area || area_id;
  const targetSearch = search || query;
  const targetService = service;

  // Select salons with joined city & area
  const rawSalons = await db.select({
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
    areaSlug: areas.slug,
    cityId: cities.id,
    cityName: cities.name,
    citySlug: cities.slug,
  })
  .from(salons)
  .leftJoin(areas, eq(salons.areaId, areas.id))
  .leftJoin(cities, eq(areas.cityId, cities.id))
  .where(eq(salons.isActive, true))
  .all();

  const allImages = await db.select().from(salonImages).all();
  const allServices = await db.select().from(services).where(eq(services.isActive, true)).all();

  let filtered = rawSalons;

  // 1. Filter by City (ID, slug, or name match)
  if (targetCity) {
    const cityStr = targetCity.toLowerCase().trim();
    filtered = filtered.filter((s) => {
      if (s.cityId && String(s.cityId) === cityStr) return true;
      if (s.citySlug && s.citySlug.toLowerCase() === cityStr) return true;
      if (s.cityName && s.cityName.toLowerCase() === cityStr) return true;
      return false;
    });
  }

  // 2. Filter by Area (ID, slug, or name match)
  if (targetArea) {
    const areaStr = targetArea.toLowerCase().trim();
    filtered = filtered.filter((s) => {
      if (s.areaId && String(s.areaId) === areaStr) return true;
      if (s.areaSlug && s.areaSlug.toLowerCase() === areaStr) return true;
      if (s.areaName && s.areaName.toLowerCase() === areaStr) return true;
      return false;
    });
  }

  // 3. Filter by Service Name/Keyword
  if (targetService) {
    const serviceLower = targetService.toLowerCase().trim();
    filtered = filtered.filter((s) => {
      const salonServices = allServices.filter((srv) => srv.salonId === s.id);
      return salonServices.some((srv) =>
        srv.name.toLowerCase().includes(serviceLower) ||
        (srv.description && srv.description.toLowerCase().includes(serviceLower))
      );
    });
  }

  // 4. Filter by General Search Text
  if (targetSearch) {
    const searchLower = targetSearch.toLowerCase().trim();
    filtered = filtered.filter((s) => {
      const nameMatch = s.name.toLowerCase().includes(searchLower);
      const descMatch = s.description ? s.description.toLowerCase().includes(searchLower) : false;
      const addrMatch = s.address ? s.address.toLowerCase().includes(searchLower) : false;
      const areaMatch = s.areaName ? s.areaName.toLowerCase().includes(searchLower) : false;
      const cityMatch = s.cityName ? s.cityName.toLowerCase().includes(searchLower) : false;
      
      const salonServices = allServices.filter((srv) => srv.salonId === s.id);
      const serviceMatch = salonServices.some((srv) => srv.name.toLowerCase().includes(searchLower));

      return nameMatch || descMatch || addrMatch || areaMatch || cityMatch || serviceMatch;
    });
  }

  // Sort
  if (sort === 'rating') {
    filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (sort === 'popularity') {
    filtered.sort((a, b) => b.id - a.id);
  }

  // Format response matching frontend models
  const result = filtered.map((salon) => {
    const images = allImages.filter((img) => img.salonId === salon.id);
    const primaryImg = images.find((img) => img.isPrimary) || images[0];
    const salonServices = allServices.filter((srv) => srv.salonId === salon.id);

    return {
      ...salon,
      image: primaryImg ? primaryImg.imageUrl : null,
      images,
      services: salonServices,
      area: { id: salon.areaId, name: salon.areaName, slug: salon.areaSlug, city_id: salon.cityId },
      city: { id: salon.cityId, name: salon.cityName, slug: salon.citySlug },
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
