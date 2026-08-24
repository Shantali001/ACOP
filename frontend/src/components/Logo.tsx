import { useEffect, useState } from 'react';

import logoUrl from '../assets/amsaf-logo.png';
import { getSettings } from '../settings/api';

type LogoProps = {
  className?: string;
  showText?: boolean;
};

export function Logo({ className = '', showText = true }: LogoProps) {
  const [organizationName, setOrganizationName] = useState('AMSAF');
  const [organizationLogo, setOrganizationLogo] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then((settings) => {
        setOrganizationName(settings.organizationName || 'AMSAF');
        setOrganizationLogo(settings.organizationLogo);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img src={organizationLogo ?? logoUrl} alt={organizationName} className="h-10 w-10 shrink-0 rounded-md object-contain" />
      {showText ? (
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-normal text-amsaf-ink">{organizationName}</div>
          <div className="text-xs text-disabled">ACOP</div>
        </div>
      ) : null}
    </div>
  );
}