// components/PhoneMockup.tsx

import type { DeviceKind } from "@/lib/types";

type PhoneMockupProps = {
  screenshotUrl: string | null;
  device: DeviceKind;
  renderScale?: number;
  cornerScale?: number;
  frameWidthPx?: number;
};

export function PhoneMockup({
  screenshotUrl,
  device,
  renderScale = 1,
  cornerScale = 1,
  frameWidthPx,
}: PhoneMockupProps) {
  const isTablet = device === "tablet";
  const scalePx = (value: number) => `${value * renderScale}px`;
  const frameInset = isTablet ? 0.022 : 0.027;
  const screenInset = frameWidthPx ? `${frameWidthPx * frameInset}px` : `${frameInset * 100}%`;

  const bodyRadius = isTablet ? scalePx(72 * cornerScale) : scalePx(96 * cornerScale);
  const screenRadius = isTablet ? scalePx(54 * cornerScale) : scalePx(78 * cornerScale);

  return (
    <div className="relative h-full w-full">
      <div
        className="relative mx-auto bg-[#111827]"
        style={{
          width: "100%",
          height: "100%",
          borderRadius: bodyRadius,
          boxShadow: `0 ${scalePx(30)} ${scalePx(56)} rgba(15,23,42,0.18)`,
        }}
      >
        {/* Right power button */}
        <div
          className="absolute bg-[#0b1120]"
          style={{
            right: "-1.05%",
            top: "28%",
            width: "1.15%",
            height: isTablet ? "9%" : "10%",
            borderRadius: "999px",
            boxShadow: `inset -${scalePx(1)} 0 ${scalePx(1)} rgba(255,255,255,0.16)`,
          }}
        />

        {/* Left upper volume button */}
        <div
          className="absolute bg-[#0b1120]"
          style={{
            left: "-1.05%",
            top: isTablet ? "22%" : "23%",
            width: "1.15%",
            height: isTablet ? "7.5%" : "8.5%",
            borderRadius: "999px",
            boxShadow: `inset ${scalePx(1)} 0 ${scalePx(1)} rgba(255,255,255,0.16)`,
          }}
        />

        {/* Left lower volume button */}
        <div
          className="absolute bg-[#0b1120]"
          style={{
            left: "-1.05%",
            top: isTablet ? "33%" : "34%",
            width: "1.15%",
            height: isTablet ? "7.5%" : "8.5%",
            borderRadius: "999px",
            boxShadow: `inset ${scalePx(1)} 0 ${scalePx(1)} rgba(255,255,255,0.16)`,
          }}
        />

        {/* Screen */}
        <div
          className="absolute bg-white"
          style={{
            inset: screenInset,
            borderRadius: screenRadius,
            overflow: "hidden",
          }}
        >
          {screenshotUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={screenshotUrl}
              alt="Uploaded app screenshot preview"
              className="block h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full flex-col justify-between bg-[linear-gradient(180deg,#0f172a_0%,#1e3a8a_48%,#60a5fa_100%)] p-[8%] text-white">
              <div>
                <div
                  className="uppercase text-white/60"
                  style={{
                    fontSize: scalePx(8),
                    letterSpacing: `${0.35 * renderScale}em`,
                  }}
                >
                  Sample app
                </div>
                <div
                  className="mt-[6%] font-semibold"
                  style={{ fontSize: scalePx(13) }}
                >
                  Momentum dashboard
                </div>
              </div>

              <div className="space-y-[5%]">
                <div
                  className="bg-white/14 p-[8%]"
                  style={{ borderRadius: scalePx(24) }}
                >
                  <div className="font-semibold" style={{ fontSize: scalePx(22) }}>
                    94%
                  </div>
                  <div
                    className="mt-[4%] text-white/72"
                    style={{ fontSize: scalePx(10) }}
                  >
                    Goal completion this week
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-[4%]">
                  {["Plan", "Build", "Ship"].map((item) => (
                    <div
                      key={item}
                      className="bg-white/12 px-[4%] py-[16%] text-center text-white/78"
                      style={{
                        borderRadius: scalePx(18),
                        fontSize: scalePx(9),
                      }}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Dynamic Island */}
          {!isTablet && (
            <div
              className="absolute left-1/2 top-[1.8%] z-20 -translate-x-1/2 bg-black"
              style={{
                width: "34%",
                height: "3.3%",
                borderRadius: "999px",
              }}
            />
          )}

        </div>

        {/* Outer edge highlight */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            borderRadius: bodyRadius,
            boxShadow: `inset 0 0 0 ${scalePx(1)} rgba(255,255,255,0.14), inset 0 ${scalePx(16)} ${scalePx(28)} rgba(255,255,255,0.07), inset 0 -${scalePx(18)} ${scalePx(30)} rgba(0,0,0,0.22)`,
          }}
        />
      </div>
    </div>
  );
}
