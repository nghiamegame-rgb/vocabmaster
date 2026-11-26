// Local placeholder for words without an image: the first letter of the word.
// No external image service is contacted.
export default function WordInitialTile({ word, className = '' }) {
  const letter = Array.from(String(word || '').trim())[0]?.toUpperCase() || '?';
  return (
    <div
      aria-hidden="true"
      className={`sb-font-display flex items-center justify-center bg-gradient-to-br from-[var(--sb-terracotta-soft)] via-[var(--sb-ochre-soft)] to-[var(--sb-paper-deep)] text-[var(--sb-ink)] font-black text-6xl select-none ${className}`}
    >{letter}</div>
  );
}
