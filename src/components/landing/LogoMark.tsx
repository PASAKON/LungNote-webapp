import { MascotMark } from "@/components/MascotMark";

type LogoMarkProps = {
  size?: number;
  className?: string;
};

/**
 * Re-export shim: kept so existing landing imports (`./LogoMark`) still work
 * while the underlying mark is now the shared MascotMark (ADR-0013 follow-up).
 */
export function LogoMark({ size = 36, className }: LogoMarkProps) {
  return <MascotMark size={size} className={className} />;
}
