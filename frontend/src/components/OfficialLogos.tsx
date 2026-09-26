import { ImageOff } from 'lucide-react';

type OfficialLogoProps = {
  compact?: boolean;
  className?: string;
};

const logos = [
  { src: '/assets/logos/katsina-state-logo.png', alt: 'Katsina State logo', label: 'Katsina State' },
  { src: '/assets/logos/apc-katsina-logo.png', alt: 'APC Katsina logo', label: 'APC Katsina' },
];

export function OfficialLogos({ compact = false, className = '' }: OfficialLogoProps) {
  const sizeClass = compact ? 'official-logo-compact' : 'official-logo-standard';

  return (
    <div className={`official-logos ${className}`.trim()} aria-label="Official Katsina branding">
      {logos.map((logo) => (
        <div className={`official-logo ${sizeClass}`} key={logo.src}>
          <img
            src={logo.src}
            alt={logo.alt}
            onError={(event) => {
              event.currentTarget.style.display = 'none';
              event.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <span className="official-logo-placeholder hidden" aria-label={`${logo.alt} placeholder`}>
            <ImageOff aria-hidden="true" />
            <span>{logo.label}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
