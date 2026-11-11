import InspectionStandard from "../models/inspectionStandard.model.js";
import InspectionHub from "../models/inspectionHub.model.js";

const DEFAULT_DOMAINS = [
  {
    id: "engine",
    label: "Engine & Driveline",
    points: 48,
    icon: "engineering",
    summary: "OBD-II telemetry, compression consistency, fluid integrity, and cooling pressure.",
    checks: [
      {
        name: "ECU & OBD-II Fault Telemetry Scan",
        tool: "OEM OBD-II Scanner",
        standard: "Zero active or pending powertrain DTC codes",
        critical: true,
      },
      {
        name: "Cold-Start Idle, Knock & Blow-By Inspection",
        tool: "Acoustic & Vacuum Gauge",
        standard: "Smooth idle within +/-30 RPM, zero crankcase blow-by smoke",
        critical: true,
      },
      {
        name: "Transmission Fluid & Shift Solenoid Response",
        tool: "Diagnostic & Visual Dipstick Check",
        standard: "Clean ATF/CVTF color with zero burnt odor or hesitation",
        critical: true,
      },
      {
        name: "Radiator, Water Pump & Head Gasket Pressure Test",
        tool: "Cooling System Pressure Tester",
        standard: "Holds rated bar pressure cleanly with zero coolant seepage",
        critical: true,
      },
      {
        name: "Engine Mounts, Belts, Alternator & Battery Health",
        tool: "Load & Ripple Multimeter",
        standard: "13.8V-14.4V charging output; >=80% CCA battery state of health",
        critical: false,
      },
      {
        name: "Oil Pan, Valve Cover & Rear Main Seal Leaks",
        tool: "Lift Underbody UV Inspection",
        standard: "No active oil drips onto exhaust manifold or subframe",
        critical: false,
      },
    ],
  },
  {
    id: "chassis",
    label: "Chassis & Paint Micron",
    points: 44,
    icon: "directions_car",
    summary: "Ultrasonic coating-depth scan across every body panel, pillars, and core rails.",
    checks: [
      {
        name: "12-Panel Digital Paint Thickness Scan",
        tool: "Ultrasonic Coating Gauge (um)",
        standard: "Factory OEM 80-130 um tolerance verified on pillars & roof",
        critical: true,
      },
      {
        name: "Front Aprons, Radiator Core Support & Chassis Rails",
        tool: "Structural Frame Gauge",
        standard: "Factory spot-welds intact; zero frame straightening or cuts",
        critical: true,
      },
      {
        name: "Boot Floor, Quarter Panels & Rear Sealant Seams",
        tool: "Factory Seam Audit",
        standard: "Original OEM polyurethane seam sealer present on trunk tub",
        critical: true,
      },
      {
        name: "Flood, Moisture Line & Salt-Belt Corrosion Audit",
        tool: "Borescope & Carpet Anchor Check",
        standard: "Zero silt residue or rust pitting under seat rails & firewall",
        critical: true,
      },
      {
        name: "Windshield, OEM Glass Stamps & Panel Gaps",
        tool: "Gap Feeler Gauge",
        standard: "Uniform 3.5-4.5 mm shut lines and matching year glass stamps",
        critical: false,
      },
      {
        name: "Door Hinges, Fender Bolts & Hood Alignment",
        tool: "Tool-Mark Visual Verification",
        standard: "Zero cracked bolt paint on non-replaceable structural panels",
        critical: false,
      },
    ],
  },
  {
    id: "suspension",
    label: "Suspension & Brakes",
    points: 36,
    icon: "tire_repair",
    summary: "Undercarriage geometry, shock absorber rebound, rotor runout, and tire tread depth.",
    checks: [
      {
        name: "Brake Pad Thickness & Rotor Scoring Measurement",
        tool: "Digital Micrometer Caliper",
        standard: ">=4 mm friction material remaining; within OEM rotor min spec",
        critical: true,
      },
      {
        name: "Front & Rear Shock Struts & Bushings",
        tool: "Hydraulic Lift Rebound Audit",
        standard: "Dry strut seals; zero torn lower control arm bushes",
        critical: true,
      },
      {
        name: "EPS Steering Rack, Tie-Rod Ends & Ball Joints",
        tool: "Dial Indicator Play Check",
        standard: "Zero knocking or axial steering play at lock-to-lock",
        critical: true,
      },
      {
        name: "CV Axle Boots, Differential & Propeller Shaft",
        tool: "Underbody Lift Inspection",
        standard: "Intact rubber boots; zero clicking on tight turning circles",
        critical: false,
      },
      {
        name: "Tire Tread Depth & DOT Manufacturing Date",
        tool: "Digital Tread Gauge",
        standard: ">=3.5 mm uniform tread across shoulders; DOT age <=5 years",
        critical: false,
      },
      {
        name: "ABS Wheel Speed Sensors & Handbrake Hold",
        tool: "OBD-II ABS Live Telemetry",
        standard: "Equal wheel-speed readings; firm parking brake engagement",
        critical: false,
      },
    ],
  },
  {
    id: "interior",
    label: "Interior & Electrical",
    points: 34,
    icon: "bolt",
    summary: "SRS airbags, HVAC vent temperatures, infotainment, and cabin controls.",
    checks: [
      {
        name: "SRS Airbags, Seatbelt Pretensioners & Warning Lamps",
        tool: "SRS Diagnostic Module",
        standard: "Self-test illumination clears cleanly; zero bypass resistors",
        critical: true,
      },
      {
        name: "AC Compressor Pressure & Vent Cooling Delta",
        tool: "Laser Infrared Thermometer",
        standard: "Cabin vent temperature <=8 C at idle within 3 minutes",
        critical: true,
      },
      {
        name: "Odometer Tampering & Cluster ECU Cross-Check",
        tool: "ECU Mileage Reconciliation",
        standard: "Cluster mileage matches ABS/TCM freeze-frame records",
        critical: true,
      },
      {
        name: "Power Windows, Mirrors, Sunroof & Smart Entry",
        tool: "Full Switchgear Cycle",
        standard: "All actuators operate smoothly without binding or delay",
        critical: false,
      },
      {
        name: "Headlights, DRLs, Fog Lamps & Reverse Sensors",
        tool: "Exterior Lighting Bench Check",
        standard: "Full beam alignment and functioning parking cameras/sensors",
        critical: false,
      },
      {
        name: "Hybrid HV Battery Cell Balance (If Applicable)",
        tool: "Hybrid Battery Telemetry",
        standard: "Cell block voltage delta <0.3V under load test",
        critical: true,
      },
    ],
  },
  {
    id: "road",
    label: "Road Test & NVH",
    points: 22,
    icon: "speed",
    summary: "Real driving evaluation covering acceleration, shifting smoothness, and braking track.",
    checks: [
      {
        name: "Acceleration Pull & Throttle Response",
        tool: "15-Minute Controlled Road Drive",
        standard: "Linear power delivery with zero misfire under 3,500+ RPM load",
        critical: true,
      },
      {
        name: "Up-Shift / Down-Shift Calibration (Auto & Manual)",
        tool: "Drive-Cycle Shift Audit",
        standard: "Crisp gear engagement without clunk, flare, or clutch slip",
        critical: true,
      },
      {
        name: "Straight-Line Tracking & Emergency Braking Stability",
        tool: "60 km/h Brake-Balance Check",
        standard: "Zero steering wheel vibration, brake judder, or lateral pull",
        critical: true,
      },
      {
        name: "Cabin Rattle, Wind Seal & Wheel Bearing NVH",
        tool: "40-80 km/h Acoustic Evaluation",
        standard: "No hub bearing drone or loose dashboard trim rattles",
        critical: false,
      },
    ],
  },
  {
    id: "documents",
    label: "Excise & Biometrics",
    points: 20,
    icon: "verified_user",
    summary: "Chassis VIN verification, provincial Excise status, token taxes, and transfer readiness.",
    checks: [
      {
        name: "Chassis & Engine Serial Plate Verification",
        tool: "Laser Stamp vs Registration Book",
        standard: "Exact character match with zero tampering or re-stamping marks",
        critical: true,
      },
      {
        name: "Provincial Excise & Taxation Online Verification",
        tool: "Punjab / Sindh / Islamabad Portal",
        standard: "Active ownership match, zero CPLC / police hold flags",
        critical: true,
      },
      {
        name: "NADRA Biometric Transfer Readiness",
        tool: "Seller CNIC & Smart Card Check",
        standard: "Registered owner available for on-spot biometric slip",
        critical: true,
      },
      {
        name: "Original File, Duplicate Keys & Token Tax Clearance",
        tool: "Physical Document Audit",
        standard: "Complete return file & lifetime/annual token taxes paid",
        critical: false,
      },
    ],
  },
];

