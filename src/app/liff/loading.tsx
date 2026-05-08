export default function LiffLoading() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#faf8f4",
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
          border: "3px solid #e0ddd4",
          borderTopColor: "#6aab8e",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </main>
  );
}
