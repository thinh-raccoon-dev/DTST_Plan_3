import { normalizeText } from '../utils/text.js';
import type { Area, Category } from '../config/catalog.js';

export interface Recommendable {
  id: string;
  category: Category;
  area: Area;
  tags: string[];
}

export interface RecommendProfile {
  categories: Partial<Record<Category, number>>;
  areas: Partial<Record<Area, number>>;
  tags: string[];
}

/** Content-based overlap: category, area, and shared tags. Deterministic and explainable. */
export function contentScore(profile: RecommendProfile, candidate: Recommendable): number {
  let score = 0;
  score += profile.categories[candidate.category] ?? 0;
  score += profile.areas[candidate.area] ?? 0;
  const candidateTags = new Set(candidate.tags.map(normalizeText).filter(Boolean));
  for (const tag of profile.tags) {
    if (candidateTags.has(tag)) score += 1;
  }
  return score;
}

export function profileFromDestination(d: Recommendable): RecommendProfile {
  return {
    categories: { [d.category]: 3 },
    areas: { [d.area]: 2 },
    tags: d.tags.map(normalizeText).filter(Boolean).slice(0, 8),
  };
}

export function mergeProfiles(parts: RecommendProfile[]): RecommendProfile {
  const categories: Partial<Record<Category, number>> = {};
  const areas: Partial<Record<Area, number>> = {};
  const tags = new Set<string>();
  for (const part of parts) {
    for (const [key, value] of Object.entries(part.categories) as Array<[Category, number]>) {
      categories[key] = (categories[key] ?? 0) + value;
    }
    for (const [key, value] of Object.entries(part.areas) as Array<[Area, number]>) {
      areas[key] = (areas[key] ?? 0) + value;
    }
    for (const tag of part.tags) tags.add(tag);
  }
  return { categories, areas, tags: [...tags].slice(0, 16) };
}

export function rankByContent<T extends Recommendable>(
  candidates: T[],
  profile: RecommendProfile,
  limit: number,
  excludeIds: Iterable<string> = [],
): Array<T & { relevance: number }> {
  const excluded = new Set(excludeIds);
  return candidates
    .filter((c) => !excluded.has(c.id))
    .map((c) => ({ ...c, relevance: contentScore(profile, c) }))
    .filter((c) => c.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance || a.id.localeCompare(b.id))
    .slice(0, limit);
}
