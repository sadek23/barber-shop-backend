import { drizzle } from 'drizzle-orm/d1';
import { eq, and, ne } from 'drizzle-orm';
import { stylists, services, stylistServices, stylistSchedules, stylistBreaks, scheduleOverrides, appointments } from '../db/schema';

export type TimeSlot = {
  start_time: string;
  end_time: string;
  formatted: string;
};

export async function calculateAvailableSlots(
  db: ReturnType<typeof drizzle>,
  stylistId: number,
  serviceId: number,
  dateStr: string // "YYYY-MM-DD"
): Promise<TimeSlot[]> {
  const stylist = await db.select().from(stylists).where(eq(stylists.id, stylistId)).get();
  const service = await db.select().from(services).where(eq(services.id, serviceId)).get();

  if (!stylist || !service || !stylist.isActive || !service.isActive) {
    return [];
  }

  // Verify stylist supports this service if pivot records exist
  const assignedServices = await db.select().from(stylistServices).where(eq(stylistServices.stylistId, stylistId)).all();
  if (assignedServices.length > 0) {
    const supportsService = assignedServices.some((s) => s.serviceId === serviceId);
    if (!supportsService) return [];
  } else if (stylist.salonId !== service.salonId) {
    return [];
  }

  // Day of week: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const targetDate = new Date(`${dateStr}T00:00:00Z`);
  const dayOfWeek = targetDate.getUTCDay();

  // Check for date override
  const override = await db.select().from(scheduleOverrides)
    .where(and(eq(scheduleOverrides.stylistId, stylistId), eq(scheduleOverrides.date, dateStr)))
    .get();

  let shiftStart: string | null = null;
  let shiftEnd: string | null = null;
  let breaks: Array<{ startTime: string; endTime: string }> = [];

  if (override) {
    if (override.isDayOff) return [];
    shiftStart = override.startTime;
    shiftEnd = override.endTime;
  } else {
    const schedule = await db.select().from(stylistSchedules)
      .where(and(eq(stylistSchedules.stylistId, stylistId), eq(stylistSchedules.dayOfWeek, dayOfWeek)))
      .get();

    if (!schedule || !schedule.isWorking) return [];
    shiftStart = schedule.startTime;
    shiftEnd = schedule.endTime;

    const breakRecords = await db.select().from(stylistBreaks)
      .where(eq(stylistBreaks.scheduleId, schedule.id))
      .all();
    breaks = breakRecords.map((b) => ({ startTime: b.startTime, endTime: b.endTime }));
  }

  if (!shiftStart || !shiftEnd) return [];

  const serviceDuration = service.durationMinutes;
  const bufferMinutes = stylist.bufferTimeMinutes || 15;

  // Existing non-cancelled appointments for this date
  const existingAppts = await db.select().from(appointments)
    .where(and(
      eq(appointments.stylistId, stylistId),
      eq(appointments.appointmentDate, dateStr),
      ne(appointments.status, 'cancelled')
    ))
    .all();

  const parseTimeToMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const formatMinutesToHHMM = (totalMins: number): string => {
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const formatMinutesTo12h = (totalMins: number): string => {
    let h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const shiftStartMins = parseTimeToMinutes(shiftStart);
  let shiftEndMins = parseTimeToMinutes(shiftEnd);

  // Handle overnight shift end
  if (shiftEndMins <= shiftStartMins) {
    shiftEndMins += 24 * 60;
  }

  // Check if today to filter past slots
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const isToday = dateStr === todayStr;
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const slots: TimeSlot[] = [];
  const stepMinutes = 15;

  for (let current = shiftStartMins; current + serviceDuration <= shiftEndMins; current += stepMinutes) {
    const slotStart = current;
    const slotEnd = current + serviceDuration;

    let isValid = true;

    // Filter past slots if date is today
    if (isToday && slotStart <= nowMins) {
      isValid = false;
    }

    // Check break overlaps
    if (isValid) {
      for (const brk of breaks) {
        const breakStart = parseTimeToMinutes(brk.startTime);
        const breakEnd = parseTimeToMinutes(brk.endTime);
        if (slotStart < breakEnd && slotEnd > breakStart) {
          isValid = false;
          break;
        }
      }
    }

    // Check appointment overlaps (including buffer)
    if (isValid) {
      for (const appt of existingAppts) {
        const apptStart = parseTimeToMinutes(appt.startTime);
        const apptEndWithBuffer = parseTimeToMinutes(appt.endTime) + bufferMinutes;
        if (slotStart < apptEndWithBuffer && slotEnd > apptStart) {
          isValid = false;
          break;
        }
      }
    }

    if (isValid) {
      slots.push({
        start_time: formatMinutesToHHMM(slotStart),
        end_time: formatMinutesToHHMM(slotEnd),
        formatted: `${formatMinutesTo12h(slotStart)} - ${formatMinutesTo12h(slotEnd)}`,
      });
    }
  }

  return slots;
}
