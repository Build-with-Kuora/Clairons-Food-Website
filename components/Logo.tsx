import Image from "next/image";

/**
 * Client logo, provisional. The source file is a square with the wordmark in the middle,
 * so we crop to the wordmark's box. When the final logo arrives, replace the file and update SRC/CROP.
 */
const SRC = "/brand/clairons-logo.jpg";
const SIZE = 1600; // source image is SIZE × SIZE
const CROP = { x: 50, y: 540, w: 1510, h: 585 }; // wordmark box in source pixels

export function Logo({ height = 40, className }: { height?: number; className?: string }) {
  const scale = height / CROP.h;
  return (
    <span
      role="img"
      aria-label="Clairon's Food"
      className={`relative block shrink-0 overflow-hidden ${className ?? ""}`}
      style={{ width: Math.round(CROP.w * scale), height }}
    >
      <Image
        src={SRC}
        alt=""
        width={SIZE}
        height={SIZE}
        priority
        unoptimized
        style={{ position: "absolute", maxWidth: "none", width: SIZE * scale, height: SIZE * scale, left: -CROP.x * scale, top: -CROP.y * scale }}
      />
    </span>
  );
}
