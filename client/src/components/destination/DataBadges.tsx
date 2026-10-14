import { BadgeCheck, FlaskConical, ShieldQuestion } from 'lucide-react';
import { VERIFICATION_LEVEL_LABELS, VERIFICATION_STATUS_LABELS } from '../../lib/catalog';
import type { VerificationLevel, VerificationStatus } from '../../types/api';
import { Badge } from '../ui/Badge';

export function IllustrativeBadge() {
  return (
    <Badge tone="lotus" icon={<FlaskConical className="size-3" aria-hidden />}>
      Dữ liệu minh họa
    </Badge>
  );
}

export function VerificationStatusBadge({ status }: { status: VerificationStatus }) {
  if (status === 'verified') {
    return (
      <Badge tone="leaf" icon={<BadgeCheck className="size-3" aria-hidden />}>
        {VERIFICATION_STATUS_LABELS.verified}
      </Badge>
    );
  }
  return (
    <Badge tone={status === 'partially_verified' ? 'lotus' : 'neutral'} icon={<ShieldQuestion className="size-3" aria-hidden />}>
      {VERIFICATION_STATUS_LABELS[status]}
    </Badge>
  );
}

export function VerificationLevelTag({ level }: { level: VerificationLevel }) {
  const tone = level === 'verified' ? 'leaf' : level === 'unverified' ? 'lotus' : 'neutral';
  return <Badge tone={tone}>{VERIFICATION_LEVEL_LABELS[level]}</Badge>;
}
