export default function InlineLoader({ size = 20 }) {
  return (
    <div
      className="border-2 border-white/30 border-t-white rounded-full animate-spin"
      style={{ width: size, height: size }}
    />
  );
}