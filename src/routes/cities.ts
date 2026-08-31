import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { cities, areas } from '../db/schema';
import { Env } from '../types';

const cityRoutes = new Hono<Env>();

cityRoutes.get('/', async (c) => {
  const db = drizzle(c.env.DB);
  const allCities = await db.select().from(cities).all();
  const allAreas = await db.select().from(areas).all();

  const citiesWithAreas = allCities.map((city) => ({
    ...city,
    areas: allAreas.filter((area) => area.cityId === city.id),
  }));

  return c.json({ data: citiesWithAreas });
});

cityRoutes.get('/:city/areas', async (c) => {
  const cityParam = c.req.param('city');
  const db = drizzle(c.env.DB);

  let city;
  if (!isNaN(Number(cityParam))) {
    city = await db.select().from(cities).where(eq(cities.id, Number(cityParam))).get();
  } else {
    city = await db.select().from(cities).where(eq(cities.slug, cityParam)).get();
  }

  if (!city) {
    return c.json({ message: 'City not found.' }, 404);
  }

  const cityAreas = await db.select().from(areas).where(eq(areas.cityId, city.id)).all();
  return c.json({ data: cityAreas });
});

export default cityRoutes;
