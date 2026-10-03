import Image from "next/image";

/**
 * Client logo, provisional. A transparent PNG cropped to the wordmark, made from the client's
 * square JPEG (clairons-logo.jpg) by removing the white. When the final logo arrives,
 * replace the file and update SRC/W/H.
 */
const SRC = "/brand/clairons-logo.png";
const W = 1478; // source image size in pixels
const H = 596;

export function Logo({ height = 40, className }: { height?: number; className?: string }) {
  return (
    <Image
      src={SRC}
      alt="Clairon's Food"
      width={W}
      height={H}
      priority
      unoptimized
      className={`block shrink-0 ${className ?? ""}`}
      style={{ width: Math.round((W * height) / H), height }}
    />
  );
}