const DEFAULT_PAINT_SCALE = [
  {
    range: "80 - 130 um",
    label: "Genuine OEM Factory Paint",
    detail: "Original factory primer and clear coat untouched since assembly.",
    tone: "emerald",
  },
  {
    range: "140 - 220 um",
    label: "Cosmetic Shower / Clear-Coat Respray",
    detail: "Light surface respray for stone chips or scratches with zero body filler.",
    tone: "amber",
  },
  {
    range: "250+ um",
    label: "Putty / Structural Panel Repair",
    detail: "Body filler detected; flagged prominently and inspected for inner rail impact.",
    tone: "rose",
  },
];

const DEFAULT_GRADING_RULES = [
  {
    scoreRange: "9.0 - 10.0",
    title: "AutoBazaar Certified",
    statusLabel: "Approved",
    description:
      "Zero structural/chassis accidents, clean OBD-II scan, verified Excise smart card & biometric readiness.",
    tone: "emerald",
  },
  {
    scoreRange: "7.5 - 8.9",
    title: "Verified Standard",
    statusLabel: "Approved + Notes",
    description:
      "Mechanically sound with minor cosmetic wear or routine wear-and-tear disclosed transparently to buyers.",
    tone: "neutral",
  },
  {
    scoreRange: "Below 7.5",
    title: "Structural / Tamper Flag",
    statusLabel: "Flagged",
    description:
      "Odometer rollback, flood damage, frame rail cut/weld, or disputed Excise records are flagged and blocked.",
    tone: "rose",
  },
];

