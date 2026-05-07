type LogoMarkProps = {
  size?: number;
  className?: string;
};

export function LogoMark({ size = 36, className }: LogoMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g filter="url(#sketchy)">
        <rect
          x={6}
          y={6}
          width={36}
          height={36}
          rx={4}
          stroke="currentColor"
          strokeWidth={3}
          fill="none"
        />
        <path
          d="M14 24 L21 31 L34 16"
          stroke="currentColor"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}
