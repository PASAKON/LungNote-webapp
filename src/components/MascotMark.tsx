/**
 * MascotMark — LungNote brand icon used wherever a logo mark renders.
 *
 * Replaces the old plain-checkbox SVG. The mascot is a hand-drawn cardboard
 * box ("ลัง") with eyes, a check-mouth, arms, and feet — see ADR-0013 for
 * the brand definition. Source SVG paths come from
 * `design/mascot-icon/lungnote-mascot-icon.svg` (viewBox 0 0 200 200).
 *
 * Stroke uses currentColor so callers control color via CSS — fits both
 * light/dark themes and accent surfaces. Eyes intentionally use a fixed
 * dark fill (`#3a3020`) so they remain readable on accent backgrounds.
 */
type MascotMarkProps = {
  size?: number;
  className?: string;
  /** When true, renders the eye/mouth fills using currentColor instead of the
   *  fixed dark tone. Use on dark surfaces where the body stroke is light. */
  invertFills?: boolean;
};

export function MascotMark({
  size = 36,
  className,
  invertFills = false,
}: MascotMarkProps) {
  const fillColor = invertFills ? "currentColor" : "#3a3020";
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Box body */}
      <path d="M42 38 Q44 35 52 34 Q80 32 100 32 Q130 31 148 34 Q156 35 158 38 Q162 48 163 70 Q164 100 163 128 Q162 148 158 156 Q156 160 148 162 Q130 164 100 164 Q70 164 52 162 Q44 160 42 156 Q38 148 38 128 Q37 100 38 70 Q38 48 42 38Z" />
      {/* Top tape */}
      <path
        d="M54 30 Q56 26 64 24 Q80 22 100 22 Q120 22 136 24 Q144 26 146 30 Q148 34 148 38 Q146 44 144 46 Q136 48 120 48 Q100 48 80 48 Q64 46 56 44 Q54 42 54 38 Q54 34 54 30Z"
        strokeWidth={3}
      />
      {/* Eyes */}
      <circle cx={74} cy={78} r={12} fill={fillColor} stroke="none" />
      <circle cx={126} cy={76} r={10} fill={fillColor} stroke="none" />
      {/* Check-mouth */}
      <path
        d="M76 114 Q84 122 90 128 Q94 126 100 118 Q108 108 126 92"
        strokeWidth={6}
      />
      {/* Arms */}
      <path d="M36 82 Q20 72 6 82" />
      <path d="M164 80 Q180 70 194 80" />
      {/* Feet */}
      <path d="M62 162 Q68 172 76 178 Q84 172 86 162" strokeWidth={3} />
      <path d="M114 162 Q120 172 128 178 Q136 172 138 162" strokeWidth={3} />
    </svg>
  );
}
