import { Schema, model, type InferSchemaType } from 'mongoose';

const favoriteSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    destinationId: { type: Schema.Types.ObjectId, ref: 'Destination', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

favoriteSchema.index({ userId: 1, destinationId: 1 }, { unique: true });
favoriteSchema.index({ userId: 1, createdAt: -1 });

export type Favorite = InferSchemaType<typeof favoriteSchema>;
export const FavoriteModel = model('Favorite', favoriteSchema, 'favorites');
