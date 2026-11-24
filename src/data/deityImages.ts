const DEITY_ID_ORDER = [
  'zeus',
  'poseidon',
  'hades',
  'athena',
  'apollo',
  'ares',
  'hermes',
  'achilles',
  'medusa',
  'odysseus',
  'odin',
  'thor',
  'hel',
  'loki',
  'jormungandr',
  'freya',
  'heimdall',
  'fenrir',
  'tyr',
  'njord',
  'indra',
  'varuna',
  'yama',
  'kartikeya',
  'garuda',
  'saraswati',
  'karna',
  'narada',
  'makara',
  'chitragupta',
  'ra',
  'osiris',
  'set',
  'anubis',
  'horus',
  'isis',
  'sobek',
  'thoth',
  'montu',
  'apophis',
  'amaterasu',
  'tsukuyomi',
  'susanoo',
  'izanagi',
  'izanami',
  'raijin',
  'hachiman',
  'fujin',
  'ryujin',
  'shuten_doji',
  'the_dagda',
  'morrigan',
  'lugh',
  'manannan',
  'cu_chulainn',
  'quetzalcoatl',
  'tezcatlipoca',
  'tlaloc',
  'huitzilopochtli',
  'mictlantecuhtli',
] as const;

export const DEITY_IMAGE_FILES: Readonly<Record<string, string>> = Object.fromEntries(
  DEITY_ID_ORDER.map((id, idx) => [id, `Slide${idx + 1}.PNG`]),
);

export const DEITY_NUMBER_BY_ID: Readonly<Record<string, string>> = Object.fromEntries(
  DEITY_ID_ORDER.map((id, idx) => [
    id,
    `${String(idx + 1).padStart(2, '0')}/${DEITY_ID_ORDER.length}`,
  ]),
);

export function getDeityImageUrl(id: string): string | null {
  const filename = DEITY_IMAGE_FILES[id];
  if (!filename) return null;
  const rawBase = import.meta.env.BASE_URL || './';
  const safeBase = rawBase === '/' ? './' : rawBase;
  const normalizedBase = safeBase.endsWith('/') ? safeBase : `${safeBase}/`;
  return `${normalizedBase}deity/${filename}`;
}
