import { describe, expect, it } from 'vitest';
import { profileFromDestination, rankByContent } from '../src/services/recommend.service.js';

describe('content ranking', () => {
  it('prefers shared category, area and tags', () => {
    const seed = { id: 'a', category: 'culture' as const, area: 'sa-dec' as const, tags: ['hoa'] };
    const ranked = rankByContent(
      [
        { id: 'b', category: 'culture', area: 'cao-lanh', tags: ['hoa'] },
        { id: 'c', category: 'nature', area: 'tam-nong', tags: [] },
        { id: 'd', category: 'culture', area: 'sa-dec', tags: [] },
      ],
      profileFromDestination(seed),
      3,
      ['a'],
    );
    expect(ranked.map((r) => r.id)).toEqual(['d', 'b']);
    expect(ranked[0]!.relevance).toBeGreaterThan(ranked[1]!.relevance);
  });
});
