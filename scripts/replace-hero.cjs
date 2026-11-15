// Replaces the old Hero component in App.tsx with a compact intro band that
// uses the real field photograph, and drops the now-duplicated console card.
const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', 'src', 'App.tsx')
const src = fs.readFileSync(file, 'utf8')

const start = src.indexOf('function Hero({ onDemo }: { onDemo: () => void }) {')
if (start < 0) {
  console.error('Hero() not found')
  process.exit(1)
}
const endMarker = '\n}\n'
const end = src.indexOf('\n}\n', src.indexOf('{/* How it works strip */}', start))
if (end < 0) {
  console.error('Hero() end not found')
  process.exit(1)
}

const replacement = `function IntroBand({ onDemo }: { onDemo: () => void }) {
  return (
    <section id="top" className="relative overflow-hidden bg-panel text-panel-text">
      {/* field photograph */}
      <img
        src="/images/hero-farmer.jpg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-panel via-panel/90 to-panel/55" />
      <div className="pointer-events-none absolute -top-32 right-1/4 h-96 w-96 rounded-full bg-leaf/15 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-5 py-14 lg:py-20">
        <div className="rise max-w-2xl">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Chip tone="ochre">NASA Space Apps 2026</Chip>
            <Chip tone="dark">Field Shift challenge</Chip>
            <Chip tone="dark">South Africa 🇿🇦</Chip>
          </div>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            Read your fields from orbit.
            <span className="block text-leaf-3">Plan the seasons ahead.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-panel-text/75">
            Rainfall is shifting. Heat spells stretch. The water bank under your feet matters more every
            year. FieldShift turns{' '}
            <strong className="text-panel-text">30+ years of NASA Earth observations</strong> into a
            plain-language health check for your exact field — scored against <em>your</em> priorities,
            and always deferring to your judgement.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              onClick={onDemo}
              className="group flex items-center gap-2.5 rounded-full bg-leaf px-6 py-3.5 text-sm font-semibold text-white shadow-card transition hover:bg-leaf-2 hover:shadow-lift"
            >
              <Sprout className="h-4 w-4 transition group-hover:scale-110" />
              Try a Free State demo farm
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </button>
            <a
              href="#console"
              className="rounded-full border border-panel-line px-6 py-3.5 text-sm font-semibold text-panel-text transition hover:border-leaf-3 hover:text-leaf-3"
            >
              Open the field console
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-7 gap-y-2 text-[11px] text-panel-text/55">
            <span><strong className="data-tabular text-panel-text/80">{CROPS.length}</strong> SA rotation crops</span>
            <span><strong className="data-tabular text-panel-text/80">5</strong> demo regions</span>
            <span><strong className="data-tabular text-panel-text/80">30+ yrs</strong> NASA POWER climatology</span>
            <span><strong className="data-tabular text-panel-text/80">4</strong> live NASA satellite layers</span>
          </div>
        </div>
      </div>
    </section>
  )
}
`

const out = src.slice(0, start) + replacement + src.slice(end + 3)
fs.writeFileSync(file, out)
console.log('Hero() replaced with IntroBand()')
