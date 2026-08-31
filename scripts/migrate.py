import sqlite3
import os

old_db_path = os.path.abspath("../backend/database/database.sqlite")
output_sql_path = os.path.abspath("drizzle/migrated_data.sql")

if not os.path.exists(old_db_path):
    print(f"Error: {old_db_path} not found")
    exit(1)

conn = sqlite3.connect(old_db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

def escape_sql(val):
    if val is None:
        return 'NULL'
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, bool):
        return '1' if val else '0'
    escaped = str(val).replace("'", "''")
    return f"'{escaped}'"

statements = []
statements.append("-- Auto-migrated data from Laravel SQLite database")
statements.append("PRAGMA foreign_keys = OFF;")

# Clear target tables
for table in [
    'reviews', 'appointments', 'schedule_overrides', 'stylist_breaks',
    'stylist_schedules', 'stylist_services', 'stylists', 'services',
    'salon_images', 'salons', 'areas', 'cities', 'users'
]:
    statements.append(f"DELETE FROM {table};")

# 1. Users
cursor.execute("SELECT * FROM users")
for row in cursor.fetchall():
    statements.append(
        f"INSERT INTO users (id, name, email, password, phone, role, created_at, updated_at) "
        f"VALUES ({escape_sql(row['id'])}, {escape_sql(row['name'])}, {escape_sql(row['email'])}, "
        f"{escape_sql(row['password'])}, {escape_sql(row['phone'])}, {escape_sql(row['role'])}, "
        f"{escape_sql(row['created_at'])}, {escape_sql(row['updated_at'])});"
    )

# 2. Cities
cursor.execute("SELECT * FROM cities")
for row in cursor.fetchall():
    statements.append(
        f"INSERT INTO cities (id, name, slug) "
        f"VALUES ({escape_sql(row['id'])}, {escape_sql(row['name'])}, {escape_sql(row['slug'])});"
    )

# 3. Areas
cursor.execute("SELECT * FROM areas")
for row in cursor.fetchall():
    statements.append(
        f"INSERT INTO areas (id, city_id, name, slug) "
        f"VALUES ({escape_sql(row['id'])}, {escape_sql(row['city_id'])}, {escape_sql(row['name'])}, {escape_sql(row['slug'])});"
    )

# 4. Salons
cursor.execute("SELECT * FROM salons")
for row in cursor.fetchall():
    statements.append(
        f"INSERT INTO salons (id, owner_id, area_id, name, slug, address, phone, description, rating, is_active, created_at, updated_at) "
        f"VALUES ({escape_sql(row['id'])}, {escape_sql(row['owner_id'])}, {escape_sql(row['area_id'])}, "
        f"{escape_sql(row['name'])}, {escape_sql(row['slug'])}, {escape_sql(row['address'])}, "
        f"{escape_sql(row['phone'])}, {escape_sql(row['description'])}, {escape_sql(row['rating'] or 5.0)}, "
        f"{escape_sql(row['is_active'])}, {escape_sql(row['created_at'])}, {escape_sql(row['updated_at'])});"
    )

# 5. Salon Images
cursor.execute("SELECT * FROM salon_images")
for row in cursor.fetchall():
    is_primary = 1 if row['sort_order'] == 0 else 0
    statements.append(
        f"INSERT INTO salon_images (id, salon_id, image_url, is_primary) "
        f"VALUES ({escape_sql(row['id'])}, {escape_sql(row['salon_id'])}, {escape_sql(row['image_path'])}, {is_primary});"
    )

# 6. Services
cursor.execute("SELECT * FROM services")
for row in cursor.fetchall():
    statements.append(
        f"INSERT INTO services (id, salon_id, name, description, price, duration_minutes, is_active) "
        f"VALUES ({escape_sql(row['id'])}, {escape_sql(row['salon_id'])}, {escape_sql(row['name'])}, "
        f"{escape_sql(row['description'])}, {escape_sql(row['price'])}, {escape_sql(row['duration_minutes'])}, "
        f"{escape_sql(row['is_active'])});"
    )

