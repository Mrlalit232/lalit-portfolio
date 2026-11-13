/**
 * Administrator account CLI. Credentials are typed into the terminal prompt only.
 * They are never read from environment variables, files, flags or chat.
 *
 *   npm run admin:create          create an administrator
 *   npm run admin:reset-password  recovery: set a new password (revokes all sessions)
 *   npm run admin:reset-2fa       recovery: turn off two-factor authentication for an account
 *
 * Needs database access (DATABASE_URL, or the local embedded database in development),
 * so only someone who controls the infrastructure can run it.
 */
import { createDb, runMigrations } from "../db/client";
import { checkPasswordStrength } from "../lib/auth/password";
import { createAdminUser, findUserByEmail, setUserPassword } from "../lib/auth/users";
import { adminResetTwoFactor } from "../lib/auth/twofactor";
import { ask, askHidden, requireTty } from "./prompt";

async function readNewPassword(email: string) {
  for (;;) {
    const password = await askHidden("New password (min 12 characters, hidden): ");
    const weak = checkPasswordStrength(password, email);
    if (weak) {
      console.log(weak);
      continue;
    }
    if (password !== (await askHidden("Repeat password: "))) {
      console.log("Passwords do not match. Try again.");
      continue;
    }
    return password;
  }
}

async function main() {
  const command = process.argv[2];
  if (command !== "create" && command !== "reset-password" && command !== "reset-2fa") {
    console.error("Usage: admin.ts <create|reset-password|reset-2fa>");
    process.exit(1);
  }
  requireTty();

  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || undefined;
  const handle = await createDb({ url });
  await runMigrations(handle);
  console.log(`Database: ${handle.kind === "neon" ? "hosted Neon" : "local embedded"}`);

  try {
    const email = await ask("Administrator email: ");
    if (command === "create") {
      const name = await ask("Display name (optional): ");
      const password = await readNewPassword(email);
      const user = await createAdminUser(handle.db, { email, password, name: name || undefined });
      console.log(`Created administrator ${user.email}. You can now sign in at /admin/login.`);
    } else if (command === "reset-2fa") {
      const done = await adminResetTwoFactor(handle.db, email);
      if (!done) throw new Error("No account with that email.");
      console.log("Two-factor authentication was turned off for that account. Sign in with your password, then set it up again.");
    } else {
      const user = await findUserByEmail(handle.db, email);
      if (!user) throw new Error("No account with that email.");
      const password = await readNewPassword(email);
      await setUserPassword(handle.db, user.id, password);
      console.log("Password updated. All existing sessions were signed out.");
    }
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
