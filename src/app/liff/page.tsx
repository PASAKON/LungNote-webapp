import { Suspense } from "react";
import { LiffClient } from "./LiffClient";

export const dynamic = "force-dynamic";

export default function LiffPage() {
  return (
    <Suspense fallback={<LiffSkeleton />}>
      <LiffClient />
    </Suspense>
  );
}

function LiffSkeleton() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#f5ead4",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    />
  );
}
