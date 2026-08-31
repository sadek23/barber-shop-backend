import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// --- Users ---
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  phone: text('phone'),
  role: text('role', { enum: ['customer', 'owner', 'admin'] }).default('customer').notNull(),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// --- Cities & Areas ---
export const cities = sqliteTable('cities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
});

export const areas = sqliteTable('areas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cityId: integer('city_id').notNull().references(() => cities.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
});

// --- Salons & Images ---
export const salons = sqliteTable('salons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerId: integer('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  areaId: integer('area_id').notNull().references(() => areas.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  address: text('address').notNull(),
  phone: text('phone'),
  description: text('description'),
  rating: real('rating').default(5.0),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const salonImages = sqliteTable('salon_images', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  salonId: integer('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(false).notNull(),
});

// --- Services & Stylists ---
export const services = sqliteTable('services', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  salonId: integer('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  price: real('price').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
});

export const stylists = sqliteTable('stylists', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  salonId: integer('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  title: text('title'),
  avatarUrl: text('avatar_url'),
  bufferTimeMinutes: integer('buffer_time_minutes').default(15).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
});

export const stylistServices = sqliteTable('stylist_services', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  stylistId: integer('stylist_id').notNull().references(() => stylists.id, { onDelete: 'cascade' }),
  serviceId: integer('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
});

// --- Schedules, Breaks, Overrides ---
export const stylistSchedules = sqliteTable('stylist_schedules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  stylistId: integer('stylist_id').notNull().references(() => stylists.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(), // 0 = Sunday, 6 = Saturday
  startTime: text('start_time').notNull(), // "09:00"
  endTime: text('end_time').notNull(), // "18:00"
  isWorking: integer('is_working', { mode: 'boolean' }).default(true).notNull(),
});

export const stylistBreaks = sqliteTable('stylist_breaks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scheduleId: integer('schedule_id').notNull().references(() => stylistSchedules.id, { onDelete: 'cascade' }),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
});

export const scheduleOverrides = sqliteTable('schedule_overrides', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  stylistId: integer('stylist_id').notNull().references(() => stylists.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // "YYYY-MM-DD"
  isDayOff: integer('is_day_off', { mode: 'boolean' }).default(false).notNull(),
  startTime: text('start_time'),
  endTime: text('end_time'),
});

// --- Appointments & Reviews ---
export const appointments = sqliteTable('appointments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  salonId: integer('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  serviceId: integer('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
  stylistId: integer('stylist_id').notNull().references(() => stylists.id, { onDelete: 'cascade' }),
  customerId: integer('customer_id').references(() => users.id, { onDelete: 'set null' }),
  guestName: text('guest_name'),
  guestEmail: text('guest_email'),
  guestPhone: text('guest_phone'),
  appointmentDate: text('appointment_date').notNull(), // "YYYY-MM-DD"
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  totalPrice: real('total_price').notNull(),
  status: text('status', { enum: ['pending', 'confirmed', 'completed', 'cancelled'] }).default('pending').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const reviews = sqliteTable('reviews', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  salonId: integer('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  customerId: integer('customer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

// --- Relations ---
export const citiesRelations = relations(cities, ({ many }) => ({
  areas: many(areas),
}));

export const areasRelations = relations(areas, ({ one, many }) => ({
  city: one(cities, { fields: [areas.cityId], references: [cities.id] }),
  salons: many(salons),
}));

export const salonsRelations = relations(salons, ({ one, many }) => ({
  owner: one(users, { fields: [salons.ownerId], references: [users.id] }),
  area: one(areas, { fields: [salons.areaId], references: [areas.id] }),
  images: many(salonImages),
  services: many(services),
  stylists: many(stylists),
  appointments: many(appointments),
}));

export const salonImagesRelations = relations(salonImages, ({ one }) => ({
  salon: one(salons, { fields: [salonImages.salonId], references: [salons.id] }),
}));

export const servicesRelations = relations(services, ({ one }) => ({
  salon: one(salons, { fields: [services.salonId], references: [salons.id] }),
}));

export const stylistsRelations = relations(stylists, ({ one, many }) => ({
  salon: one(salons, { fields: [stylists.salonId], references: [salons.id] }),
  schedules: many(stylistSchedules),
  overrides: many(scheduleOverrides),
  appointments: many(appointments),
  services: many(stylistServices),
}));

export const stylistSchedulesRelations = relations(stylistSchedules, ({ one, many }) => ({
  stylist: one(stylists, { fields: [stylistSchedules.stylistId], references: [stylists.id] }),
  breaks: many(stylistBreaks),
}));

export const stylistBreaksRelations = relations(stylistBreaks, ({ one }) => ({
  schedule: one(stylistSchedules, { fields: [stylistBreaks.scheduleId], references: [stylistSchedules.id] }),
}));

export const scheduleOverridesRelations = relations(scheduleOverrides, ({ one }) => ({
  stylist: one(stylists, { fields: [scheduleOverrides.stylistId], references: [stylists.id] }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  salon: one(salons, { fields: [appointments.salonId], references: [salons.id] }),
  service: one(services, { fields: [appointments.serviceId], references: [services.id] }),
  stylist: one(stylists, { fields: [appointments.stylistId], references: [stylists.id] }),
  customer: one(users, { fields: [appointments.customerId], references: [users.id] }),
}));
