import React, { useId } from 'react';

export default function MangoLeafLogo({ size = 32 }) {
  const uid = useId();
  const gradId = `mg-${uid.replace(/:/g, '')}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Shield background */}
      <path
        d="M32 4 L52 14 L52 34 Q52 52, 32 60 Q12 52, 12 34 L12 14 Z"
        fill="#1c2128"
        stroke="#2f81f7"
        strokeWidth="2"
      />

      {/* Mango fruit */}
      <ellipse cx="32" cy="32" rx="12" ry="16" fill={`url(#${gradId})`} />

      {/* Fruit highlight */}
      <ellipse cx="28" cy="26" rx="4" ry="7" fill="rgba(255,255,255,0.25)" />

      {/* Stem */}
      <path d="M32 16 Q33 12, 36 10" stroke="#8B6914" strokeWidth="2" strokeLinecap="round" fill="none"/>

      {/* Leaf */}
      <path d="M35 12 Q44 8, 46 14 Q48 20, 40 17 Q36 15, 35 12Z" fill="#3fb950" />
      <path d="M37 13 Q42 12, 43 15" stroke="#2d8a3e" strokeWidth="0.7" fill="none"/>

      <defs>
        <linearGradient id={gradId} x1="20" y1="16" x2="44" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFD93D" />
          <stop offset="100%" stopColor="#E8901E" />
        </linearGradient>
      </defs>
    </svg>
  );
}
