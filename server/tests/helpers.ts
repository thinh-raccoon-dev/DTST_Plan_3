import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { connectDatabase } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { AnalyticsEventModel } from '../src/models/AnalyticsEvent.js';
import { BannerModel } from '../src/models/Banner.js';
import { ChallengeModel } from '../src/models/Challenge.js';
import { DestinationModel } from '../src/models/Destination.js';
import { FavoriteModel } from '../src/models/Favorite.js';
import { ItineraryModel } from '../src/models/Itinerary.js';
import { PassportEntryModel } from '../src/models/PassportEntry.js';
import { QrCodeModel } from '../src/models/QrCode.js';
import { UserModel, type UserRole } from '../src/models/User.js';

export const app = createApp();

const models = [
  UserModel,
  DestinationModel,
  ChallengeModel,
  QrCodeModel,
  PassportEntryModel,
  FavoriteModel,
  ItineraryModel,
  AnalyticsEventModel,
  BannerModel,
];

/** Connects to the dedicated test database and wipes it before each test. */
export function useTestDatabase() {
  beforeAll(async () => {
    if (!/_test$/.test(new URL(env.mongoUri).pathname)) {
      throw new Error(`Refusing to run tests against non-test database: ${env.mongoUri}`);
    }
    await connectDatabase(env.mongoUri);
    await mongoose.connection.dropDatabase();
    await Promise.all(models.map((model) => model.createIndexes()));
  });
  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });
}

export type TestClient = Awaited<ReturnType<typeof newClient>>;

/** A cookie-keeping browser-like client that sends the CSRF header on mutating requests. */
export async function newClient() {
  const agent = request.agent(app);
  const res = await agent.get('/api/v1/csrf');
  const token = res.body.csrfToken as string;
  return {
    agent,
    get: (url: string) => agent.get(url),
    post: (url: string, body: object = {}) => agent.post(url).set('x-csrf-token', token).send(body),
    put: (url: string, body: object = {}) => agent.put(url).set('x-csrf-token', token).send(body),
    patch: (url: string, body: object = {}) => agent.patch(url).set('x-csrf-token', token).send(body),
    delete: (url: string) => agent.delete(url).set('x-csrf-token', token),
  };
}

export async function createUser(role: UserRole = 'tourist', email = `${role}-${Date.now()}-${Math.random()}@test.local`) {
  const password = 'Secret-password-1';
  const user = await UserModel.create({
    email,
    displayName: role === 'admin' ? 'Admin Test' : role === 'partner' ? 'Đối tác Test' : 'Du khách Test',
    role,
    passwordHash: await bcrypt.hash(password, 4),
  });
  return { user, email, password };
}

export async function loggedInClient(role: UserRole = 'tourist') {
  const { user, email, password } = await createUser(role);
  const client = await newClient();
  const res = await client.post('/api/v1/auth/login', { email, password });
  if (res.status !== 200) throw new Error(`Login failed: ${res.status}`);
  return { client, user };
}

export async function createDestination(overrides: Record<string, unknown> = {}) {
  const doc = new DestinationModel({
    name: 'Điểm thử nghiệm',
    slug: `diem-${Math.random().toString(36).slice(2, 8)}`,
    description: 'Mô tả thử nghiệm đủ dài cho kiểm thử tự động.',
    category: 'nature',
    area: 'cao-lanh',
    publicationStatus: 'published',
    ...overrides,
  });
  await doc.save();
  return doc;
}

export async function createChallenge(destinationId: mongoose.Types.ObjectId, overrides: Record<string, unknown> = {}) {
  return ChallengeModel.create({
    destinationId,
    title: 'Thử thách thử nghiệm',
    questions: [
      { prompt: 'Câu hỏi thứ nhất?', options: ['A', 'B', 'C'], correctOptionIndex: 1, explanation: 'Giải thích 1' },
      { prompt: 'Câu hỏi thứ hai?', options: ['A', 'B'], correctOptionIndex: 0 },
    ],
    scoringRules: { rewardPoints: 50, minCorrect: 2 },
    status: 'active',
    ...overrides,
  });
}

export async function createQr(targetId: mongoose.Types.ObjectId, overrides: Record<string, unknown> = {}) {
  return QrCodeModel.create({
    code: `T-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    label: 'QR thử nghiệm',
    targetType: 'destination',
    targetId,
    status: 'active',
    ...overrides,
  });
}

export function correctAnswers(challenge: Awaited<ReturnType<typeof createChallenge>>) {
  return challenge.questions.map((q) => ({ questionId: String(q._id), optionIndex: q.correctOptionIndex }));
}
