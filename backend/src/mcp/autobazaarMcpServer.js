import mongoose from "mongoose";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import Car from "../models/car.model.js";
import InspectionBooking from "../models/inspectionBooking.model.js";
import InspectionHub from "../models/inspectionHub.model.js";
import InspectionStandard from "../models/inspectionStandard.model.js";

/**
 * Format PKR numeric price into readable Pakistani units (Lac / Crore).
 */
export function formatPKR(val) {
  if (typeof val !== "number" || Number.isNaN(val)) return "PKR 0";
  if (val >= 10000000) {
    const cr = (val / 10000000).toFixed(2);
    return `PKR ${cr.endsWith(".00") ? cr.slice(0, -3) : cr} Crore`;
  }
  if (val >= 100000) {
    const lac = (val / 100000).toFixed(2);
    return `PKR ${lac.endsWith(".00") ? lac.slice(0, -3) : lac} Lac`;
  }
  return `PKR ${val.toLocaleString()}`;
}

/**
 * Normalize budget values provided in either Lacs or raw PKR rupees.
 * Small LLMs sometimes pass Lac numbers (e.g. 30) to a PKR field, or strings like "30 lac".
 */
function normalizeBudgetPKR(rawMaxPrice, rawMaxPriceLac) {
  if (rawMaxPriceLac !== undefined && rawMaxPriceLac !== null && !Number.isNaN(Number(rawMaxPriceLac))) {
    const lacVal = Number(rawMaxPriceLac);
    if (lacVal > 0 && lacVal < 1000) {
      return lacVal * 100000;
    }
    if (lacVal >= 1000) return lacVal;
  }

  if (rawMaxPrice !== undefined && rawMaxPrice !== null) {
    if (typeof rawMaxPrice === "string") {
      const lower = rawMaxPrice.toLowerCase().trim();
      const crMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:crore|cr)/);
      if (crMatch) return parseFloat(crMatch[1]) * 10000000;
      const lacMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:lac|lakh|lacs)/);
      if (lacMatch) return parseFloat(lacMatch[1]) * 100000;
    }
    const num = Number(rawMaxPrice);
    if (!Number.isNaN(num) && num > 0) {
      // If a small value < 1000 is passed as maxPrice, treat it as Lacs
      return num < 1000 ? num * 100000 : num;
    }
  }
  return undefined;
}

function serializeCarCard(car) {
  return {
    _id: String(car._id),
    title: car.title,
    make: car.make,
    model: car.model,
    year: car.year,
    price: car.price,
    priceFormatted: formatPKR(car.price),
    mileage: car.mileage,
    fuelType: car.fuelType,
    transmission: car.transmission,
    condition: car.condition,
    city: car.city || "Pakistan",
    bodyType: car.bodyType || "sedan",
    inspectionScore: car.inspectionScore ?? null,
    inspectionStatus: car.inspectionStatus || "not_inspected",
    images: Array.isArray(car.images) ? car.images : [],
  };
}

