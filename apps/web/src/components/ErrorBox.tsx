export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="error-box" role="alert">
      {msg.split("\n").map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}
