import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Generate a 6-digit verification code
export function generateVerificationCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const code = (array[0] % 1000000).toString().padStart(6, '0');
  return code;
}

// Send verification email via Nodemailer + Gmail
export async function sendVerificationEmail(
  email: string,
  code: string,
  pollTitleOrLocale: string,
  locale?: string
): Promise<{ success: boolean; error?: string }> {
  // Handle both (email, code, pollTitle, locale) and (email, code, locale) signatures
  const hasPollTitle = locale !== undefined;
  const pollTitle = hasPollTitle ? pollTitleOrLocale : null;
  const actualLocale = hasPollTitle ? locale : pollTitleOrLocale;
  const isJa = actualLocale === 'ja';

  const subject = isJa
    ? `[Beaver] メール認証コード: ${code}`
    : `[Beaver] Your verification code: ${code}`;

  const contextText = pollTitle
    ? (isJa
        ? `「<strong>${escapeHtml(pollTitle)}</strong>」への回答に以下の認証コードを使用してください：`
        : `Use the following code to verify your email for the poll "<strong>${escapeHtml(pollTitle)}</strong>":`)
    : (isJa
        ? `投票を作成するために以下の認証コードを使用してください：`
        : `Use the following code to verify your email and create your poll:`);

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>${isJa ? 'Beaver メール認証' : 'Beaver Email Verification'}</h2>
      <p>${contextText}</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; letter-spacing: 8px; font-weight: bold;">${code}</span>
      </div>
      <p style="color: #6b7280; font-size: 14px;">${isJa ? 'このコードは10分間有効です。' : 'This code expires in 10 minutes.'}</p>
      <p style="color: #6b7280; font-size: 14px;">${isJa ? 'このメールに心当たりがない場合は無視してください。' : "If you didn't request this, you can safely ignore this email."}</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject,
      html,
    });

    return { success: true };
  } catch (err) {
    console.error('Failed to send verification email:', err);
    const message = err instanceof Error ? err.message : 'Failed to send email';
    return { success: false, error: message };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
