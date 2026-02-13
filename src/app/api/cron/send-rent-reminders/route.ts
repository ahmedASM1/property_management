import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { sendRentReminderEmailServer } from '@/lib/email';

/**
 * Returns the day-of-month (1–31) that rent is due, derived from contract move-in date.
 * E.g. move-in March 15 → rent due on the 15th of each month.
 */
function getRentDueDayFromMoveInDate(moveInDate: string | undefined): number | null {
  if (!moveInDate) return null;
  const d = new Date(moveInDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDate();
}

/**
 * For a given calendar day, which rent-due-day should receive a reminder today?
 * Reminder is sent 5 days before the due date. So if today is the 10th, we send to tenants whose due day is 15.
 * targetDueDay = (today + 5), wrapping at 31 (e.g. 27+5=32 → 1st of next month).
 */
function getTargetDueDayForToday(): number {
  const day = new Date().getDate();
  const target = day + 5;
  return target > 31 ? target - 31 : target;
}

/**
 * Format the next due date (e.g. "15 April 2025") for the current month/year and given due day.
 */
function formatNextDueDate(dueDay: number): string {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexed
  if (dueDay <= now.getDate()) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  const d = new Date(year, month, dueDay);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Runs daily: send rent reminders only to tenants whose contract due day is exactly 5 days from today.
 * Uses contract moveInDate to determine each tenant's rent due day (e.g. moved in on 15th → due on 15th each month).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  const targetDueDay = getTargetDueDayForToday();

  try {
    const db = getAdminFirestore();

    // 1. Active contracts: tenantId -> rent due day (from moveInDate)
    const contractsSnap = await db.collection('contracts').get();
    const tenantDueDay: Record<string, number> = {};
    contractsSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.status !== 'active') return;
      const tenantId = data.tenantId;
      if (!tenantId) return;
      const dueDay = getRentDueDayFromMoveInDate(data.moveInDate);
      if (dueDay != null) tenantDueDay[tenantId] = dueDay;
    });

    // 2. Today we remind only tenants whose due day matches (today + 5)
    const tenantIdsToRemind = Object.keys(tenantDueDay).filter(
      (tid) => tenantDueDay[tid] === targetDueDay
    );
    if (tenantIdsToRemind.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        reason: `No tenants with rent due on day ${targetDueDay} (reminder day today)`,
        targetDueDay,
        day: today.getDate(),
      });
    }

    // 3. Unpaid invoices per tenant
    const invoicesSnap = await db.collection('invoices').get();
    const unpaidByTenant: Record<string, number> = {};
    invoicesSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.isPaid === true) return;
      const tenantId = data.tenantId;
      if (!tenantId || !tenantIdsToRemind.includes(tenantId)) return;
      const amount = Number(data.totalAmount) || 0;
      unpaidByTenant[tenantId] = (unpaidByTenant[tenantId] || 0) + amount;
    });

    let sent = 0;
    const errors: string[] = [];

    for (const tenantId of tenantIdsToRemind) {
      const userSnap = await db.collection('users').doc(tenantId).get();
      const userData = userSnap.data();
      const email = userData?.email;
      const fullName = userData?.fullName || 'Tenant';
      if (!email) {
        errors.push(`Tenant ${tenantId}: no email`);
        continue;
      }
      const total = unpaidByTenant[tenantId] ?? 0;
      const dueDateFormatted = formatNextDueDate(targetDueDay);
      const result = await sendRentReminderEmailServer(email, fullName, total, dueDateFormatted);
      if (result.ok) sent++;
      else errors.push(`${email}: ${result.error || 'send failed'}`);
    }

    return NextResponse.json({
      ok: true,
      sent,
      totalEligible: tenantIdsToRemind.length,
      targetDueDay,
      dueDateFormatted: formatNextDueDate(targetDueDay),
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    console.error('Cron send-rent-reminders error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
