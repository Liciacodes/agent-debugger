export interface LoginResult {
  ok: boolean;
  error?: string;
}

const users = [
  { email: "ada@example.com", password: "correct-horse" },
  { email: "lin@example.com", password: "battery-staple" },
];

export function login(email: string, password: string): LoginResult {
  const user = users.find((candidate) => candidate.email === email);

  if (!user || user.password !== password) {
    return { ok: false, error: "Invalid email or password" };
  }

  return { ok: true };
}
