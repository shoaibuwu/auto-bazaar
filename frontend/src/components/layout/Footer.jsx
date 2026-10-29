import React from "react";

export default function Footer() {
  return (
    <footer className="w-full bg-surface-container-lowest border-t border-outline-variant/40 mt-space-xl">
      <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin py-space-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-lg mb-space-xl">
          
          {/* Brand Info */}
          <div className="space-y-space-sm">
            <div className="flex items-center gap-space-xs mb-space-xs">
              <span className="font-title text-title font-semibold text-on-surface">AutoBazaar</span>
              <span className="font-label-sm text-label-sm text-primary uppercase font-bold tracking-wider">
                PK
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              Pakistan's verified digital automobile showroom and certified valuation authority. Frictionless pre-owned transactions nationwide.
            </p>
            <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm pt-space-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              <span>All systems live • Live PKR Spot Rates</span>
            </div>
          </div>

          {/* Regional Hubs */}
          <div className="space-y-space-xs">
            <h4 className="font-title text-body-md font-semibold text-on-surface uppercase tracking-wide">
              Regional Hubs
            </h4>
            <ul className="space-y-1.5 font-body-sm text-body-sm text-on-surface-variant">
              <li>Karachi: Shahrah-e-Faisal Automotive Hub</li>
              <li>Lahore: DHA Phase 5 Commercial Center</li>
              <li>Islamabad: Blue Area Tech & Auto Arcade</li>
              <li>Peshawar & Rawalpindi Inspection Bays</li>
            </ul>
          </div>

          {/* Marketplace Trust */}
          <div className="space-y-space-xs">
            <h4 className="font-title text-body-md font-semibold text-on-surface uppercase tracking-wide">
              Marketplace Trust
            </h4>
            <ul className="space-y-1.5 font-body-sm text-body-sm text-on-surface-variant">
              <li>AutoBazaar 200+ Point Inspection</li>
              <li>Excise & Taxation Verification</li>
              <li>Bank Alfalah & Meezan Auto Finance</li>
              <li>Verified Dealer Network</li>
            </ul>
          </div>

          {/* Compliance & Legal */}
          <div className="space-y-space-xs">
            <h4 className="font-title text-body-md font-semibold text-on-surface uppercase tracking-wide">
              Compliance & Legal
            </h4>
            <ul className="space-y-1.5 font-body-sm text-body-sm text-on-surface-variant">
              <li>FBR NTN: 9481204-7 (Verified)</li>
              <li>SECP Registered FinTech Mobility</li>
              <li>Pricing Standard: Metric km / PKR Rs.</li>
              <li>Toll-Free: 0800-28867 (BAZAAR)</li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-space-md border-t border-outline-variant/30 flex flex-col sm:flex-row items-center justify-between gap-space-sm text-on-surface-variant font-label-md text-label-md">
          <div>© 2025 AutoBazaar Pakistan Technologies Ltd. All rights reserved.</div>
          <div className="flex items-center gap-space-md flex-wrap justify-center">
            <a className="hover:text-on-surface transition-colors" href="#privacy">
              Privacy Policy
            </a>
            <a className="hover:text-on-surface transition-colors" href="#terms">
              Terms of Service
            </a>
            <a className="hover:text-on-surface transition-colors" href="#inspection-criteria">
              Inspection Criteria
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
