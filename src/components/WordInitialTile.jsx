// Local placeholder for words without an image: the first letter of the word.
// No external image service is contacted.
export default function WordInitialTile({ word, className = '' }) {
  const letter = Array.from(String(word || '').trim())[0]?.toUpperCase() || '?';
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center bg-gradient-to-br from-indigo-600/40 via-violet-700/35 to-[#0b1222] text-white/95 font-black text-6xl tracking-tight select-none ${className}`}
    >{letter}</div>
  );
}
