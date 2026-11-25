import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

async function main() {
  const [rawUsername, password, ...nameParts] = process.argv.slice(2);
  if (!rawUsername || !password || password.length < 8) {
    console.error(
      'Usage: pnpm run create-user <username> <password, 8+ chars> [full name]',
    );
    process.exit(1);
  }
  const username = rawUsername.trim().toLowerCase();
  const fullName = nameParts.join(' ') || username;

  const prisma = new PrismaClient();
  try {
    const passwordHash = await argon2.hash(password);
    const user = await prisma.user.upsert({
      where: { username },
      update: { passwordHash, fullName },
      create: { username, passwordHash, fullName },
    });
    console.log(`User ready: ${user.username} (${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
