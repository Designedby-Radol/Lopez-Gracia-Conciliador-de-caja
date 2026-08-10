import React from "react";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  color?: string;
}

export default function Logo({ className = "", size = "md", color = "currentColor" }: LogoProps) {
  // Proporciones de tamaño basadas en la escala
  const dimensions = {
    sm: "h-9 w-auto",
    md: "h-14 w-auto",
    lg: "h-24 w-auto",
    xl: "h-36 w-auto"
  };

  return (
    <svg
      viewBox="0 0 580 250"
      className={`${dimensions[size]} ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="López & Gracia"
    >
      <g stroke={color} strokeWidth="10.5" strokeLinecap="round" strokeLinejoin="round">
        {/* === FILA 1: lōpez3 (Y center = 70, R = 34, Col width = 90) === */}
        
        {/* 'l' (Col 0, X = 45) */}
        <path d="M 45 15 L 45 104" />
        
        {/* 'ō' (Col 1, X = 135) */}
        <circle cx="135" cy="70" r="34" />
        <path d="M 113 18 L 157 18" strokeWidth="9.5" />
        
        {/* 'p' (Col 2, X = 225) */}
        <path d="M 191 36 L 191 138" />
        <circle cx="225" cy="70" r="34" />
        
        {/* 'e' (Col 3, X = 315) */}
        <path d="M 347 70 L 283 70 A 34 34 0 1 1 342 91" />
        
        {/* 'z' (Col 4, X = 405) */}
        <path d="M 371 36 L 439 36 L 371 104 L 439 104" />
        
        {/* '3' (Símbolo especial, Col 5, X = 495) */}
        <circle cx="495" cy="87" r="17" />
        <path d="M 495 70 A 17 17 0 0 0 495 36" />
        <path d="M 461 70 L 495 70" />
        
        {/* Símbolo de marca registrada ® */}
        <circle cx="555" cy="28" r="8" strokeWidth="1.8" />
        <text
          x="555"
          y="31"
          fill={color}
          stroke="none"
          fontSize="9"
          fontWeight="900"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          R
        </text>

        {/* === FILA 2: gracia (Y center = 170, R = 34) === */}
        
        {/* 'g' (Col 0, left edge aligned with 'l') */}
        <circle cx="79" cy="170" r="34" />
        <path d="M 113 136 L 113 206 A 28 28 0 0 1 57 234" />
        
        {/* 'r' (Col 1, X = 135) */}
        <path d="M 135 136 L 135 204" />
        <path d="M 135 165 A 34 34 0 0 1 175 138" />
        
        {/* 'a' (Col 2, X = 225) */}
        <circle cx="225" cy="170" r="34" />
        <path d="M 259 136 L 259 204" />
        
        {/* 'c' (Col 3, X = 315) */}
        <path d="M 342 149 A 34 34 0 1 0 342 191" />
        
        {/* 'i' (Col 4, X = 405) */}
        <path d="M 405 150 L 405 204" />
        <circle cx="405" cy="126" r="6" fill={color} stroke="none" />
        
        {/* 'a' (Col 5, X = 495) */}
        <circle cx="495" cy="170" r="34" />
        <path d="M 529 136 L 529 204" />
      </g>
    </svg>
  );
}
