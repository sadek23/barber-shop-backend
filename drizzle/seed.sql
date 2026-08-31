-- Seed initial cities & areas
INSERT INTO cities (name, slug) VALUES ('Cairo', 'cairo'), ('Alexandria', 'alexandria');

INSERT INTO areas (city_id, name, slug) VALUES 
(1, 'New Cairo', 'new-cairo'),
(1, 'Maadi', 'maadi'),
(1, 'Zamalek', 'zamalek'),
(2, 'Gleem', 'gleem');

-- Seed Admin & Owner user (password: "password123" PBKDF2 hash)
INSERT INTO users (name, email, password, phone, role) VALUES 
('Super Admin', 'admin@crownandcuts.com', 'a1b2c3d4e5f60708:8f5e13d9a10294b02948e5812948501e2948501e2948501e2948501e2948501e', '+201000000000', 'admin'),
('John Barber Owner', 'owner@crownandcuts.com', 'a1b2c3d4e5f60708:8f5e13d9a10294b02948e5812948501e2948501e2948501e2948501e2948501e', '+201011111111', 'owner');

-- Seed Salon
INSERT INTO salons (owner_id, area_id, name, slug, address, phone, description, rating, is_active) VALUES
(2, 1, 'Crown & Cuts Barbershop', 'crown-and-cuts-barbershop', '90th Street, New Cairo', '+201022222222', 'Premium grooming and hair styling for gentlemen.', 4.9, 1);

-- Seed Services
INSERT INTO services (salon_id, name, description, price, duration_minutes, is_active) VALUES
(1, 'Haircut & Styling', 'Precision haircut including wash and styling.', 250, 45, 1),
(1, 'Beard Trim & Shape', 'Beard trimming with hot towel treatment.', 150, 30, 1),
(1, 'Executive Package', 'Haircut, beard styling, facial mask, and head massage.', 500, 75, 1);

-- Seed Stylists
INSERT INTO stylists (salon_id, name, title, avatar_url, buffer_time_minutes, is_active) VALUES
(1, 'Alex Smith', 'Master Barber', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb', 15, 1),
(1, 'Michael Vance', 'Senior Stylist', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d', 15, 1);

-- Seed Schedules (Monday through Saturday, 10:00 to 20:00)
INSERT INTO stylist_schedules (stylist_id, day_of_week, start_time, end_time, is_working) VALUES
(1, 1, '10:00', '20:00', 1), (1, 2, '10:00', '20:00', 1), (1, 3, '10:00', '20:00', 1),
(1, 4, '10:00', '20:00', 1), (1, 5, '10:00', '20:00', 1), (1, 6, '10:00', '20:00', 1), (1, 0, '10:00', '20:00', 0),
(2, 1, '10:00', '20:00', 1), (2, 2, '10:00', '20:00', 1), (2, 3, '10:00', '20:00', 1),
(2, 4, '10:00', '20:00', 1), (2, 5, '10:00', '20:00', 1), (2, 6, '10:00', '20:00', 1), (2, 0, '10:00', '20:00', 0);
