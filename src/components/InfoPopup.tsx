import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

// ---------------------------------------------------------------------------
// A single clean, dismissible explainer card. Used for the NASA dataset
// methodology shown when a new planet mode opens, and for the vertical
// farming suitability note.
// ---------------------------------------------------------------------------

interface Props {
  open: boolean
  onClose: () => void
  eyebrow: string
  title: string
  body: ReactNode
  /** optional footnote line — the actual datasets behind the statement */
  footnote?: string
  accent?: 'emerald' | 'cyan' | 'amber'
}

const ACCENTS = {
  emerald: {
    ring: 'border-emerald-200',
    chip: 'bg-emerald-50 text-[#15803D]',
    bar: 'bg-[#16A34A]',
  },
  cyan: {
    ring: 'border-cyan-200',
    chip: 'bg-cyan-50 text-cyan-700',
    bar: 'bg-cyan-500',
  },
  amber: {
    ring: 'border-amber-200',
    chip: 'bg-amber-50 text-amber-700',
    bar: 'bg-amber-500',
  },
}

export default function InfoPopup({
  open,
  onClose,
  eyebrow,
  title,
  body,
  footnote,
  accent = 'emerald',
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const a = ACCENTS[accent]

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={title}
      className="absolute bottom-4 left-4 right-4 z-[600] sm:right-auto sm:max-w-[400px] animate-rise"
    >
      <div className={`rounded-2xl border ${a.ring} bg-white/97 shadow-xl backdrop-blur overflow-hidden`}>
        <div className={`h-1 w-full ${a.bar}`} />
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${a.chip}`}
              >
                {eyebrow}
              </span>
              <h3 className="mt-2 text-sm font-bold text-slate-900">{title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-2 text-[12px] leading-relaxed text-slate-600">{body}</div>
          {footnote && (
            <p className="mt-2.5 border-t border-slate-100 pt-2 text-[10px] leading-snug text-slate-400">
              {footnote}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
