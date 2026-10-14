import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
config();
import mongoose from 'mongoose';

/** Local-only helper: ensure known test accounts exist (never commit real secrets). */
async function upsertUser(email: string, displayName: string, role: 'tourist' | 'admin', password: string) {
  const col = mongoose.connection.db!.collection('users');
  const existing = await col.findOne({ email });
  const passwordHash = await bcrypt.hash(password, 12);
  if (!existing) {
    await col.insertOne({
      email,
      displayName,
      role,
      status: 'active',
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('created', role, email);
    return;
  }
  await col.updateOne(
    { email },
    { $set: { displayName, role, status: 'active', passwordHash, updatedAt: new Date() } },
  );
  console.log('updated', role, email);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI missing');
  await mongoose.connect(uri);

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 10) {
    throw new Error('SEED_ADMIN_PASSWORD trong server/.env cần ≥ 10 ký tự');
  }

  await upsertUser(adminEmail, process.env.SEED_ADMIN_NAME || 'Quản trị viên', 'admin', adminPassword);
  await upsertUser('tourist@example.com', 'Du khách thử nghiệm', 'tourist', 'TestTourist1!');

  console.log('\n--- Tài khoản test ---');
  console.log('Admin :', adminEmail, '/', adminPassword);
  console.log('Tourist:', 'tourist@example.com', '/', 'TestTourist1!');
  console.log('Đăng nhập: http://localhost:5173/login');
  console.log('Admin UI : http://localhost:5173/admin/login');

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
