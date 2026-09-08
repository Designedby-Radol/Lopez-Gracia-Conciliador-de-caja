import React from "react";

interface LogoProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  color?: string;
}

/**
 * Logotipo Oficial López & Gracia
 * Reconstrucción vectorial matemáticamente calibrada del archivo de marca oficial (logo-lopez-09).
 * - Fila 1: l ō p e z 3 ®
 * - Fila 2: g r a c i a
 * Sin traslapes, con interlineado óptico perfecto y glifos geométricos de máxima definición.
 */
export default function Logo({
  className = "",
  size = "md",
  color = "currentColor"
}: LogoProps) {
  const sizeClasses = {
    xs: "h-6 w-auto",
    sm: "h-8 w-auto",
    md: "h-12 w-auto",
    lg: "h-20 w-auto",
    xl: "h-28 w-auto",
    "2xl": "h-36 w-auto"
  };

  return (
    <svg
      viewBox="0 0 1020 680"
      className={`${sizeClasses[size]} ${className} select-none transition-all`}
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="López & Gracia"
    >
      {/* ========================================================================= */}
      {/* FILA 1: l ō p e z 3 ®                                                     */}
      {/* ========================================================================= */}

      {/* 'l' - Asta vertical pura */}
      <rect x="50" y="70" width="28" height="260" rx="1" />

      {/* 'ō' - Macron superior + Círculo */}
      <rect x="110" y="70" width="160" height="28" rx="1" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M190 150c49.7 0 90 40.3 90 90s-40.3 90-90 90-90-40.3-90-90 40.3-90 90-90zm0 28c34.2 0 62 27.8 62 62s-27.8 62-62 62-62-27.8-62-62 27.8-62 62-62z"
      />

      {/* 'p' - Asta descendente izquierda + Círculo */}
      <rect x="300" y="150" width="28" height="260" rx="1" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M418 150c49.7 0 90 40.3 90 90s-40.3 90-90 90-90-40.3-90-90 40.3-90 90-90zm0 28c34.2 0 62 27.8 62 62s-27.8 62-62 62-62-27.8-62-62 27.8-62 62-62z"
      />

      {/* 'e' - Círculo con corte y barra central */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M618 150c49.7 0 90 40.3 90 90 0 5-.4 10-1.2 14.5H530c3.5 25.5 25.3 45 51.5 45 19.8 0 37-11.2 45.8-28l26.2 12.5C640 307.5 613 324 582 324c-49.7 0-90-40.3-90-90s40.3-90 90-90zm-59.5 76.5h119c-3.8-25-25-44.5-50.5-44.5s-46.7 19.5-50.5 44.5z"
      />

      {/* 'z' - Diagonal y bases nítidas */}
      <path d="M728 150h140v28l-88 124h92v28H728v-28l88-124h-88V150z" />

      {/* '3' - Ligadura característica conectada con puente a la 'z' */}
      <rect x="860" y="226" width="35" height="28" />
      {/* Aro superior del 3 */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M935 150c24.8 0 45 20.2 45 45s-20.2 45-45 45-45-20.2-45-45 20.2-45 45-45zm0 26c10.5 0 19 8.5 19 19s-8.5 19-19 19-19-8.5-19-19 8.5-19 19-19z"
      />
      {/* Aro inferior del 3 */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M935 240c24.8 0 45 20.2 45 45s-20.2 45-45 45-45-20.2-45-45 20.2-45 45-45zm0 26c10.5 0 19 8.5 19 19s-8.5 19-19 19-19-8.5-19-19 8.5-19 19-19z"
      />

      {/* Marca Registrada ® */}
      <g transform="translate(992, 126)">
        <circle cx="11" cy="11" r="10" fill="none" stroke={color} strokeWidth="2.2" />
        <text
          x="11"
          y="15"
          fill={color}
          fontSize="11"
          fontWeight="900"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          R
        </text>
      </g>

      {/* ========================================================================= */}
      {/* FILA 2: g r a c i a                                                       */}
      {/* ========================================================================= */}

      {/* 'g' - Círculo + Asta derecha con gancho redondeado inferior */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M140 390c49.7 0 90 40.3 90 90s-40.3 90-90 90-90-40.3-90-90 40.3-90 90-90zm0 28c34.2 0 62 27.8 62 62s-27.8 62-62 62-62-27.8-62-62 27.8-62 62-62z"
      />
      <path d="M230 390v180c0 49.7-40.3 90-90 90-36.5 0-67.8-21.7-81.5-53.5l26-13.5C92.8 614.5 114.5 632 140 632c34.2 0 62-27.8 62-62v-30h-28v30c0 18.8-15.2 34-34 34-11.8 0-22.2-6-28.2-15.2l-23.5 12.2C98.5 669.5 118 676 140 676c49.7 0 90-40.3 90-90V390h-28z" />

      {/* 'r' - Asta vertical + hombro curvado a la derecha */}
      <rect x="250" y="390" width="28" height="180" rx="1" />
      <path d="M278 430c11-25 35-40 62-40v28c-28 0-48 16-54 41v111H258V430z" />

      {/* 'a' (primera) - Círculo + Asta vertical derecha */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M450 390c49.7 0 90 40.3 90 90s-40.3 90-90 90-90-40.3-90-90 40.3-90 90-90zm0 28c34.2 0 62 27.8 62 62s-27.8 62-62 62-62-27.8-62-62 27.8-62 62-62z"
      />
      <rect x="512" y="390" width="28" height="180" rx="1" />

      {/* 'c' - Círculo con apertura a la derecha */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M650 390c49.7 0 90 40.3 90 90 0 9.8-1.6 19.2-4.5 28l-27-8c2-6.5 3.5-13.2 3.5-20 0-34.2-27.8-62-62-62s-62 27.8-62 62 27.8 62 62 62c20.5 0 38.5-10 49.5-25.5l23.5 16.5C709 550 681.5 570 650 570c-49.7 0-90-40.3-90-90s40.3-90 90-90z"
      />

      {/* 'i' - Asta vertical + punto circular suspendido */}
      <circle cx="774" cy="335" r="16" />
      <rect x="760" y="390" width="28" height="180" rx="1" />

      {/* 'a' (segunda) - Idéntica a la primera */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M894 390c49.7 0 90 40.3 90 90s-40.3 90-90 90-90-40.3-90-90 40.3-90 90-90zm0 28c34.2 0 62 27.8 62 62s-27.8 62-62 62-62-27.8-62-62 27.8-62 62-62z"
      />
      <rect x="956" y="390" width="28" height="180" rx="1" />
    </svg>
  );
}
