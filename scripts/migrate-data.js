const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const oldDbPath = path.resolve(__dirname, '../../backend/database/database.sqlite');
const outputFile = path.resolve(__dirname, '../drizzle/migrated_data.sql');

if (!fs.existsSync(oldDbPath)) {
  console.error(`Old database not found at ${oldDbPath}`);
  process.exit(1);
}

const db = new sqlite3.Database(oldDbPath, sqlite3.OPEN_READONLY);

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

async function runMigration() {
  const sqlStatements = [];
  sqlStatements.push('-- Auto-migrated data from Laravel SQLite database');
  sqlStatements.push('PRAGMA foreign_keys = OFF;');

  // Clear existing seed data tables
  sqlStatements.push('DELETE FROM reviews;');
  sqlStatements.push('DELETE FROM appointments;');
  sqlStatements.push('DELETE FROM schedule_overrides;');
  sqlStatements.push('DELETE FROM stylist_breaks;');
  sqlStatements.push('DELETE FROM stylist_schedules;');
  sqlStatements.push('DELETE FROM stylist_services;');
  sqlStatements.push('DELETE FROM stylists;');
  sqlStatements.push('DELETE FROM services;');
  sqlStatements.push('DELETE FROM salon_images;');
  sqlStatements.push('DELETE FROM salons;');
  sqlStatements.push('DELETE FROM areas;');
  sqlStatements.push('DELETE FROM cities;');
  sqlStatements.push('DELETE FROM users;');

  // 1. Users
  await new Promise((resolve, reject) => {
    db.all('SELECT * FROM users', [], (err, rows) => {
      if (err) return reject(err);
      rows.forEach((row) => {
        sqlStatements.push(
          `INSERT INTO users (id, name, email, password, phone, role, created_at, updated_at) VALUES (${escapeSql(
            row.id
          )}, ${escapeSql(row.name)}, ${escapeSql(row.email)}, ${escapeSql(
            row.password
          )}, ${escapeSql(row.phone)}, ${escapeSql(row.role)}, ${escapeSql(
            row.created_at
          )}, ${escapeSql(row.updated_at)});`
        );
      });
      resolve();
    });
  });

  // 2. Cities
  await new Promise((resolve, reject) => {
    db.all('SELECT * FROM cities', [], (err, rows) => {
      if (err) return reject(err);
      rows.forEach((row) => {
        sqlStatements.push(
          `INSERT INTO cities (id, name, slug) VALUES (${escapeSql(
            row.id
          )}, ${escapeSql(row.name)}, ${escapeSql(row.slug)});`
        );
      });
      resolve();
    });
  });

  // 3. Areas
  await new Promise((resolve, reject) => {
    db.all('SELECT * FROM areas', [], (err, rows) => {
      if (err) return reject(err);
      rows.forEach((row) => {
        sqlStatements.push(
          `INSERT INTO areas (id, city_id, name, slug) VALUES (${escapeSql(
            row.id
          )}, ${escapeSql(row.city_id)}, ${escapeSql(row.name)}, ${escapeSql(
            row.slug
          )});`
        );
      });
      resolve();
    });
  });

  // 4. Salons
  await new Promise((resolve, reject) => {
    db.all('SELECT * FROM salons', [], (err, rows) => {
      if (err) return reject(err);
      rows.forEach((row) => {
        sqlStatements.push(
          `INSERT INTO salons (id, owner_id, area_id, name, slug, address, phone, description, rating, is_active, created_at, updated_at) VALUES (${escapeSql(
            row.id
          )}, ${escapeSql(row.owner_id)}, ${escapeSql(row.area_id)}, ${escapeSql(
            row.name
          )}, ${escapeSql(row.slug)}, ${escapeSql(row.address)}, ${escapeSql(
            row.phone
          )}, ${escapeSql(row.description)}, ${escapeSql(
            row.rating || 5.0
          )}, ${escapeSql(row.is_active ?? 1)}, ${escapeSql(
            row.created_at
          )}, ${escapeSql(row.updated_at)});`
        );
      });
      resolve();
    });
  });

  // 5. Salon Images
  await new Promise((resolve, reject) => {
    db.all('SELECT * FROM salon_images', [], (err, rows) => {
      if (err) return reject(err);
      rows.forEach((row) => {
        const isPrimary = row.sort_order === 0 ? 1 : 0;
        sqlStatements.push(
          `INSERT INTO salon_images (id, salon_id, image_url, is_primary) VALUES (${escapeSql(
            row.id
          )}, ${escapeSql(row.salon_id)}, ${escapeSql(
            row.image_path
          )}, ${isPrimary});`
        );
      });
      resolve();
    });
  });

  // 6. Services
  await new Promise((resolve, reject) => {
    db.all('SELECT * FROM services', [], (err, rows) => {
      if (err) return reject(err);
      rows.forEach((row) => {
        sqlStatements.push(
          `INSERT INTO services (id, salon_id, name, description, price, duration_minutes, is_active) VALUES (${escapeSql(
            row.id
          )}, ${escapeSql(row.salon_id)}, ${escapeSql(row.name)}, ${escapeSql(
            row.description
          )}, ${escapeSql(row.price)}, ${escapeSql(
            row.duration_minutes || 30
          )}, ${escapeSql(row.is_active ?? 1)});`
        );
      });
      resolve();
    });
  });

  // 7. Stylists
  await new Promise((resolve, reject) => {
    db.all('SELECT * FROM stylists', [], (err, rows) => {
      if (err) return reject(err);
      rows.forEach((row) => {
        sqlStatements.push(
          `INSERT INTO stylists (id, salon_id, name, title, avatar_url, buffer_time_minutes, is_active) VALUES (${escapeSql(
            row.id
          )}, ${escapeSql(row.salon_id)}, ${escapeSql(row.name)}, ${escapeSql(
            row.bio || 'Stylist'
          )}, ${escapeSql(row.photo)}, ${escapeSql(
            row.buffer_time_minutes || 15
          )}, ${escapeSql(row.is_active ?? 1)});`
        );
      });
      resolve();
    });
  });

  // 8. Stylist Services (Pivot)
  await new Promise((resolve, reject) => {
    db.all('SELECT * FROM stylist_services', [], (err, rows) => {
      if (err) return reject(err);
      rows.forEach((row) => {
        sqlStatements.push(
          `INSERT INTO stylist_services (id, stylist_id, service_id) VALUES (${escapeSql(
            row.id
          )}, ${escapeSql(row.stylist_id)}, ${escapeSql(row.service_id)});`
        );
      });
      resolve();
    });
  });

  // 9. Stylist Schedules
  await new Promise((resolve, reject) => {
    db.all('SELECT * FROM stylist_schedules', [], (err, rows) => {
      if (err) return reject(err);
      rows.forEach((row) => {
        sqlStatements.push(
          `INSERT INTO stylist_schedules (id, stylist_id, day_of_week, start_time, end_time, is_working) VALUES (${escapeSql(
            row.id
          )}, ${escapeSql(row.stylist_id)}, ${escapeSql(
            row.day_of_week
          )}, ${escapeSql(row.start_time)}, ${escapeSql(
            row.end_time
          )}, ${escapeSql(row.is_working ?? 1)});`
        );
      });
      resolve();
    });
  });

  // 10. Schedule Breaks -> Stylist Breaks
  await new Promise((resolve, reject) => {
    db.all('SELECT * FROM schedule_breaks', [], (err, rows) => {
      if (err) return reject(err);
      rows.forEach((row) => {
        sqlStatements.push(
          `INSERT INTO stylist_breaks (id, schedule_id, start_time, end_time) VALUES (${escapeSql(
            row.id
          )}, ${escapeSql(row.stylist_schedule_id)}, ${escapeSql(
            row.start_time
          )}, ${escapeSql(row.end_time)});`
        );
      });
      resolve();
    });
  });

  // 11. Schedule Overrides
  await new Promise((resolve, reject) => {
    db.all('SELECT * FROM schedule_overrides', [], (err, rows) => {
      if (err) return reject(err);
      rows.forEach((row) => {
        sqlStatements.push(
          `INSERT INTO schedule_overrides (id, stylist_id, date, is_day_off, start_time, end_time) VALUES (${escapeSql(
            row.id
          )}, ${escapeSql(row.stylist_id)}, ${escapeSql(row.date)}, ${escapeSql(
            row.is_day_off ?? 1
          )}, ${escapeSql(row.start_time)}, ${escapeSql(row.end_time)});`
        );
      });
      resolve();
    });
  });

  // 12. Appointments
  await new Promise((resolve, reject) => {
    db.all('SELECT * FROM appointments', [], (err, rows) => {
      if (err) return reject(err);
      rows.forEach((row) => {
        sqlStatements.push(
          `INSERT INTO appointments (id, salon_id, service_id, stylist_id, customer_id, guest_name, guest_email, guest_phone, appointment_date, start_time, end_time, total_price, status, notes, created_at, updated_at) VALUES (${escapeSql(
            row.id
          )}, ${escapeSql(row.salon_id)}, ${escapeSql(
            row.service_id
          )}, ${escapeSql(row.stylist_id)}, ${escapeSql(
            row.user_id
          )}, ${escapeSql(row.customer_name)}, ${escapeSql(
            row.customer_email
          )}, ${escapeSql(row.customer_phone)}, ${escapeSql(
            row.appointment_date
          )}, ${escapeSql(row.start_time)}, ${escapeSql(
            row.end_time
          )}, ${escapeSql(row.price)}, ${escapeSql(
            row.status || 'pending'
          )}, ${escapeSql(row.notes)}, ${escapeSql(row.created_at)}, ${escapeSql(
            row.updated_at
          )});`
        );
      });
      resolve();
    });
  });

  // 13. Reviews
  await new Promise((resolve, reject) => {
    db.all('SELECT * FROM reviews', [], (err, rows) => {
      if (err) return reject(err);
      rows.forEach((row) => {
        sqlStatements.push(
          `INSERT INTO reviews (id, salon_id, customer_id, rating, comment, created_at) VALUES (${escapeSql(
            row.id
          )}, ${escapeSql(row.salon_id)}, ${escapeSql(
            row.user_id
          )}, ${escapeSql(row.rating)}, ${escapeSql(row.comment)}, ${escapeSql(
            row.created_at
          )});`
        );
      });
      resolve();
    });
  });

  sqlStatements.push('PRAGMA foreign_keys = ON;');

  fs.writeFileSync(outputFile, sqlStatements.join('\n'));
  console.log(`Successfully generated migration SQL script at ${outputFile} (${sqlStatements.length} statements)`);
  db.close();
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
