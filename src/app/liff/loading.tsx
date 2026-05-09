export default function LiffLoading() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#f5ead4",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "3px solid #d4c4a0",
          borderTopColor: "#c9a040",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </main>
  );
}
