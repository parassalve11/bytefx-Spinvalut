"use client";

import { useState } from "react";

import { clsx } from "@/lib/clsx";

/**
 * Participant photo with a graceful fallback.
 *
 * Falls back to the default user icon when there is no photo at all, and also
 * when a photo fails to load. The failed source is tracked (rather than a plain
 * boolean) because the reel recycles card instances as the strip moves: keying
 * off the URL means the fallback resets automatically when a card is reused for
 * a different participant.
 */
export default function Avatar({ src, size = 56, className, ringClassName }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const showImage = Boolean(src) && failedSrc !== src;

  return (
    <span
      className={clsx(
        "relative block shrink-0 overflow-hidden rounded-full bg-bg-card",
        "border border-white/10",
        ringClassName,
        className,
      )}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        // Remote Unsplash photos, so a plain img rather than next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          draggable={false}
          onError={() => setFailedSrc(src)}
          className="h-full w-full object-cover"
        />
      ) : (
        <UserIcon />
      )}
    </span>
  );
}

/** Default user icon: shown whenever a participant has no usable photo. */
function UserIcon() {
  return (
    <span className="flex h-full w-full items-center justify-center bg-white/[0.06]">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className="h-[58%] w-[58%] text-text-muted"
      >
        <circle cx="12" cy="8.5" r="3.75" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M4.5 20a7.5 7.5 0 0 1 15 0"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
