import React from "react";

export default function StatsSection() {
  const stats = [
    {
      value: "PKR 4.8B+",
      label: "Cars Traded Safely",
      highlight: false
    },
    {
      value: "98.6%",
      label: "Customer Satisfaction",
      highlight: true
    },
    {
      value: "200-Point",
      label: "Digital Condition Report",
      highlight: false
    },
    {
      value: "7-Day",
      label: "Return Assurance Window",
      highlight: false
    }
  ];

  return (
    <section className="w-full max-w-7xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin pb-16">
      <div className="w-full rounded-[14px] bg-surface-container-lowest p-6 md:p-8 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-outline-variant/30">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 divide-y-0 text-center">
          {stats.map((stat, idx) => (
            <div key={idx} className="flex flex-col items-center justify-center p-2">
              <div
                className={`font-display text-headline-lg md:text-display font-semibold ${
                  stat.highlight ? "text-primary" : "text-on-surface"
                }`}
              >
                {stat.value}
              </div>
              <div className="font-body-sm text-body-sm text-on-surface-variant mt-1 font-medium">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
