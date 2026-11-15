import { Droplets, Gauge, HandCoins, Layers, Leaf } from 'lucide-react'
import type { Priorities } from '../lib/types'
import { SectionHead, Slider } from './ui'

interface Props {
  priorities: Priorities
  onChange: (p: Priorities) => void
}

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

export default function PrioritiesPanel({ priorities, onChange }: Props) {
  return (
    <section id="priorities" className="scroll-mt-24">
      <SectionHead
        index="02"
        title="Your priorities"
        sub="There is no single “best” rotation — the right choice depends on what you need it to deliver. Set what matters most; every strategy is re-ranked live as you move these."
      />

      <div className="rounded-2xl border border-paper-3 bg-white/60 p-5 shadow-card">
        <div className="mb-5 flex flex-wrap gap-2">
          {PRESET_VOICES.map((v) => {
            const active = JSON.stringify(v.p) === JSON.stringify(priorities)
            return (
              <button
                key={v.label}
                title={v.note}
                onClick={() => onChange(v.p)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? 'border-ochre bg-ochre text-white shadow-card'
                    : 'border-paper-3 bg-white/70 text-ink-2 hover:border-ochre/50 hover:bg-ochre/5'
                }`}
              >
                {v.label}
              </button>
            )
          })}
        </div>

        <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
          <Slider
            label="Conserve water"
            icon={<Droplets className="h-3.5 w-3.5 text-water" />}
            value={priorities.water}
            onChange={(v) => onChange({ ...priorities, water: v })}
            hint="Crop water use vs what your rain reliably delivers"
          />
          <Slider
            label="Soil health"
            icon={<Layers className="h-3.5 w-3.5 text-leaf" />}
            value={priorities.soil}
            onChange={(v) => onChange({ ...priorities, soil: v })}
            hint="Nitrogen banking, organic matter, roots in the ground"
          />
          <Slider
            label="Income & markets"
            icon={<HandCoins className="h-3.5 w-3.5 text-ochre" />}
            value={priorities.income}
            onChange={(v) => onChange({ ...priorities, income: v })}
            hint="Market strength and spreading price risk"
          />
          <Slider
            label="Erosion control"
            icon={<Gauge className="h-3.5 w-3.5 text-clay" />}
            value={priorities.erosion}
            onChange={(v) => onChange({ ...priorities, erosion: v })}
            hint="Keeping cover through the storm months"
          />
          <Slider
            label="Forage value"
            icon={<Leaf className="h-3.5 w-3.5 text-leaf-2" />}
            value={priorities.forage}
            onChange={(v) => onChange({ ...priorities, forage: v })}
            hint="Grazing, hay and silage for livestock"
          />
        </div>
      </div>
    </section>
  )
}
