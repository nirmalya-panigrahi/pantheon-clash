import type { Pantheon, Passive, Realm } from '../types/game';

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
  if (realm === 'UNDERWORLD') {
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

export function PassiveIcon({
  passive,
  className = 'w-4 h-4',
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
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path
          d="M12 4v6m0-6-3 3m3-3 3 3M6 13a6 6 0 1 0 12 0"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return null;
}

export function PantheonCrest({
  pantheon,
  domain,
}: {
  pantheon: Pantheon;
  domain: Realm;
}) {
  const accentMap: Record<Realm, string> = {
    SKY: '#B45309',
    UNDERWORLD: '#5B21B6',
    SEA: '#0369A1',
    WAR: '#B91C1C',
  };
  const stroke = accentMap[domain];

  return (
    <svg
      viewBox="0 0 120 72"
      fill="none"
      className="w-full h-16"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="118"
        height="70"
        rx="6"
        stroke={stroke}
        strokeOpacity="0.22"
        strokeWidth="1"
      />
      {pantheon === 'Greek' && (
        <g stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M62 14L50 38h11l-3 20 14-26H60l2-18Z" fill={stroke} fillOpacity="0.14" />
          <path d="M34 52c-6-8-6-22 2-30M86 52c6-8 6-22-2-30" strokeOpacity="0.55" />
        </g>
      )}
      {pantheon === 'Norse' && (
        <g stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M60 12v48M44 24l32 24M76 24L44 48" />
          <polygon points="60,12 74,36 60,60 46,36" fill={stroke} fillOpacity="0.1" />
        </g>
      )}
      {pantheon === 'Hindu' && (
        <g stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="60" cy="36" r="16" fill={stroke} fillOpacity="0.1" />
          <circle cx="60" cy="36" r="5" />
          <path d="M60 14v8M60 50v8M38 36h8M74 36h8M44.5 20.5l5.5 5.5M70 46l5.5 5.5M75.5 20.5L70 26M50 46l-5.5 5.5" />
        </g>
      )}
      {pantheon === 'Egyptian' && (
        <g stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M32 36c8-11 20-16 28-16s20 5 28 16c-8 11-20 16-28 16s-20-5-28-16Z" fill={stroke} fillOpacity="0.1" />
          <circle cx="60" cy="36" r="7" />
          <path d="M60 43v13M52 52h16" />
        </g>
      )}
      {pantheon === 'Japanese' && (
        <g stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M34 22c16 4 36 4 52 0M38 30h44M46 24v32M74 24v32" />
          <circle cx="60" cy="43" r="6" fill={stroke} fillOpacity="0.15" strokeWidth="1.5" />
        </g>
      )}
      {pantheon === 'Celtic' && (
        <g stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="60" cy="36" r="18" strokeOpacity="0.35" />
          <circle cx="60" cy="26" r="8" fill={stroke} fillOpacity="0.1" />
          <circle cx="51" cy="42" r="8" fill={stroke} fillOpacity="0.1" />
          <circle cx="69" cy="42" r="8" fill={stroke} fillOpacity="0.1" />
        </g>
      )}
      {pantheon === 'Mesoamerican' && (
        <g stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="60,13 80,36 60,59 40,36" fill={stroke} fillOpacity="0.12" />
          <rect x="52" y="28" width="16" height="16" />
          <circle cx="60" cy="36" r="3" fill={stroke} />
        </g>
      )}
    </svg>
  );
}

export function getRealmLabel(realm: Realm): string {
  switch (realm) {
    case 'SKY':
      return 'Sky';
    case 'UNDERWORLD':
      return 'Underworld';
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
      return 'Ignores opponent realm bonus';
    case 'PROPHECY':
      return 'Reveals 1 opponent stat';
    case 'RESURRECTION':
      return 'Returns to deck bottom on first loss';
    case 'NONE':
      return 'Standard deity clash';
  }
}
