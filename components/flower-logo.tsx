import React from 'react'

interface FlowerLogoProps {
  size?: number
  className?: string
}

export function FlowerLogo({ size = 64, className = '' }: FlowerLogoProps) {
  return (
    <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Outer circle with light pink fill and border */}
        <circle
          cx="32"
          cy="32"
          r="30"
          fill="#FCE7EA"
          stroke="#E94C60"
          strokeWidth="1.5"
        />
        {/* Flower petals - 5 rounded petals arranged in a circle */}
        <g transform="translate(32, 32)">
          {/* Petal 1 - Top */}
          <ellipse
            cx="0"
            cy="-10"
            rx="7"
            ry="12"
            fill="#E94C60"
            transform="rotate(0)"
          />
          {/* Petal 2 - Top Right */}
          <ellipse
            cx="8"
            cy="-5"
            rx="7"
            ry="12"
            fill="#E94C60"
            transform="rotate(72)"
          />
          {/* Petal 3 - Bottom Right */}
          <ellipse
            cx="8"
            cy="5"
            rx="7"
            ry="12"
            fill="#E94C60"
            transform="rotate(144)"
          />
          {/* Petal 4 - Bottom Left */}
          <ellipse
            cx="0"
            cy="10"
            rx="7"
            ry="12"
            fill="#E94C60"
            transform="rotate(216)"
          />
          {/* Petal 5 - Top Left */}
          <ellipse
            cx="-8"
            cy="5"
            rx="7"
            ry="12"
            fill="#E94C60"
            transform="rotate(288)"
          />
          {/* Center circle - yellow/gold */}
          <circle cx="0" cy="0" r="5" fill="#FFD700" />
        </g>
      </svg>
    </div>
  )
}
