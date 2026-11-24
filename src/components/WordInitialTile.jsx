// Local placeholder for words without an image: the first letter of the word.
// No external image service is contacted.
export default function WordInitialTile({ word, className = '' }) {
  const letter = Array.from(String(word || '').trim())[0]?.toUpperCase() || '?';
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center bg-gradient-to-br from-indigo-600/40 to-purple-700/40 text-white/90 font-black text-6xl select-none ${className}`}
    >{letter}</div>
  );
}
