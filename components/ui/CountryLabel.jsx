"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Country flag + optional readable country name.
 *
 * The winner card no longer shows the visible "(phone)" suffix.
 */
export default function CountryLabel({ country, showName = true }) {
  const [failedCode, setFailedCode] = useState(null);

  if (!country) return null;

  const canUseImage = Boolean(
    country.code && failedCode !== country.code
  );

  return (
    <span
      className="inline-flex items-center gap-2"
      title={country.name}
    >
      {canUseImage ? (
        <Image
          unoptimized
          src={`https://flagcdn.com/24x18/${country.code.toLowerCase()}.webp`}
          width={24}
          height={18}
          sizes="24px"
          alt={`${country.name} flag`}
          referrerPolicy="no-referrer"
          onError={() => setFailedCode(country.code)}
          className="h-[18px] w-6 rounded-sm object-cover"
        />
      ) : country.flag ? (
        <span
          aria-label={`${country.name} flag`}
          role="img"
          className="text-base leading-none"
        >
          {country.flag}
        </span>
      ) : null}

      {showName ? <span>{country.name}</span> : null}
    </span>
  );
}