import { PrismaClient } from '@prisma/client';

const teardown = async () => {
  if (!process.env.DATABASE_URL?.trim()) {
    return;
  }

  const prisma = new PrismaClient();
  try {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> '_prisma_migrations'
    `;

    if (tables.length > 0) {
      const tableList = tables
        .map((row) => `"${row.tablename.replaceAll('"', '""')}"`)
        .join(', ');
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`);
    }
  } finally {
    await prisma.$disconnect();
  }
};

export default teardown;
