import { useEffect, useState } from 'react';
import { Crown, Eye, Flame, Sparkles, Swords } from 'lucide-react';
import { getDeityImageUrl } from '../data/deityImages';
import { PANTHEON_THEMES } from '../theme/pantheons';
import type { MythCard, Pantheon, Passive, Realm, StatKey } from '../types/game';

export function RealmIcon({
  realm,
  className = 'w-4 h-4',
}: {
  realm: Realm;
  className?: string;
}) {
  if (realm === 'SKY') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (realm === 'NETHER') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path
          d="M12 3a9 9 0 1 0 8.5 11.9A7 7 0 0 1 12 3Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M9 17h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (realm === 'SEA') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path
          d="M3 10c2.2 0 2.2-2 4.5-2s2.3 2 4.5 2 2.3-2 4.5-2 2.3 2 4.5 2M3 15c2.2 0 2.2-2 4.5-2s2.3 2 4.5 2 2.3-2 4.5-2 2.3 2 4.5 2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M5 19L19 5M15 5h4v4M5 5l14 14M9 5H5v4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StatIcon({
  stat,
  className = 'w-4 h-4',
}: {
  stat: StatKey;
  className?: string;
}) {
  if (stat === 'might') return <Swords className={className} aria-hidden="true" />;
  if (stat === 'arcana') return <Sparkles className={className} aria-hidden="true" />;
  if (stat === 'cunning') return <Eye className={className} aria-hidden="true" />;
  return <Crown className={className} aria-hidden="true" />;
}

export function PassiveIcon({
  passive,
  className = 'w-3.5 h-3.5',
}: {
  passive: Passive;
  className?: string;
}) {
  if (passive === 'PIERCING') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path
          d="M12 3l4 7-4 11-4-11 4-7Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (passive === 'PROPHECY') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path
          d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      </svg>
    );
  }
  if (passive === 'RESURRECTION') {
    return <Flame className={className} aria-hidden="true" />;
  }
  return null;
}

export function PantheonCrest({
  pantheon,
  size = 'md',
}: {
  pantheon: Pantheon;
  domain?: Realm;
  size?: 'sm' | 'md' | 'lg';
}) {
  const theme = PANTHEON_THEMES[pantheon];
  const stroke = theme.accentHex;
  const heightClass = size === 'lg' ? 'h-28' : size === 'sm' ? 'h-14' : 'h-20';

  return (
    <svg
      viewBox="0 0 140 84"
      fill="none"
      className={`w-full ${heightClass}`}
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2"
        width="136"
        height="80"
        rx="8"
        stroke={stroke}
        strokeOpacity="0.28"
        strokeWidth="1.2"
      />
      <circle cx="70" cy="42" r="28" stroke={stroke} strokeOpacity="0.16" strokeWidth="1" strokeDasharray="3 3" />
      {pantheon === 'Greek' && (
        <g stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M72 15L58 43h12l-4 25 18-31H70l2-22Z" fill={stroke} fillOpacity="0.16" />
          <path d="M36 62c-8-10-8-30 4-40M104 62c8-10 8-30-4-40" strokeOpacity="0.55" />
        </g>
      )}
      {pantheon === 'Norse' && (
        <g stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M70 14v56M50 28l40 28M90 28L50 56" />
          <polygon points="70,14 88,42 70,70 52,42" fill={stroke} fillOpacity="0.12" />
        </g>
      )}
      {pantheon === 'Hindu' && (
        <g stroke={stroke} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="70" cy="42" r="19" fill={stroke} fillOpacity="0.12" />
          <circle cx="70" cy="42" r="6" />
          <path d="M70 15v10M70 59v10M43 42h10M87 42h10M51 23l7 7M82 54l7 7M89 23l-7 7M58 54l-7 7" />
        </g>
      )}
      {pantheon === 'Egyptian' && (
        <g stroke={stroke} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M36 42c10-13 24-19 34-19s24 6 34 19c-10 13-24 19-34 19s-24-6-34-19Z" fill={stroke} fillOpacity="0.14" />
          <circle cx="70" cy="42" r="8.5" />
          <path d="M70 51v16M61 62h18" />
        </g>
      )}
      {pantheon === 'Japanese' && (
        <g stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M38 25c20 5 44 5 64 0M44 35h52M54 27v39M86 27v39" />
          <circle cx="70" cy="50" r="8" fill={stroke} fillOpacity="0.16" strokeWidth="1.6" />
        </g>
      )}
      {pantheon === 'Celtic' && (
        <g stroke={stroke} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="70" cy="42" r="22" strokeOpacity="0.35" />
          <circle cx="70" cy="30" r="9.5" fill={stroke} fillOpacity="0.12" />
          <circle cx="59.5" cy="49" r="9.5" fill={stroke} fillOpacity="0.12" />
          <circle cx="80.5" cy="49" r="9.5" fill={stroke} fillOpacity="0.12" />
        </g>
      )}
      {pantheon === 'Mesoamerican' && (
        <g stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="70,15 95,42 70,69 45,42" fill={stroke} fillOpacity="0.14" />
          <rect x="60" y="32" width="20" height="20" />
          <circle cx="70" cy="42" r="3.5" fill={stroke} />
        </g>
      )}
    </svg>
  );
}

export function DeityArt({
  card,
  size = 'md',
}: {
  card: MythCard;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [imgError, setImgError] = useState(false);
  const src = getDeityImageUrl(card.id);

  useEffect(() => {
    setImgError(false);
  }, [card.id]);

  if (!src || imgError) {
    return <PantheonCrest pantheon={card.pantheon} domain={card.domain} size={size} />;
  }

  return (
    <img
      src={src}
      alt={`${card.name} artwork`}
      loading="lazy"
      onError={() => setImgError(true)}
      className="max-h-full max-w-full w-auto h-auto object-contain bg-transparent select-none pointer-events-none"
    />
  );
}

export function getRealmLabel(realm: Realm): string {
  switch (realm) {
    case 'SKY':
      return 'Sky';
    case 'NETHER':
      return 'Nether';
    case 'SEA':
      return 'Sea';
    case 'WAR':
      return 'War';
  }
}

export function getPassiveLabel(passive: Passive): string {
  switch (passive) {
    case 'PIERCING':
      return 'Piercing';
    case 'PROPHECY':
      return 'Prophecy';
    case 'RESURRECTION':
      return 'Resurrection';
    case 'NONE':
      return 'No Passive';
  }
}

export function getPassiveSummary(passive: Passive): string {
  switch (passive) {
    case 'PIERCING':
      return 'Ignores all opponents’ realm bonuses';
    case 'PROPHECY':
      return 'Reveals 1 stat of a chosen opponent';
    case 'RESURRECTION':
      return 'Returns to deck bottom on first loss';
    case 'NONE':
      return 'Pure deity clash';
  }
}