# 7. Stylists
cursor.execute("SELECT * FROM stylists")
for row in cursor.fetchall():
    statements.append(
        f"INSERT INTO stylists (id, salon_id, name, title, avatar_url, buffer_time_minutes, is_active) "
        f"VALUES ({escape_sql(row['id'])}, {escape_sql(row['salon_id'])}, {escape_sql(row['name'])}, "
        f"{escape_sql(row['bio'] or 'Stylist')}, {escape_sql(row['photo'])}, "
        f"{escape_sql(row['buffer_time_minutes'] or 15)}, {escape_sql(row['is_active'])});"
    )

# 8. Stylist Services
cursor.execute("SELECT * FROM stylist_services")
for row in cursor.fetchall():
    statements.append(
        f"INSERT INTO stylist_services (id, stylist_id, service_id) "
        f"VALUES ({escape_sql(row['id'])}, {escape_sql(row['stylist_id'])}, {escape_sql(row['service_id'])});"
    )

# 9. Stylist Schedules
cursor.execute("SELECT * FROM stylist_schedules")
for row in cursor.fetchall():
    statements.append(
        f"INSERT INTO stylist_schedules (id, stylist_id, day_of_week, start_time, end_time, is_working) "
        f"VALUES ({escape_sql(row['id'])}, {escape_sql(row['stylist_id'])}, {escape_sql(row['day_of_week'])}, "
        f"{escape_sql(row['start_time'])}, {escape_sql(row['end_time'])}, {escape_sql(row['is_working'])});"
    )

# 10. Schedule Breaks
cursor.execute("SELECT * FROM schedule_breaks")
for row in cursor.fetchall():
    statements.append(
        f"INSERT INTO stylist_breaks (id, schedule_id, start_time, end_time) "
        f"VALUES ({escape_sql(row['id'])}, {escape_sql(row['stylist_schedule_id'])}, "
        f"{escape_sql(row['start_time'])}, {escape_sql(row['end_time'])});"
    )

# 11. Schedule Overrides
cursor.execute("SELECT * FROM schedule_overrides")
for row in cursor.fetchall():
    statements.append(
        f"INSERT INTO schedule_overrides (id, stylist_id, date, is_day_off, start_time, end_time) "
        f"VALUES ({escape_sql(row['id'])}, {escape_sql(row['stylist_id'])}, {escape_sql(row['date'])}, "
        f"{escape_sql(row['is_day_off'])}, {escape_sql(row['start_time'])}, {escape_sql(row['end_time'])});"
    )

# 12. Appointments
cursor.execute("SELECT * FROM appointments")
for row in cursor.fetchall():
    statements.append(
        f"INSERT INTO appointments (id, salon_id, service_id, stylist_id, customer_id, guest_name, guest_email, guest_phone, appointment_date, start_time, end_time, total_price, status, notes, created_at, updated_at) "
        f"VALUES ({escape_sql(row['id'])}, {escape_sql(row['salon_id'])}, {escape_sql(row['service_id'])}, "
        f"{escape_sql(row['stylist_id'])}, {escape_sql(row['user_id'])}, {escape_sql(row['customer_name'])}, "
        f"{escape_sql(row['customer_email'])}, {escape_sql(row['customer_phone'])}, {escape_sql(row['appointment_date'])}, "
        f"{escape_sql(row['start_time'])}, {escape_sql(row['end_time'])}, {escape_sql(row['price'])}, "
        f"{escape_sql(row['status'])}, {escape_sql(row['notes'])}, {escape_sql(row['created_at'])}, "
        f"{escape_sql(row['updated_at'])});"
    )

# 13. Reviews
cursor.execute("SELECT * FROM reviews")
for row in cursor.fetchall():
    statements.append(
        f"INSERT INTO reviews (id, salon_id, customer_id, rating, comment, created_at) "
        f"VALUES ({escape_sql(row['id'])}, {escape_sql(row['salon_id'])}, {escape_sql(row['user_id'])}, "
        f"{escape_sql(row['rating'])}, {escape_sql(row['comment'])}, {escape_sql(row['created_at'])});"
    )

statements.append("PRAGMA foreign_keys = ON;")

os.makedirs("drizzle", exist_ok=True)
with open(output_sql_path, "w", encoding="utf-8") as f:
    f.write("\n".join(statements))

print(f"Migration script completed! Wrote {len(statements)} SQL statements to {output_sql_path}")
conn.close()
