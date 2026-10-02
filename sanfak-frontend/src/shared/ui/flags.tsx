const BOX = { width: 20, height: 14, viewBox: '0 0 28 20' } as const;

interface FlagProps {
  size?: number;
}

const dims = (size?: number) =>
  size ? { width: size, height: Math.round((size * 20) / 28) } : { width: BOX.width, height: BOX.height };

export function FlagUz({ size }: FlagProps) {
  return (
    <svg {...dims(size)} viewBox={BOX.viewBox} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <clipPath id="flag-uz-clip">
        <rect width="28" height="20" rx="2" />
      </clipPath>
      <g clipPath="url(#flag-uz-clip)">
        <rect width="28" height="20" fill="#fff" />
        <rect width="28" height="6.4" fill="#04AAC8" />
        <rect y="13.6" width="28" height="6.4" fill="#23C840" />
      </g>
      <rect x="0.25" y="0.25" width="27.5" height="19.5" rx="1.75" fill="none" stroke="#F0F0F0" strokeWidth="0.5" />
    </svg>
  );
}

export function FlagRu({ size }: FlagProps) {
  return (
    <svg {...dims(size)} viewBox={BOX.viewBox} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <clipPath id="flag-ru-clip">
        <rect width="28" height="20" rx="2" />
      </clipPath>
      <g clipPath="url(#flag-ru-clip)">
        <rect width="28" height="20" fill="#fff" />
        <rect y="6.67" width="28" height="6.67" fill="#0C47B7" />
        <rect y="13.34" width="28" height="6.66" fill="#E53B35" />
      </g>
      <rect x="0.25" y="0.25" width="27.5" height="19.5" rx="1.75" fill="none" stroke="#F0F0F0" strokeWidth="0.5" />
    </svg>
  );
}

export function FlagEn({ size }: FlagProps) {
  return (
    <svg {...dims(size)} viewBox={BOX.viewBox} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <clipPath id="flag-en-clip">
        <rect width="28" height="20" rx="2" />
      </clipPath>
      <g clipPath="url(#flag-en-clip)">
        <rect width="28" height="20" fill="#46467F" />
        <path d="M0 0 L28 20 M28 0 L0 20" stroke="#fff" strokeWidth="4" />
        <path d="M0 0 L28 20 M28 0 L0 20" stroke="#D02F44" strokeWidth="2" />
        <path d="M14 0 V20 M0 10 H28" stroke="#fff" strokeWidth="6" />
        <path d="M14 0 V20 M0 10 H28" stroke="#D02F44" strokeWidth="3.5" />
      </g>
      <rect x="0.25" y="0.25" width="27.5" height="19.5" rx="1.75" fill="none" stroke="#F0F0F0" strokeWidth="0.5" />
    </svg>
  );
}
