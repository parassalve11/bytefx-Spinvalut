"use client";

import Image from "next/image";
import { useState } from "react";

/** Small CDN flag with a readable country label even if the image fails. */
export default function CountryLabel({ country, inferred = false }) {
  const [failedCode, setFailedCode] = useState(null);
  if (!country) return null;
  return (
    <span className="inline-flex items-center gap-2" title={inferred ? "Country inferred from phone number" : undefined}>
      {country.code && failedCode !== country.code ? (
        // Tiny flag icons use the documented Flagpedia CDN, no client identifiers.
        <Image unoptimized src={`https://flagcdn.com/24x18/${country.code.toLowerCase()}.webp`} width={24} height={18} sizes="24px" alt="" aria-hidden="true" referrerPolicy="no-referrer" onError={() => setFailedCode(country.code)} className="rounded-sm" />
      ) : null}
      {country.name}{inferred ? <span className="text-[10px] text-text-muted">(phone)</span> : null}
    </span>
  );
}
