import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import mongoose from 'mongoose';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), 'server/.env') });

/**
 * Upsert demo accounts from env (passwords never belong in source).
 *
 *   DEMO_ADMIN_EMAIL=... DEMO_ADMIN_PASSWORD=... \
 *   DEMO_TOURIST_EMAIL=... DEMO_TOURIST_PASSWORD=... \
 *   npx tsx src/scripts/upsert-demo-users.ts
 */
async function upsertUser(email: string, displayName: string, role: 'tourist' | 'admin', password: string) {
  const col = mongoose.connection.db!.collection('users');
  const normalized = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await col.findOne({ email: normalized });
  const fields = {
    email: normalized,
    displayName,
    role,
    status: 'active' as const,
    passwordHash,
    updatedAt: new Date(),
  };
  if (!existing) {
    await col.insertOne({ ...fields, createdAt: new Date() });
    console.log('created', role, normalized);
    return;
  }
  await col.updateOne({ email: normalized }, { $set: fields });
  console.log('updated', role, normalized);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Thiếu MONGODB_URI');

  const adminEmail = process.env.DEMO_ADMIN_EMAIL?.trim();
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD;
  const touristEmail = process.env.DEMO_TOURIST_EMAIL?.trim();
  const touristPassword = process.env.DEMO_TOURIST_PASSWORD;
  if (!adminEmail || !adminPassword || !touristEmail || !touristPassword) {
    throw new Error('Cần DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD, DEMO_TOURIST_EMAIL, DEMO_TOURIST_PASSWORD');
  }

  await mongoose.connect(uri);
  await upsertUser(adminEmail, 'Quản trị viên 1', 'admin', adminPassword);
  await upsertUser(touristEmail, 'Khách 1', 'tourist', touristPassword);
  await mongoose.disconnect();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
