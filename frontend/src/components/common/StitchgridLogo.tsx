import React from "react";
import Image from "next/image";
import Link from "next/link";

interface StitchgridLogoProps {
  subtitle?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "full" | "symbol" | "dark";
  href?: string;
  className?: string;
}

export function StitchgridLogo({
  subtitle,
  size = "md",
  variant = "full",
  href,
  className = "",
}: StitchgridLogoProps) {
  // Dimensions for exact 925:205 ratio (~4.51:1) for full logo, and 1:1 for symbol
  const getDimensions = () => {
    if (variant === "symbol") {
      switch (size) {
        case "sm":
          return { width: 32, height: 32 };
        case "lg":
          return { width: 56, height: 56 };
        case "xl":
          return { width: 72, height: 72 };
        case "md":
        default:
          return { width: 44, height: 44 };
      }
    }

    switch (size) {
      case "sm":
        return { width: 144, height: 32 };
      case "lg":
        return { width: 252, height: 56 };
      case "xl":
        return { width: 320, height: 71 };
      case "md":
      default:
        return { width: 198, height: 44 };
    }
  };

  const dims = getDimensions();
  const imageSrc =
    variant === "symbol"
      ? "/stitchgrid-symbol.png"
      : variant === "dark"
      ? "/stitchgrid-logo-dark.png"
      : "/stitchgrid-logo-transparent.png";

  const content = (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative flex items-center justify-center">
        <Image
          src={imageSrc}
          alt="STITCHGRID - The Garment Manufacturing Network"
          width={dims.width}
          height={dims.height}
          priority
          className="object-contain max-w-full h-auto"
          style={{ maxHeight: dims.height }}
        />
      </div>
      {subtitle && (
        <p className="text-xs sm:text-sm text-slate-500 mt-2 text-center max-w-sm leading-relaxed font-medium">
          {subtitle}
        </p>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-block transition-opacity hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
}
