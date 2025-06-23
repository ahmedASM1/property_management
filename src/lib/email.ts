import emailjs from 'emailjs-com';

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || '';
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || '';
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || '';

export function sendInvoiceEmail(toEmail: string, toName: string, invoiceNumber: string) {
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