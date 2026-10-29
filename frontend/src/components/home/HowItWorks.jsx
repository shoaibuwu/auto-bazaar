import React from "react";

export default function HowItWorks() {
  const steps = [
    {
      number: "Step 01",
      icon: "verified",
      title: "Verified Inspection",
      description:
        "200+ point inspection report with paint & engine diagnostics, OBD-II scan, and chassis integrity verification.",
      tag: "Certified OBD-II Diagnostic Sync"
    },
    {
      number: "Step 02",
      icon: "lock",
      title: "Secure Escrow & Paperwork",
      description:
        "Hassle-free biometric transfer, token hold, and document verification through provincial excise authorities.",
      tag: "NADRA Biometric Facilitation"
    },
    {
      number: "Step 03",
      icon: "local_shipping",
      title: "Delivery to Your Door",
      description:
        "Test drive at your convenience across Karachi, Lahore, and Islamabad with complete documentation handed over.",
      tag: "Doorstep Flatbed Delivery Option"
    }
  ];

  return (
    <section className="w-full max-w-7xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin py-12 md:py-16">
      <div className="text-center max-w-xl mx-auto mb-space-xl">
        <h2 className="font-headline-lg text-headline-lg font-semibold text-on-surface tracking-tight mb-2">
          How AutoBazaar works
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Eliminating uncertainty with clinical diagnostics and verified ownership transfers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md md:gap-space-lg">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="rounded-[14px] bg-surface-container-lowest p-space-lg shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-outline-variant/30 flex flex-col justify-between transition-all hover:bg-surface-container-low/50"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary mb-space-md">
                <span className="material-symbols-outlined text-2xl">{step.icon}</span>
              </div>
              <div className="font-label-md text-label-md text-primary font-semibold tracking-wider uppercase mb-1">
                {step.number}
              </div>
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface mb-2">
                {step.title}
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                {step.description}
              </p>
            </div>
            <div className="pt-6 flex items-center gap-2 text-on-surface-variant font-label-sm text-label-sm">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              {step.tag}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
