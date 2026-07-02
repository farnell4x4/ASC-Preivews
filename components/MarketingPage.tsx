import Link from "next/link";

const features = [
  "Exact ASC sizes",
  "Real iPhone-style mockups",
  "No sign in",
  "Export ready-to-upload PNGs",
];

export function MarketingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 lg:px-10">
      <header className="flex items-center justify-between rounded-full border border-white/70 bg-white/70 px-5 py-3 shadow-panel backdrop-blur">
        <div className="text-sm font-semibold tracking-[0.24em] text-slate-500 uppercase">
          ASC Screenshot Maker
        </div>
        <Link
          href="/editor"
          className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Start Making Screenshots
        </Link>
      </header>

      <section className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1.08fr_0.92fr] lg:py-20">
        <div className="max-w-2xl">
          <div className="inline-flex rounded-full border border-sky-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
            Browser-based App Store screenshot builder
          </div>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
            Make App Store screenshots without fighting design tools.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Upload your app screenshot, drop it into a clean iPhone mockup, add text, and export
            App Store Connect-ready images.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/editor"
              className="rounded-full bg-blue-600 px-7 py-4 text-base font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-500"
            >
              Start Making Screenshots
            </Link>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {features.map((feature) => (
              <div
                key={feature}
                className="rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-panel"
              >
                <div className="text-base font-semibold text-slate-900">{feature}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/80 bg-white/80 p-5 shadow-panel backdrop-blur">
          <div className="rounded-[1.75rem] bg-[linear-gradient(180deg,#eff6ff_0%,#ffffff_45%,#fff7ed_100%)] p-6">
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
              Preview
            </div>
            <div className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
              Track what matters
            </div>
            <div className="mt-2 text-base text-slate-500">
              Simple. Clean. Focused.
            </div>
            <div className="mt-8 flex justify-center">
              <div className="relative w-[230px] rounded-[2.8rem] bg-[#101828] p-[11px] shadow-[0_30px_70px_rgba(15,23,42,0.24)]">
                <div className="absolute left-1/2 top-3 h-6 w-28 -translate-x-1/2 rounded-full bg-black/80" />
                <div className="rounded-[2.25rem] bg-white p-[10px]">
                  <div className="overflow-hidden rounded-[2rem] bg-[linear-gradient(180deg,#0f172a_0%,#1d4ed8_55%,#93c5fd_100%)]">
                    <div className="px-5 pb-5 pt-11 text-white">
                      <div className="text-xs uppercase tracking-[0.28em] text-white/65">
                        This week
                      </div>
                      <div className="mt-5 rounded-[1.6rem] bg-white/14 p-4 backdrop-blur">
                        <div className="text-3xl font-semibold">8.4k</div>
                        <div className="mt-2 text-sm text-white/78">Steps above your target</div>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-3">
                        {["Focus", "Sleep", "Goals"].map((item) => (
                          <div key={item} className="rounded-2xl bg-white/12 px-3 py-4 text-center text-xs">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-[11px] rounded-[2.25rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.18),transparent_28%)]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="pb-4 pt-2 text-center text-sm text-slate-500">
        ASC Screenshot Maker
      </footer>
    </main>
  );
}
