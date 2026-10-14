import { Handshake, Landmark, Leaf, ScrollText, Trees, UtensilsCrossed, type LucideProps } from 'lucide-react';
import type { Category } from '../../types/api';

const icons: Record<Category, typeof Trees> = {
  nature: Trees,
  eco: Leaf,
  culture: Landmark,
  history: ScrollText,
  food: UtensilsCrossed,
  local_experience: Handshake,
};

export function CategoryIcon({ category, ...props }: { category: Category | null | undefined } & LucideProps) {
  const Icon = (category && icons[category]) || Leaf;
  return <Icon aria-hidden {...props} />;
}
