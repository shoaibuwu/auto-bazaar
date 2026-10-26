export const cities = [
  { value: "all", label: "All Pakistan Cities" },
  { value: "karachi", label: "Karachi" },
  { value: "lahore", label: "Lahore" },
  { value: "islamabad", label: "Islamabad" },
  { value: "rawalpindi", label: "Rawalpindi" },
  { value: "peshawar", label: "Peshawar" },
  { value: "faisalabad", label: "Faisalabad" },
  { value: "multan", label: "Multan" }
];

export const budgetOptions = [
  { value: "any", label: "Any Price", max: Infinity },
  { value: "4m", label: "Up to PKR 4,000,000", max: 4000000 },
  { value: "6m", label: "Up to PKR 6,000,000", max: 6000000 },
  { value: "10m", label: "Up to PKR 10,000,000", max: 10000000 },
  { value: "15m+", label: "PKR 15,000,000+", min: 15000000 }
];

export const bodyTypes = [
  { id: "all", label: "All", icon: "apps" },
  { id: "sedan", label: "Sedan", icon: "directions_car" },
  { id: "suv", label: "SUV & Crossover", icon: "airport_shuttle" },
  { id: "hatchback", label: "Hatchback", icon: "minor_crash" },
  { id: "hybrid", label: "Hybrid & EV", icon: "bolt" },
  { id: "luxury", label: "Luxury", icon: "diamond" },
  { id: "commercial", label: "Commercial", icon: "local_shipping" }
];
