// Checks the log-in and sign-up forms before anything touches the database.

export const PASSWORD_MIN = 8;
const USERNAME_MAX = 30;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

// Only plain text is accepted. A JSON body can also hold objects like { "$gt": "" },
// which MongoDB would read as a query operator instead of an email (NoSQL injection).
const text = (v: unknown) => (typeof v === 'string' ? v : '');

// Emails are stored in lower case, so "Mia@Example.com" and "mia@example.com" are the same account.
const normalizeEmail = (v: unknown) => text(v).trim().toLowerCase();

// A simple shape check: something@something.something, no spaces
const looksLikeEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Invite codes are 8 capital letters and numbers, e.g. "A3BF92C1" (made in routes/groups.ts)
export function normalizeInviteCode(v: unknown): string | null {
  const code = text(v).trim().toUpperCase();
  return /^[A-Z0-9]{8}$/.test(code) ? code : null;
}

export function checkRegister(body: unknown): Result<{ email: string; password: string; username: string }> {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = normalizeEmail(b.email);
  const password = text(b.password);
  const username = text(b.username).trim();

  if (!email || !password || !username) return { ok: false, error: 'Please fill in all fields' };
  if (!looksLikeEmail(email)) return { ok: false, error: 'Please enter a valid email address' };
  if (username.length > USERNAME_MAX) return { ok: false, error: `Your name can be at most ${USERNAME_MAX} characters` };
  if (password.length < PASSWORD_MIN) return { ok: false, error: `Password must be at least ${PASSWORD_MIN} characters` };
  return { ok: true, value: { email, password, username } };
}

export function checkPasswordChange(body: unknown): Result<{ currentPassword: string; newPassword: string }> {
  const b = (body ?? {}) as Record<string, unknown>;
  const currentPassword = text(b.currentPassword);
  const newPassword = text(b.newPassword);

  if (!currentPassword || !newPassword) return { ok: false, error: 'Please fill in both passwords' };
  if (newPassword.length < PASSWORD_MIN) return { ok: false, error: `Password must be at least ${PASSWORD_MIN} characters` };
  if (newPassword === currentPassword) return { ok: false, error: 'The new password must be different from the current one' };
  return { ok: true, value: { currentPassword, newPassword } };
}

export function checkLogin(body: unknown): Result<{ email: string; password: string }> {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = normalizeEmail(b.email);
  const password = text(b.password);

  if (!email || !password) return { ok: false, error: 'Please enter your email and password' };
  return { ok: true, value: { email, password } };
}