const DEFAULT_HUBS = [
  {
    city: "Karachi",
    cityTags: ["karachi"],
    name: "AutoBazaar Shahrah-e-Faisal Diagnostic Center",
    address: "Shahrah-e-Faisal Automotive Hub, Block 6 PECHS",
    hours: "Mon-Sat | 9:30 AM - 7:30 PM",
    baysCount: 4,
    baysLabel: "4 Diagnostic Lift Bays",
    phone: "+92 21 3514 8200",
    isActive: true,
    sortOrder: 1,
  },
  {
    city: "Lahore",
    cityTags: ["lahore"],
    name: "AutoBazaar DHA Phase 5 Inspection Hub",
    address: "DHA Phase 5 Commercial Center, Sector C",
    hours: "Mon-Sat | 9:30 AM - 7:30 PM",
    baysCount: 5,
    baysLabel: "5 Diagnostic Lift Bays",
    phone: "+92 42 3578 9410",
    isActive: true,
    sortOrder: 2,
  },
  {
    city: "Islamabad",
    cityTags: ["islamabad"],
    name: "AutoBazaar Blue Area Express Center",
    address: "Blue Area Tech & Auto Arcade, Jinnah Avenue",
    hours: "Mon-Sat | 10:00 AM - 7:00 PM",
    baysCount: 3,
    baysLabel: "3 Diagnostic Lift Bays",
    phone: "+92 51 2804 510",
    isActive: true,
    sortOrder: 3,
  },
  {
    city: "Rawalpindi & Peshawar",
    cityTags: ["rawalpindi", "peshawar"],
    name: "AutoBazaar Twin-City & KPK Regional Hub",
    address: "Bahria Town Civic Center & University Road Hubs",
    hours: "Mon-Sat | 10:00 AM - 6:30 PM",
    baysCount: 3,
    baysLabel: "3 Regional Express Bays",
    phone: "+92 51 5730 920",
    isActive: true,
    sortOrder: 4,
  },
];

/**
 * Ensures the MongoDB InspectionStandard and InspectionHub collections
 * contain initial operational configuration if empty.
 */
export async function seedInspectionSystemIfEmpty() {
  try {
    const standardCount = await InspectionStandard.countDocuments();
    if (standardCount === 0) {
      await InspectionStandard.create({
        key: "autobazaar_inspection_standard",
        title: "AutoBazaar 204-Point Certification Standard",
        minimumApprovedScore: 7.5,
        certifiedThresholdScore: 9.0,
        domains: DEFAULT_DOMAINS,
        paintScale: DEFAULT_PAINT_SCALE,
        gradingRules: DEFAULT_GRADING_RULES,
      });
    }
  } catch (err) {
    if (err.code !== 11000) throw err;
  }

  try {
    const hubCount = await InspectionHub.countDocuments();
    if (hubCount === 0) {
      await InspectionHub.insertMany(DEFAULT_HUBS, { ordered: false });
    }
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
}

