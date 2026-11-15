import { Droplets, Gauge, HandCoins, Layers, Leaf } from 'lucide-react'
import type { Priorities } from '../lib/types'
import { SectionHead, Slider } from './ui'

const PRESET_VOICES: Array<{ label: string; note: string; p: Priorities }> = [
  {
    label: 'Water first',
    note: 'Dry seasons keep biting — cut water demand before anything else.',
    p: { water: 90, soil: 40, income: 30, erosion: 40, forage: 20 },
  },
  {
    label: 'Build the soil',
    note: 'Long game: organic matter, nitrogen bank, erosion control.',
    p: { water: 45, soil: 90, income: 30, erosion: 75, forage: 35 },
  },
  {
    label: 'Income & forage',
    note: 'Spread price risk and grow more feed on-farm.',
    p: { water: 40, soil: 50, income: 80, erosion: 40, forage: 75 },
  },
  {
    label: 'Balanced',
    note: 'A steady blend of all five priorities.',
    p: { water: 60, soil: 60, income: 50, erosion: 50, forage: 40 },
  },
]

interface Props {
  priorities: Priorities
  onChange: (p: Priorities) => void
}

export default function PrioritiesPanel({ priorities, onChange }: Props) {
  return (
    <section id="priorities" className="scroll-mt-24">
      <SectionHead
        index="02"
        title="Your priorities"
        sub="There is no single “best” rotation — the right choice depends on what you need it to deliver. Set what matters most; every strategy is re-ranked live as you move these."
      />

      <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PRESET_VOICES.map((v) => {
            const active = JSON.stringify(v.p) === JSON.stringify(priorities)
            return (
              <button
                key={v.label}
                title={v.note}
                onClick={() => onChange(v.p)}
                className={`rounded-full border px-3 py-1 text-xs font-bold transition-all ${
                  active
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-emerald-lg'
                    : 'border-slate-100 bg-white text-ink-2 hover:border-emerald-100 hover:bg-emerald-soft'
                }`}
              >
                {v.label}
              </button>
            )
          })}
        </div>

        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Slider
            label="Conserve water"
            icon={<Droplets className="h-3 w-3 text-cyan-600" />}
            value={priorities.water}
            onChange={(v) => onChange({ ...priorities, water: v })}
            hint="Crop water use vs what your rain reliably delivers"
          />
          <Slider
            label="Soil health"
            icon={<Layers className="h-3 w-3 text-emerald-600" />}
            value={priorities.soil}
            onChange={(v) => onChange({ ...priorities, soil: v })}
            hint="Nitrogen banking, organic matter, roots in the ground"
          />
          <Slider
            label="Income & markets"
            icon={<HandCoins className="h-3 w-3 text-amber-600" />}
            value={priorities.income}
            onChange={(v) => onChange({ ...priorities, income: v })}
            hint="Market strength and spreading price risk"
          />
          <Slider
            label="Erosion control"
            icon={<Gauge className="h-3 w-3 text-rose-600" />}
            value={priorities.erosion}
            onChange={(v) => onChange({ ...priorities, erosion: v })}
            hint="Keeping cover through the storm months"
          />
          <Slider
            label="Forage value"
            icon={<Leaf className="h-3 w-3 text-emerald-600" />}
            value={priorities.forage}
            onChange={(v) => onChange({ ...priorities, forage: v })}
            hint="Grazing, hay and silage for livestock"
          />
        </div>
      </div>
    </section>
  )
}
