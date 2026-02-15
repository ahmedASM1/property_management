/**
 * Branded HTML email templates for Green Bridge.
 * Uses your domain (NEXT_PUBLIC_APP_URL, MAIL_SUPPORT_EMAIL) for links and footer.
 * Set MAIL_FROM_EMAIL / MAIL_FROM_NAME (or provider-specific vars) to send from your domain.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://greenbridge-my.com';
const SUPPORT_EMAIL = process.env.MAIL_SUPPORT_EMAIL || 'info@greenbridge-my.com';
const BRAND_COLOR = '#059669';
const BRAND_COLOR_DARK = '#047857';

function emailFooter(): string {
  const year = new Date().getFullYear();
  return `
    <div style="background-color: #111827; color: #9ca3af; padding: 24px 32px; text-align: center; font-size: 12px; font-family: 'Segoe UI', Arial, sans-serif;">
      <p style="margin: 0; font-weight: 600; color: #e5e7eb;">Green Bridge</p>
      <p style="margin: 4px 0 0 0;">Property Management</p>
      <p style="margin: 12px 0 0 0;">
        <a href="mailto:${SUPPORT_EMAIL}" style="color: #60a5fa;">${SUPPORT_EMAIL}</a>
        &nbsp;·&nbsp;
        <a href="${APP_URL}" style="color: #60a5fa;">${APP_URL.replace(/^https?:\/\//, '')}</a>
      </p>
      <p style="margin: 8px 0 0 0; opacity: 0.8;">&copy; ${year} Green Bridge. All rights reserved.</p>
    </div>
  `.trim();
}

function emailHeader(title: string, subtitle?: string): string {
  return `
    <div style="background: linear-gradient(135deg, ${BRAND_COLOR} 0%, ${BRAND_COLOR_DARK} 100%); color: white; padding: 28px 32px; text-align: center; font-family: 'Segoe UI', Arial, sans-serif;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em;">Green Bridge</h1>
      ${subtitle ? `<p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.95;">${subtitle}</p>` : ''}
      ${title ? `<p style="margin: 12px 0 0 0; font-size: 13px; opacity: 0.9;">${title}</p>` : ''}
    </div>
  `.trim();
}

/**
 * Verification email – used after registration. Link verifies email; then account is pending admin approval.
 */
export function getVerificationEmailHtml(fullName: string, verifyLink: string, expiryHours = 24): string {
  const greeting = fullName ? `Hello ${fullName},` : 'Hello,';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Verify your email – Green Bridge</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', system-ui, Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.07); border-radius: 0 0 12px 12px; overflow: hidden;">
    ${emailHeader('Verify your email address')}
    <div style="padding: 32px;">
      <p style="color: #111827; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">${greeting}</p>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Thank you for registering with Green Bridge. Please verify your email by clicking the button below. Once verified, your account will be pending admin approval before you can sign in.
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${verifyLink}" style="background: linear-gradient(135deg, ${BRAND_COLOR} 0%, ${BRAND_COLOR_DARK} 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">Verify email address</a>
      </div>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 24px 0 0 0;">
        If the button doesn’t work, copy and paste this link into your browser:
      </p>
      <p style="margin: 8px 0 0 0; word-break: break-all;">
        <a href="${verifyLink}" style="color: ${BRAND_COLOR}; font-size: 14px;">${verifyLink}</a>
      </p>
      <p style="color: #6b7280; font-size: 13px; margin: 24px 0 0 0;">
        This link expires in ${expiryHours} hours. If you didn’t create an account with Green Bridge, you can ignore this email.
      </p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>
  `.trim();
}

/**
 * Password reset email – link to set a new password.
 */
export function getPasswordResetEmailHtml(fullName: string, resetLink: string, expiryHours = 24): string {
  const greeting = fullName ? `Hello ${fullName},` : 'Hello,';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Reset your password – Green Bridge</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', system-ui, Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.07); border-radius: 0 0 12px 12px; overflow: hidden;">
    ${emailHeader('Reset your password')}
    <div style="padding: 32px;">
      <p style="color: #111827; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">${greeting}</p>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        You requested to reset your password for your Green Bridge account. Click the button below to set a new password.
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetLink}" style="background: linear-gradient(135deg, ${BRAND_COLOR} 0%, ${BRAND_COLOR_DARK} 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">Reset password</a>
      </div>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 24px 0 0 0;">
        If the button doesn’t work, copy and paste this link into your browser:
      </p>
      <p style="margin: 8px 0 0 0; word-break: break-all;">
        <a href="${resetLink}" style="color: ${BRAND_COLOR}; font-size: 14px;">${resetLink}</a>
      </p>
      <p style="color: #6b7280; font-size: 13px; margin: 24px 0 0 0;">
        This link expires in ${expiryHours} hours. If you didn’t request a password reset, you can ignore this email.
      </p>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>
  `.trim();
}
