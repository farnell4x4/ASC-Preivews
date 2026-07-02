// components/PhoneMockup.tsx

import Image from "next/image";
import type { DeviceKind } from "@/lib/types";

type PhoneMockupProps = {
  screenshotUrl: string | null;
  device: DeviceKind;
};

export function PhoneMockup({ screenshotUrl, device }: PhoneMockupProps) {
  const isTablet = device === "tablet";

  return (
    <div className="relative w-full">
      <div
        className="relative mx-auto bg-[#111827] shadow-[0_34px_80px_rgba(15,23,42,0.36)]"
        style={{
          width: "100%",
          aspectRatio: isTablet ? "0.78 / 1" : "0.49 / 1",
          borderRadius: isTablet ? "7.5% / 5.85%" : "10.5% / 5.15%",
          padding: isTablet ? "2.2%" : "2.7%",
        }}
      >
        {/* Right power button - keep current position */}
        <div
          className="absolute bg-[#0b1120]"
          style={{
            right: "-1.05%",
            top: "28%",
            width: "1.15%",
            height: isTablet ? "9%" : "10%",
            borderRadius: "999px",
            boxShadow: "inset -1px 0 1px rgba(255,255,255,0.16)",
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
            boxShadow: "inset 1px 0 1px rgba(255,255,255,0.16)",
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
            boxShadow: "inset 1px 0 1px rgba(255,255,255,0.16)",
          }}
        />

        {/* Screen */}
        <div
          className="relative h-full w-full overflow-hidden bg-white"
          style={{
            borderRadius: isTablet ? "5.8% / 4.5%" : "8.2% / 4%",
          }}
        >
          {screenshotUrl ? (
            <Image
              src={screenshotUrl}
              alt="Uploaded app screenshot preview"
              fill
              unoptimized
              sizes="100vw"
              className="object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full flex-col justify-between bg-[linear-gradient(180deg,#0f172a_0%,#1e3a8a_48%,#60a5fa_100%)] p-[8%] text-white">
              <div>
                <div className="text-[8px] uppercase tracking-[0.35em] text-white/60">
                  Sample app
                </div>
                <div className="mt-[6%] text-[13px] font-semibold">
                  Momentum dashboard
                </div>
              </div>

              <div className="space-y-[5%]">
                <div className="rounded-[24px] bg-white/14 p-[8%] backdrop-blur">
                  <div className="text-[22px] font-semibold">94%</div>
                  <div className="mt-[4%] text-[10px] text-white/72">
                    Goal completion this week
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-[4%]">
                  {["Plan", "Build", "Ship"].map((item) => (
                    <div
                      key={item}
                      className="rounded-[18px] bg-white/12 px-[4%] py-[16%] text-center text-[9px] text-white/78"
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

          {/* Subtle glass */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),transparent_24%,transparent_62%,rgba(255,255,255,0.05)_100%)]" />
        </div>

        {/* Outer edge highlight */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            borderRadius: isTablet ? "7.5% / 5.85%" : "10.5% / 5.15%",
            boxShadow:
              "inset 0 0 0 1px rgba(255,255,255,0.14), inset 0 16px 28px rgba(255,255,255,0.07), inset 0 -18px 30px rgba(0,0,0,0.22)",
          }}
        />
      </div>
    </div>
  );
}