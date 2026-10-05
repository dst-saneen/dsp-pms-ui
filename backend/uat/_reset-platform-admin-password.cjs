/**
 * Reset platform admin password to UAT_DEFAULT_PASSWORD from .env.uat
 * and clear lockout counters.
 */
const { resolve } = require('node:path');
const { config } = require('dotenv');

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.uat'), override: true });

async function main() {
  const { loadUatEnv } = require('../dist/uat/lib/safety.js');
  const { createUatPrisma } = require('../dist/uat/lib/prisma-client.js');
  const { hashUatPassword } = require('../dist/uat/lib/password.js');
  const { normalizeIdentity } = require('../dist/uat/lib/normalize.js');
  const { UserStatus } = require('@prisma/client');

  const env = loadUatEnv();
  const handle = createUatPrisma(env);
  const username = env.platformAdminUsername;
  const normalizedUsername = normalizeIdentity(username);

  try {
    const user = await handle.prisma.user.findUnique({
      where: { normalizedUsername },
    });
    if (!user) {
      throw new Error(`User not found: ${username}`);
    }

    const passwordHash = await hashUatPassword(env.defaultPassword);
    const updated = await handle.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        status: UserStatus.ACTIVE,
        failedLoginAttempts: 0,
        lockedUntil: null,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
      select: {
        username: true,
        email: true,
        status: true,
        failedLoginAttempts: true,
        mustChangePassword: true,
      },
    });

    console.log('Password reset OK for:');
    console.log(`  username: ${updated.username}`);
    console.log(`  email:    ${updated.email}`);
    console.log(`  status:   ${updated.status}`);
    console.log(
      'Use the same password as UAT_DEFAULT_PASSWORD in backend/.env.uat',
    );
  } finally {
    await handle.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
