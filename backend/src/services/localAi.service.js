import Car from "../models/car.model.js";

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const EMBEDDING_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const LLM_MODEL = process.env.OLLAMA_CHAT_MODEL || "autobazaar-advisor";

/**
 * Format a price number in PKR to readable text (e.g. 2,850,000 -> "PKR 28.5 Lac")
 */
export function formatPKR(val) {
  if (typeof val !== "number" || isNaN(val)) return "PKR 0";
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
 * Convert a Car document into a rich semantic text block for vector embeddings and LLM context
 */
export function formatCarToDocument(car) {
  const parts = [
    `Vehicle: ${car.year || ""} ${car.make || ""} ${car.model || ""}`.trim(),
    `Title: ${car.title || ""}`,
    `Price: ${formatPKR(car.price)} (PKR ${car.price?.toLocaleString() || 0})`,
    `Location: ${car.city || "Pakistan"}`,
    `Mileage: ${car.mileage?.toLocaleString() || 0} km`,
    `Transmission: ${car.transmission || "N/A"}`,
    `Fuel: ${car.fuelType || "N/A"}`,
    `Condition: ${car.condition || "used"}`,
  ];

  if (car.inspectionScore) {
    parts.push(
      `200-Point Inspection Score: ${car.inspectionScore}/10 (${car.inspectionStatus || "verified"})`
    );
  }

  if (car.description && car.description.trim()) {
    parts.push(`Seller Notes: ${car.description.trim().slice(0, 300)}`);
  }

  return parts.join("\n");
}

/**
 * Generate embedding vector using local Ollama nomic-embed-text
 */
export async function generateEmbedding(text) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        prompt: text.slice(0, 2048), // nomic-embed-text context limit
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`Ollama embeddings HTTP error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (Array.isArray(data?.embedding)) {
      return data.embedding;
    }
    return null;
  } catch (error) {
    console.error("Local Ollama embedding error:", error?.message || error);
    return null;
  }
}

/**
 * Compute cosine similarity between two float vectors
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Parse Pakistani market queries to extract budget, city, transmission, fuel, etc.
 * e.g. "My budget is 30 lac show me a car in Lahore" -> maxPrice: 3000000, city: "Lahore"
 */
export function parseQueryFilters(query) {
  if (!query || typeof query !== "string") return {};
  const q = query.toLowerCase();

  const filters = {};

  // 1. Budget extraction
  // Matches e.g. "30 lac", "30lac", "30 lakh", "30lacs", "1.5 crore", "2.2 cr"
  const croreMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:crore|cr)/i);
  const lacMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:lac|lakh|lacs)/i);
  const rawNumberMatch = q.match(/(?:budget|under|below|price|upto|up to)\s*(?:is|of|:)?\s*(\d{6,8})/i);

  if (croreMatch) {
    const val = parseFloat(croreMatch[1]) * 10000000;
    filters.maxPrice = val;
  } else if (lacMatch) {
    const val = parseFloat(lacMatch[1]) * 100000;
    filters.maxPrice = val;
  } else if (rawNumberMatch) {
    filters.maxPrice = parseInt(rawNumberMatch[1], 10);
  }

  // 2. City extraction
  const commonCities = [
    "lahore",
    "karachi",
    "islamabad",
    "rawalpindi",
    "faisalabad",
    "multan",
    "peshawar",
    "quetta",
    "sialkot",
    "gujranwala",
  ];
  for (const city of commonCities) {
    if (new RegExp(`\\b${city}\\b`, "i").test(q)) {
      filters.city = city.charAt(0).toUpperCase() + city.slice(1);
      break;
    }
  }

  // 3. Transmission (robust to typos like automatice, autometic, automtic, auto, etc.)
  const qWithoutBrand = q.replace(/autobazaar/gi, "");
  if (/\b(auto\w*|a\/t)\b/i.test(qWithoutBrand)) {
    filters.transmission = "automatic";
  } else if (/\b(manual\w*|manul|stick|m\/t)\b/i.test(q)) {
    filters.transmission = "manual";
  }

  // 4. Fuel type
  if (/\b(hybrid)\b/i.test(q)) {
    filters.fuelType = "hybrid";
  } else if (/\b(electric|ev)\b/i.test(q)) {
    filters.fuelType = "electric";
  } else if (/\b(diesel)\b/i.test(q)) {
    filters.fuelType = "diesel";
  } else if (/\b(petrol)\b/i.test(q)) {
    filters.fuelType = "petrol";
  }

  // 5. Body type
  if (/\b(sedan)\b/i.test(q)) filters.bodyType = "sedan";
  else if (/\b(suv)\b/i.test(q)) filters.bodyType = "suv";
  else if (/\b(hatchback)\b/i.test(q)) filters.bodyType = "hatchback";

  return filters;
}

/**
 * Perform hybrid retrieval over MongoDB published cars
 */
export async function findRelevantCars({ query, limit = 4 }) {
  const parsed = parseQueryFilters(query);

  // 1. Build initial MongoDB query
  const mongoQuery = { status: "published" };

  if (parsed.city) {
    mongoQuery.city = { $regex: new RegExp(`^${parsed.city}$`, "i") };
  }

  if (parsed.transmission) {
    mongoQuery.transmission = parsed.transmission;
  }

  if (parsed.fuelType) {
    mongoQuery.fuelType = parsed.fuelType;
  }

  if (parsed.bodyType) {
    mongoQuery.bodyType = parsed.bodyType;
  }

  // Budget margin: if maxPrice is specified, give a 10% flexible margin
  if (parsed.maxPrice) {
    mongoQuery.price = { $lte: parsed.maxPrice * 1.1 };
  }

  // Query MongoDB with embedding vector selected
  let candidates = await Car.find(mongoQuery)
    .select("+embedding")
    .populate("seller", "name phoneNumber avatar city")
    .lean();

  // If strict filtering returned zero cars (e.g. no car in that exact city with that fuel), relax city & fuel
  if (candidates.length === 0 && (parsed.city || parsed.fuelType || parsed.transmission)) {
    const relaxedQuery = { status: "published" };
    if (parsed.maxPrice) {
      relaxedQuery.price = { $lte: parsed.maxPrice * 1.15 };
    }
    candidates = await Car.find(relaxedQuery)
      .select("+embedding")
      .populate("seller", "name phoneNumber avatar city")
      .lean();
  }

  // If still 0 candidates (e.g. budget was lower than any car in DB), fetch all published cars so AI can explain closest
  if (candidates.length === 0) {
    candidates = await Car.find({ status: "published" })
      .select("+embedding")
      .populate("seller", "name phoneNumber avatar city")
      .lean();
  }

  if (candidates.length === 0) {
    return [];
  }

  // 2. Generate vector embedding for user query
  const queryEmbedding = await generateEmbedding(query);

  // 3. Score and rank candidates
  const scored = candidates.map((car) => {
    let simScore = 0.5; // baseline

    if (queryEmbedding && Array.isArray(car.embedding) && car.embedding.length > 0) {
      simScore = cosineSimilarity(queryEmbedding, car.embedding);
    } else {
      // Fallback text scoring if car embedding is missing
      const titleLower = (car.title || "").toLowerCase();
      const qLower = query.toLowerCase();
      if (titleLower.includes(qLower)) simScore += 0.3;
    }

    // Proximity bonus if user specified a budget
    let budgetScore = 1.0;
    if (parsed.maxPrice && car.price) {
      if (car.price <= parsed.maxPrice) {
        budgetScore = 1.2; // in-budget bonus
      } else {
        budgetScore = 0.8;
      }
    }

    // Certified inspection quality bonus
    const inspectionBonus = car.inspectionScore ? car.inspectionScore / 20 : 0.2;

    const finalScore = simScore * 0.6 + budgetScore * 0.3 + inspectionBonus * 0.1;

    return {
      car,
      score: finalScore,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.car);
}

/**
 * Chat with local Ollama Llama 3.2 using retrieved MongoDB car context
 */
export async function chatWithLocalRAG({ query, conversationHistory = [] }) {
  // 1. Retrieve the most relevant cars from database
  const relevantCars = await findRelevantCars({ query, limit: 4 });

  // 2. Format context for the LLM
  let inventoryContext = "";
  if (relevantCars.length > 0) {
    inventoryContext = relevantCars
      .map(
        (car, idx) =>
          `Listing Option ${idx + 1}:\n${formatCarToDocument(car)}`
      )
      .join("\n\n");
  } else {
    inventoryContext = "No published vehicles are currently available in the database.";
  }

  // 3. System prompt strictly grounding the model
  const systemPrompt = `You are AutoBazaar's Senior Automotive Advisor in Pakistan.
Your role is to advise buyers looking for used cars using ONLY the verified cars in the database inventory provided below.

VERIFIED INVENTORY CURRENTLY IN AUTOBAZAAR DATABASE:
${inventoryContext}

STRICT INSTRUCTIONS:
1. Recommend ONLY vehicles from the inventory above. NEVER invent or hallucinate cars, specs, or prices that are not in the inventory.
2. Quote prices in Pakistani Rupees (PKR) and always write them clearly in Lac or Crore (e.g., PKR 25 Lac).
3. If the user asks for a specific feature (like automatic transmission, hybrid, or specific city), focus on and recommend ONLY the vehicles that match that feature!
4. Write in a natural, polite conversational tone like an expert car advisor:
   - NEVER output internal labels like "CAR #1", "CAR #2", or "Listing Option 1".
   - NEVER dump raw debug key-value lists like "+ Vehicle:" or "+ Body Type: N/A".
   - Speak naturally (e.g., "Yes! We have a 2021 Toyota Corolla in mint condition with automatic transmission for PKR 25 Lac...").
5. If the user speaks in Roman Urdu or Urdu (e.g., 'koi car automatic available ha?'), reply naturally in friendly Roman Urdu or English matching their tone.
6. Keep your answers concise, engaging, and professional. Mention inspection score and suggest booking doorstep inspection or viewing the report.`;

  // 4. Construct messages array for Ollama /api/chat
  const messages = [
    { role: "system", content: systemPrompt },
  ];

  // Include recent conversation history if provided (up to last 4 turns)
  if (Array.isArray(conversationHistory)) {
    const recent = conversationHistory.slice(-4);
    for (const msg of recent) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({ role: msg.role, content: String(msg.content || "") });
      }
    }
  }

  messages.push({ role: "user", content: query });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        stream: false,
        options: {
          temperature: 0.3, // Low temperature for high accuracy & zero hallucinations
          top_p: 0.9,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Ollama chat returned status ${res.status}`);
    }

    const data = await res.json();
    const answer = data?.message?.content || "I found matching vehicles for you in our database. See below:";

    // Filter returned car cards so manual cars are not returned when automatic was explicitly requested
    const parsed = parseQueryFilters(query);
    let matchedCars = relevantCars;
    if (parsed.transmission) {
      const matchTrans = relevantCars.filter(
        (c) => c.transmission?.toLowerCase() === parsed.transmission.toLowerCase()
      );
      if (matchTrans.length > 0) {
        matchedCars = matchTrans;
      }
    }

    // Sanitize car objects returned to frontend
    const sanitizedCars = matchedCars.map((c) => ({
      _id: c._id,
      title: c.title,
      make: c.make,
      model: c.model,
      year: c.year,
      price: c.price,
      city: c.city,
      mileage: c.mileage,
      transmission: c.transmission,
      fuelType: c.fuelType,
      images: c.images,
      inspectionScore: c.inspectionScore,
      inspectionStatus: c.inspectionStatus,
      condition: c.condition,
    }));

    return {
      success: true,
      answer,
      cars: sanitizedCars,
      count: sanitizedCars.length,
      model: LLM_MODEL,
    };
  } catch (error) {
    console.error("Local Ollama chat error:", error?.message || error);
    // Fallback: If Ollama chat is unavailable, return a clean algorithmic answer with the matched cars!
    return {
      success: true,
      answer: `Here are the verified vehicles currently available on AutoBazaar matching your request:`,
      cars: relevantCars.map((c) => ({
        _id: c._id,
        title: c.title,
        make: c.make,
        model: c.model,
        year: c.year,
        price: c.price,
        city: c.city,
        mileage: c.mileage,
        transmission: c.transmission,
        fuelType: c.fuelType,
        images: c.images,
        inspectionScore: c.inspectionScore,
        inspectionStatus: c.inspectionStatus,
        condition: c.condition,
      })),
      count: relevantCars.length,
      fallback: true,
    };
  }
}

/**
 * Generate and save vector embedding for a single car in MongoDB
 */
export async function syncCarEmbedding(carId) {
  try {
    const car = await Car.findById(carId);
    if (!car) return false;

    const docText = formatCarToDocument(car);
    const embedding = await generateEmbedding(docText);

    if (Array.isArray(embedding) && embedding.length > 0) {
      await Car.findByIdAndUpdate(carId, { embedding });
      return true;
    }
    return false;
  } catch (err) {
    console.error(`Failed to sync embedding for car ${carId}:`, err);
    return false;
  }
}

/**
 * Backfill embeddings for all published cars in MongoDB that don't have them
 */
export async function syncAllCarEmbeddings() {
  try {
    const cars = await Car.find({ status: "published" });
    let synced = 0;
    for (const car of cars) {
      const ok = await syncCarEmbedding(car._id);
      if (ok) synced++;
    }
    return { total: cars.length, synced };
  } catch (err) {
    console.error("Failed to sync all car embeddings:", err);
    return { total: 0, synced: 0, error: err.message };
  }
}
