import emailjs from 'emailjs-com';

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || '';
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || '';
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || '';

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(params: EmailParams) {
  try {
    // For now, log the email instead of sending (you can integrate with a real email service)
    console.log('Sending email:', params);
    
    // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
    // For EmailJS, you would need to send the HTML content through their service
    // This is a placeholder implementation
    return Promise.resolve({ success: true });
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

export function sendInvoiceEmail(toEmail: string, toName: string, invoiceNumber: string) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    return Promise.resolve({ status: 200, text: 'skipped' });
  }
  return emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      to_email: toEmail,
      to_name: toName,
      invoice_number: invoiceNumber,
    },
    PUBLIC_KEY
  );
}

export function sendPaymentReminderEmail(toEmail: string, toName: string, outstandingAmount: number) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    return Promise.resolve({ status: 200, text: 'skipped' });
  }
  return emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      to_email: toEmail,
      to_name: toName,
      outstanding_amount: outstandingAmount,
    },
    PUBLIC_KEY
  );
}

/** Server-side: send rent reminder via EmailJS REST API (for cron). Uses RENT REMINDER template only – does not use contact/invoice EmailJS config. */
export async function sendRentReminderEmailServer(
  toEmail: string,
  toName: string,
  outstandingAmount: number,
  dueDateFormatted?: string
): Promise<{ ok: boolean; error?: string }> {
  const serviceId = process.env.EMAILJS_RENT_REMINDER_SERVICE_ID || '';
  const templateId = process.env.EMAILJS_RENT_REMINDER_TEMPLATE_ID || '';
  const userId = process.env.EMAILJS_RENT_REMINDER_PUBLIC_KEY || process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || process.env.EMAILJS_PUBLIC_KEY || '';
  const privateKey = process.env.EMAILJS_RENT_REMINDER_PRIVATE_KEY || process.env.EMAILJS_PRIVATE_KEY || '';
  if (!serviceId || !templateId || !userId) {
    console.warn('Rent reminder EmailJS not configured (EMAILJS_RENT_REMINDER_*); skipping reminder to', toEmail);
    return { ok: false, error: 'Rent reminder EmailJS not configured' };
  }
  if (!privateKey) {
    return { ok: false, error: 'API calls in strict mode require a private key. Add EMAILJS_RENT_REMINDER_PRIVATE_KEY (or EMAILJS_PRIVATE_KEY) to .env.local. Get it from EmailJS Dashboard → Account → Security.' };
  }
  try {
    const payload: Record<string, unknown> = {
      service_id: serviceId,
      template_id: templateId,
      user_id: userId,
      accessToken: privateKey,
      template_params: {
        to_email: toEmail,
        to_name: toName,
        outstanding_amount: outstandingAmount,
        due_date: dueDateFormatted || '',
      },
    };
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: text };
    }
    return { ok: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return { ok: false, error: err };
  }
} 