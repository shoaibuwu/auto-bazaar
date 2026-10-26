# AutoBazaar — Pakistan's Verified Used Car Marketplace

Modern, production-grade landing page for **AutoBazaar**, built with React (JSX), Vite, and TailwindCSS adhering to the **Kinetic Clarity** design system.

---

## 🚀 Quick Start

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Run Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

3. **Build for Production:**
   ```bash
   npm run build
   ```

---

## 📁 Component Architecture

```
auto-bazaar/
├── index.html                  # HTML entry point with Inter & Material Symbols fonts
├── package.json                # Project dependencies (React 18, Vite, TailwindCSS)
├── tailwind.config.js          # Kinetic Clarity custom theme tokens & palette
├── vite.config.js              # Vite server & React plugin configuration
└── src/
    ├── main.jsx                # Application root mount
    ├── App.jsx                 # Main Landing Page coordinating layout & state
    ├── index.css               # Design system rules, utilities & typography
    ├── data/
    │   ├── mockCars.js         # Verified car listings (Honda Civic, Kia Sportage, Fortuner, etc.)
    │   └── filters.js          # Metro cities, budget tiers, and body type filters
    └── components/
        ├── Header.jsx          # Top bar with logo, PK tag, search shortcut, theme toggle & avatar
        ├── HeroSearch.jsx      # Dynamic hero section with multi-faceted search & category pills
        ├── FeaturedCars.jsx    # Responsive 3-column car grid with verified badges & favorite hearts
        ├── HowItWorks.jsx      # 3-step inspection, escrow, and doorstep delivery workflow
        ├── StatsSection.jsx    # Guarantee strip & key metrics (PKR 4.8B+, 98.6% satisfaction)
        ├── Footer.jsx          # Regional hubs, marketplace trust, SECP/FBR compliance, & legal
        └── MobileBottomNav.jsx # Fixed bottom navigation for mobile viewports
```

---

## ✨ Features Included

- **Dynamic Search & Filtering:** Filter live by vehicle make/model, Pakistani metro hub (Karachi, Lahore, Islamabad, etc.), budget range in PKR, and body type (Sedan, SUV, Hatchback, etc.).
- **Interactive Favorite Hearts:** Bookmark cars with instant badge count updates in the header and mobile navigation.
- **Theme Toggle:** Switch smoothly between Light and Dark mode.
- **Verified Inspection Badges:** Visual scores (e.g. `9.4/10`) highlighting pre-inspected inventory.
- **Responsive Layout:** Tailored experiences for mobile (320px+), tablet, and desktop (1280px max-width).