function formatCarSummaryLine(car) {
  const scorePart = car.inspectionScore
    ? `Inspection ${car.inspectionScore}/10 (${car.inspectionStatus || "verified"})`
    : "Not inspected yet";
  return [
    `${car.year} ${car.make} ${car.model} — "${car.title}" (ID: ${car._id})`,
    `  Price: ${formatPKR(car.price)} (PKR ${car.price?.toLocaleString() || 0})`,
    `  City: ${car.city || "Pakistan"} | Mileage: ${car.mileage?.toLocaleString() || 0} km`,
    `  Transmission: ${car.transmission} | Fuel: ${car.fuelType} | Body: ${car.bodyType || "sedan"} | Condition: ${car.condition}`,
    `  ${scorePart}`,
    car.description ? `  Notes: ${car.description.trim().slice(0, 180)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Create a configured AutoBazaar McpServer instance backed by live MongoDB models.
 */
export function createAutobazaarMcpServer() {
  const server = new McpServer({
    name: "autobazaar-mcp-server",
    version: "1.0.0",
  });

  // 1. Tool: search_cars
  server.registerTool(
    "search_cars",
    {
      description:
        "Search verified published cars in the AutoBazaar Pakistan MongoDB inventory. Use this whenever a user asks to find, filter, or recommend cars by budget, city, make, model, transmission, fuel type, body type, year, or inspection score.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Free-text keyword matching car title, make, model, or description (e.g. 'Corolla', 'Alto', 'Civic')"),
        make: z.string().optional().describe("Brand/make filter (e.g. 'Toyota', 'Honda', 'Suzuki', 'Kia')"),
        model: z.string().optional().describe("Model filter (e.g. 'Corolla', 'Civic', 'Alto', 'Sportage')"),
        city: z.string().optional().describe("City in Pakistan (e.g. 'Lahore', 'Karachi', 'Islamabad')"),
        transmission: z
          .string()
          .optional()
          .describe("Gearbox type: 'automatic' or 'manual' (leave omitted if any)"),
        fuelType: z
          .string()
          .optional()
          .describe("Fuel type: 'petrol', 'diesel', 'electric', or 'hybrid' (leave omitted if any)"),
        bodyType: z
          .string()
          .optional()
          .describe("Vehicle body type (e.g. 'sedan', 'hatchback', 'suv', 'crossover')"),
        maxPriceLac: z
          .coerce.number()
          .optional()
          .describe("Preferred for Pakistani budgets: Maximum budget in PKR Lacs (e.g. 30 for 30 Lac, 50 for 50 Lac, 120 for 1.2 Crore)"),
        maxPricePKR: z
          .union([z.coerce.number(), z.string()])
          .optional()
          .describe("Maximum budget in raw PKR rupees (e.g. 3000000 for 30 Lac)"),
        minPricePKR: z.coerce.number().optional().describe("Minimum price in raw PKR rupees"),
        minYear: z.coerce.number().optional().describe("Minimum manufacturing year (e.g. 2018)"),
        minInspectionScore: z
          .coerce.number()
          .optional()
          .describe("Minimum 200-point inspection score out of 10 (e.g. 8.5 or 9)"),
        sort: z
          .string()
          .optional()
          .describe("Sort order: 'newest', 'price_asc', 'price_desc', 'score_desc', or 'mileage_asc'"),
        limit: z.coerce.number().optional().describe("Max cars to return (default 5)"),
      },
    },
    async (args) => {
      const filter = { status: "published" };

      if (args.query && args.query.trim()) {
        const escaped = args.query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.$or = [
          { title: { $regex: escaped, $options: "i" } },
          { make: { $regex: escaped, $options: "i" } },
          { model: { $regex: escaped, $options: "i" } },
          { description: { $regex: escaped, $options: "i" } },
        ];
      }
      if (args.make && args.make.trim()) {
        filter.make = { $regex: args.make.trim(), $options: "i" };
      }
      if (args.model && args.model.trim()) {
        filter.model = { $regex: args.model.trim(), $options: "i" };
      }
      if (args.city && args.city.trim()) {
        filter.city = { $regex: args.city.trim(), $options: "i" };
      }
      if (args.transmission && args.transmission.trim()) {
        const tx = args.transmission.trim().toLowerCase();
        if (tx.startsWith("auto")) filter.transmission = "automatic";
        else if (tx.startsWith("manu")) filter.transmission = "manual";
      }
      if (args.fuelType && args.fuelType.trim()) {
        const ft = args.fuelType.trim().toLowerCase();
        if (["petrol", "diesel", "electric", "hybrid"].includes(ft)) {
          filter.fuelType = ft;
        }
      }
      if (args.bodyType && args.bodyType.trim()) {
        filter.bodyType = { $regex: args.bodyType.trim(), $options: "i" };
      }

      const maxBudget = normalizeBudgetPKR(args.maxPricePKR, args.maxPriceLac);
      const minPrice = Number(args.minPricePKR) > 0 ? Number(args.minPricePKR) : undefined;
      if (maxBudget !== undefined || minPrice !== undefined) {
        filter.price = {};
        if (maxBudget !== undefined) filter.price.$lte = maxBudget;
        if (minPrice !== undefined) filter.price.$gte = minPrice;
      }

      if (Number(args.minYear) >= 1900) {
        filter.year = { $gte: Number(args.minYear) };
      }
      if (Number(args.minInspectionScore) > 0) {
        filter.inspectionScore = { $gte: Number(args.minInspectionScore) };
      }

      const sortMap = {
        newest: { createdAt: -1 },
        price_asc: { price: 1 },
        price_desc: { price: -1 },
        score_desc: { inspectionScore: -1, createdAt: -1 },
        mileage_asc: { mileage: 1 },
      };
      const sortOption = sortMap[(args.sort || "").trim()] || { inspectionScore: -1, createdAt: -1 };
      const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 10);

      const cars = await Car.find(filter)
        .select(
          "_id title make model year price mileage fuelType transmission condition city bodyType description images inspectionScore inspectionStatus"
        )
        .sort(sortOption)
        .limit(limit)
        .lean();

      const serialized = cars.map(serializeCarCard);

      if (serialized.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No published cars matched those exact filters in AutoBazaar inventory. Try loosening budget, city, or transmission filters, or call get_inventory_summary to inspect what is currently listed.",
            },
          ],
          structuredContent: { count: 0, cars: [] },
        };
      }

      const textSummary = [
        `Found ${serialized.length} matching published car(s) in AutoBazaar:`,
        ...cars.map((c, idx) => `\nOption ${idx + 1}:\n${formatCarSummaryLine(c)}`),
      ].join("\n");

      return {
        content: [{ type: "text", text: textSummary }],
        structuredContent: { count: serialized.length, cars: serialized },
      };
    }
  );

  // 2. Tool: get_car_details
  server.registerTool(
    "get_car_details",
    {
      description:
        "Get comprehensive details and the latest 200-point physical inspection breakdown (engine, chassis, suspension, interior, road test, documents, inspector notes) for a specific car by ID or title.",
      inputSchema: {
        carId: z.string().optional().describe("MongoDB Car _id"),
        titleQuery: z.string().optional().describe("Car title/model search if carId is unknown"),
      },
    },
    async ({ carId, titleQuery }) => {
      let car = null;
      if (carId && mongoose.Types.ObjectId.isValid(carId)) {
        car = await Car.findOne({ _id: carId, status: "published" })
          .populate("seller", "name city")
          .lean();
      } else if (titleQuery && titleQuery.trim()) {
        const escaped = titleQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        car = await Car.findOne({
          status: "published",
          $or: [
            { title: { $regex: escaped, $options: "i" } },
            { model: { $regex: escaped, $options: "i" } },
          ],
        })
          .populate("seller", "name city")
          .lean();
      }

      if (!car) {
        return {
          content: [{ type: "text", text: "Car listing not found or is not currently published." }],
          structuredContent: { found: false, car: null },
        };
      }

      let inspectionReport = null;
      if (car.latestInspectionBooking) {
        inspectionReport = await InspectionBooking.findById(car.latestInspectionBooking)
          .populate("hub", "name city address")
          .lean();
      } else {
        inspectionReport = await InspectionBooking.findOne({
          car: car._id,
          status: "completed",
        })
          .sort({ completedAt: -1 })
          .populate("hub", "name city address")
          .lean();
      }

      const lines = [
        formatCarSummaryLine(car),
        car.seller?.name ? `  Seller: ${car.seller.name} (${car.seller.city || car.city})` : null,
      ];

      if (inspectionReport) {
        const ds = inspectionReport.domainScores || {};
        lines.push(
          `  Inspection Grade: ${inspectionReport.grade} | Overall Score: ${inspectionReport.score ?? car.inspectionScore}/10`,
          `  Domain Scores -> Engine: ${ds.engine ?? "N/A"}, Chassis: ${ds.chassis ?? "N/A"}, Suspension: ${ds.suspension ?? "N/A"}, Interior: ${ds.interior ?? "N/A"}, Road Test: ${ds.road ?? "N/A"}, Documents: ${ds.documents ?? "N/A"}`
        );
        if (inspectionReport.inspectorNotes) {
          lines.push(`  Inspector Notes: ${inspectionReport.inspectorNotes}`);
        }
        if (inspectionReport.hub?.name) {
          lines.push(`  Inspected At: ${inspectionReport.hub.name} (${inspectionReport.hub.city})`);
        }
      }

      const serialized = serializeCarCard(car);
      return {
        content: [{ type: "text", text: lines.filter(Boolean).join("\n") }],
        structuredContent: {
          found: true,
          cars: [serialized],
          car: serialized,
          inspection: inspectionReport
            ? {
                grade: inspectionReport.grade,
                score: inspectionReport.score,
                domainScores: inspectionReport.domainScores || {},
                inspectorNotes: inspectionReport.inspectorNotes || "",
              }
            : null,
        },
      };
    }
  );

  // 3. Tool: compare_cars
  server.registerTool(
    "compare_cars",
    {
      description:
        "Compare 2 or more AutoBazaar cars side by side on price, mileage, year, transmission, fuel type, city, and inspection score.",
      inputSchema: {
        carIds: z.array(z.string()).optional().describe("List of car MongoDB IDs to compare"),
        keywords: z
          .array(z.string())
          .optional()
          .describe("Car names/models to compare if IDs are not known (e.g. ['Corolla', 'Alto'])"),
      },
    },
    async ({ carIds = [], keywords = [] }) => {
      const validIds = carIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
      let cars = [];

      if (validIds.length > 0) {
        cars = await Car.find({ _id: { $in: validIds }, status: "published" }).lean();
      } else if (keywords.length > 0) {
        const orClauses = keywords.map((kw) => {
          const escaped = kw.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return {
            $or: [
              { title: { $regex: escaped, $options: "i" } },
              { make: { $regex: escaped, $options: "i" } },
              { model: { $regex: escaped, $options: "i" } },
            ],
          };
        });
        cars = await Car.find({ status: "published", $or: orClauses }).limit(4).lean();
      } else {
        cars = await Car.find({ status: "published" }).sort({ createdAt: -1 }).limit(3).lean();
      }

      if (cars.length === 0) {
        return {
          content: [{ type: "text", text: "No matching cars found to compare." }],
          structuredContent: { cars: [] },
        };
      }

      const serialized = cars.map(serializeCarCard);
      const comparisonText = [
        `Side-by-side comparison of ${serialized.length} AutoBazaar cars:`,
        ...cars.map((c, i) => `\n[${i + 1}] ${formatCarSummaryLine(c)}`),
      ].join("\n");

      return {
        content: [{ type: "text", text: comparisonText }],
        structuredContent: { cars: serialized },
      };
    }
  );

  // 4. Tool: get_inspection_hubs
  server.registerTool(
    "get_inspection_hubs",
    {
      description:
        "Get active AutoBazaar 200-point physical inspection centers/hubs across Pakistan, including addresses, operating hours, phone numbers, and inspection grading thresholds.",
      inputSchema: {
        city: z.string().optional().describe("Optional city name to filter hubs (e.g. 'Lahore', 'Karachi')"),
      },
    },
    async ({ city }) => {
      const hubFilter = { isActive: true };
      if (city && city.trim()) {
        hubFilter.city = { $regex: city.trim(), $options: "i" };
      }

      const [hubs, standard] = await Promise.all([
        InspectionHub.find(hubFilter).sort({ sortOrder: 1, city: 1 }).lean(),
        InspectionStandard.findOne({ key: "autobazaar_inspection_standard" }).lean(),
      ]);

      const hubLines =
        hubs.length > 0
          ? hubs.map(
              (h) =>
                `- ${h.name} (${h.city}): ${h.address} | Hours: ${h.hours} | Bays: ${h.baysLabel}${h.phone ? ` | Phone: ${h.phone}` : ""}`
            )
          : ["No active inspection hubs matched that city filter."];

      const stdSummary = standard
        ? `Grading Standards: Minimum Approved Score = ${standard.minimumApprovedScore}/10, Certified Threshold = ${standard.certifiedThresholdScore}/10.`
        : "AutoBazaar uses a 200-point physical inspection checklist scored out of 10.";

      return {
        content: [
          {
            type: "text",
            text: [`AutoBazaar Inspection Hubs:`, ...hubLines, `\n${stdSummary}`].join("\n"),
          },
        ],
        structuredContent: { hubs, standard: standard ? { title: standard.title } : null },
      };
    }
  );

  // 5. Tool: get_inventory_summary
  server.registerTool(
    "get_inventory_summary",
    {
      description:
        "Get a quick live summary of all published cars in AutoBazaar (total count, min/max price, available cities, makes, transmissions) plus top listings. Use when the user asks broadly what cars are available.",
      inputSchema: {},
    },
    async () => {
      const cars = await Car.find({ status: "published" })
        .select(
          "_id title make model year price mileage fuelType transmission condition city bodyType images inspectionScore inspectionStatus"
        )
        .sort({ inspectionScore: -1, createdAt: -1 })
        .lean();

      if (cars.length === 0) {
        return {
          content: [{ type: "text", text: "There are currently 0 published cars in AutoBazaar." }],
          structuredContent: { total: 0, cars: [] },
        };
      }

      const prices = cars.map((c) => c.price).filter((p) => typeof p === "number");
      const cities = [...new Set(cars.map((c) => c.city).filter(Boolean))];
      const makes = [...new Set(cars.map((c) => c.make).filter(Boolean))];
      const transmissions = [...new Set(cars.map((c) => c.transmission).filter(Boolean))];

      const topCars = cars.slice(0, 5);
      const serialized = topCars.map(serializeCarCard);

      const summary = [
        `AutoBazaar Live Inventory Summary:`,
        `- Total Published Cars: ${cars.length}`,
        `- Price Range: ${formatPKR(Math.min(...prices))} to ${formatPKR(Math.max(...prices))}`,
        `- Cities: ${cities.join(", ") || "Pakistan"}`,
        `- Makes: ${makes.join(", ")}`,
        `- Transmissions: ${transmissions.join(", ")}`,
        `\nAvailable Listings (up to 5):`,
        ...topCars.map((c, idx) => `\nOption ${idx + 1}:\n${formatCarSummaryLine(c)}`),
      ].join("\n");

      return {
        content: [{ type: "text", text: summary }],
        structuredContent: { total: cars.length, cars: serialized },
      };
    }
  );

  // Expose live inventory as an MCP Resource for external MCP clients
  server.registerResource(
    "inventory-summary",
    "autobazaar://inventory/summary",
    {
      title: "AutoBazaar Published Inventory Summary",
      description: "Live snapshot of published vehicles available on AutoBazaar Pakistan",
      mimeType: "application/json",
    },
    async (uri) => {
      const cars = await Car.find({ status: "published" })
        .select("_id title make model year price mileage fuelType transmission city inspectionScore inspectionStatus")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(cars.map(serializeCarCard), null, 2),
          },
        ],
      };
    }
  );

  return server;
}

