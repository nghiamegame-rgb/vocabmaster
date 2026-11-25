import { useState } from 'react';
import { Settings, Volume2, Shuffle } from 'lucide-react';
import { useVoices } from '../hooks/useVoices';
import { loadVoiceSettings, previewVoice, saveVoiceSettings } from '../utils/voiceSpeech';
import { normalizeVoicePrefs } from '../utils/voicePrefs';
import {
  examVoicePool, findSavedVoice, pickDefaultVoice, voiceKey, voiceLabel, voiceLabels,
  VOICE_RATE_MAX, VOICE_RATE_MIN,
} from '../utils/voiceSelection';

/**
 * Compact "Giọng đọc" button + inline panel, shared by Dictation and Listening.
 * Render it inside a flex-wrap row: the panel takes its own full-width line.
 */
export default function VoiceSettings() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(loadVoiceSettings);
  const [saveFailed, setSaveFailed] = useState(false);
  const { voices, english, status, googleFallback } = useVoices();

  function update(patch) {
    const next = normalizeVoicePrefs({ ...settings, ...patch });
    setSaveFailed(!saveVoiceSettings(next));
    setSettings(next);
  }

  const saved = findSavedVoice(voices, settings);
  // The option value is only a position in this list; what is saved is voiceURI + name.
  const selectedIndex = saved ? english.findIndex(v => voiceKey(v) === voiceKey(saved)) : -1;
  const labels = voiceLabels(english);
  const defaultVoice = pickDefaultVoice(voices);
  const examCount = examVoicePool(voices).length;

  function chooseVoice(value) {
    const voice = value === '' ? null : english[Number(value)];
    update({ voiceURI: voice?.voiceURI || '', name: voice?.name || '' });
  }

  return (
    <>
      <button
        id="voice-settings-toggle" type="button" onClick={() => setOpen(v => !v)}
        aria-expanded={open} aria-controls="voice-settings-panel"
        title="Chọn giọng đọc, tốc độ và Chế độ thi"
        className={`vm-btn flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border max-w-full ${open || settings.examMode
          ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-200 hover:bg-indigo-500/30'
          : 'bg-slate-900/75 border-slate-400/20 text-slate-300 hover:text-white hover:border-slate-400/35'}`}
      >
        <Settings size={14} className="shrink-0" />
        <span>Giọng đọc{settings.examMode ? ' · Chế độ thi' : ''}</span>
      </button>

      {settings.examMode && googleFallback && (
        <p id="voice-fallback-note" role="status" className="order-last basis-full text-xs text-amber-300">
          Đang dùng giọng Google dự phòng (chỉ có 1 giọng) nên Chế độ thi không đổi giọng.
        </p>
      )}

      {open && (
        <section id="voice-settings-panel" aria-label="Cài đặt giọng đọc" className="vm-panel vm-feedback-in order-last basis-full w-full min-w-0 rounded-2xl p-4 space-y-3 text-left">
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            <label className="flex-1 min-w-0 block">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">Giọng</span>
              <select
                id="voice-select" value={selectedIndex === -1 ? '' : String(selectedIndex)}
                onChange={e => chooseVoice(e.target.value)} disabled={status !== 'ready'}
                className="w-full vm-input rounded-xl px-3 py-2 text-base sm:text-sm disabled:opacity-50"
              >
                <option value="">{defaultVoice ? `Mặc định – ${voiceLabel(defaultVoice)}` : 'Mặc định'}</option>
                {english.map((voice, i) => <option key={voiceKey(voice)} value={String(i)}>{labels[i]}</option>)}
              </select>
            </label>
            <button id="voice-preview" type="button" onClick={previewVoice} className="vm-btn vm-btn-primary flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold shrink-0">
              <Volume2 size={15} /> Nghe thử
            </button>
          </div>

          <label className="block">
            <span className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-1">
              <span>Tốc độ đọc</span>
              <span id="voice-rate-value" className="tabular-nums text-indigo-200">{settings.rate.toFixed(2)}×</span>
            </span>
            <input
              id="voice-rate" type="range" min={VOICE_RATE_MIN} max={VOICE_RATE_MAX} step="0.05"
              value={settings.rate} onChange={e => update({ rate: Number(e.target.value) })}
              className="w-full accent-indigo-500"
            />
          </label>

          <div className="flex items-center justify-between gap-3">
            <span id="voice-exam-label" className="flex items-center gap-2 text-xs font-semibold text-slate-200 min-w-0">
              <Shuffle size={14} className="text-indigo-300 shrink-0" /> Chế độ thi (giọng ngẫu nhiên)
            </span>
            <button
              id="voice-exam-toggle" type="button" role="switch" aria-checked={settings.examMode} aria-labelledby="voice-exam-label"
              onClick={() => update({ examMode: !settings.examMode })}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${settings.examMode ? 'bg-indigo-500 shadow-sm shadow-indigo-500/40' : 'bg-slate-600'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${settings.examMode ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div id="voice-settings-notes" className="text-[11px] leading-relaxed text-slate-400 space-y-1">
            {status === 'loading' && <p role="status">Đang tải danh sách giọng…</p>}
            {status === 'unavailable' && <p role="status" className="text-amber-300">Thiết bị này không có giọng đọc tiếng Anh, web đang dùng giọng Google dự phòng (chỉ 1 giọng) nên không chọn được giọng.</p>}
            {status === 'ready' && settings.examMode && (
              <p>{examCount === 1
                ? 'Máy chỉ có 1 giọng tiếng Anh nên Chế độ thi dùng giọng này.'
                : `Mỗi câu mới dùng một giọng ngẫu nhiên trong ${examCount} giọng; nghe lại thì giữ giọng. Giọng chọn ở trên chỉ dùng khi tắt Chế độ thi.`}</p>
            )}
            {saveFailed && <p role="status" className="text-amber-300">Không lưu được cài đặt trên thiết bị này; chỉ dùng tới khi tải lại trang.</p>}
            <p>Áp dụng cho Dictation và Listening. Chỉ lưu trên thiết bị này.</p>
          </div>
        </section>
      )}
    </>
  );
}
