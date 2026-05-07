export function WavyDivider() {
  return (
    <div className="wrap">
      <svg
        className="wavy-divider"
        viewBox="0 0 1080 24"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 12 Q67 2 135 12 T270 12 T405 12 T540 12 T675 12 T810 12 T945 12 T1080 12"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        />
      </svg>
    </div>
  );
}
