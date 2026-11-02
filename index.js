import express from "express";
import { MongoClient } from "mongodb";
import "dotenv/config";
import cors from "cors";

const app = express();

/* Middleware                                                          */

// Only the Next.js dev origin needs to talk to this server.
app.use(
  cors({
    origin: [process.env.CLIENT_URL],
  }),
);

// Cover image + up to 6 gallery photos travel as base64 data URLs,
// so the JSON body can be large.
app.use(express.json({ limit: "30mb" }));

const PORT = 5000;

/* MongoDB                                                             */

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is missing from .env file");
}

const client = new MongoClient(process.env.MONGODB_URI);

// Database and collection used by the client.
const db = client.db("studio-space-a8");
const studiosCollection = db.collection("studios");

export async function connectToMongoDB() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    // Handle connection errors
    console.error("MongoDB connection failed:", err);
    throw err;
  }
}

/* Helpers    */

function serializeStudio(body) {
  // The wizard sends every numeric field as a string — coerce before insert.
  // Blank lat/lng stay out of the document instead of landing as empty strings.
  const { latitude, longitude, ...rest } = body;

  return {
    ...rest,
    hourlyRate: Number(rest.hourlyRate) || 0,
    securityDeposit: Number(rest.securityDeposit) || 0,
    maxCapacity: Number(rest.maxCapacity) || 0,
    ...(latitude?.trim() && { latitude: Number(latitude) }),
    ...(longitude?.trim() && { longitude: Number(longitude) }),
  };
}

//Data is not posting in to the database properly, so this function is used to normalize the data before sending it to the client. [This is from AI]

function normalizeStudio(studio) {
  const location = studio.location ?? {};
  const pricing = studio.pricing ?? {};
  const capacity = studio.capacity ?? {};
  const media = studio.media ?? {};
  const ratings = studio.ratings_and_reviews ?? {};
  const hourlyRate = studio.hourlyRate ?? pricing.hourly_rate ?? studio.price ?? 0;
  const maxCapacity = studio.maxCapacity ?? capacity.max_capacity ?? studio.capacity ?? 0;
  const createdAt = studio.createdAt ?? studio.created_at ?? studio._id?.getTimestamp?.() ?? new Date(0);

  return {
    _id: studio._id,
    id: studio.id ?? studio.slug ?? String(studio._id),
    name: studio.name ?? studio.title ?? "",
    category: studio.category ?? "",
    shortDescription: studio.shortDescription ?? studio.short_description ?? "",
    fullDescription: studio.fullDescription ?? studio.description ?? "",
    country: studio.country ?? location.country ?? "",
    city: studio.city ?? location.city ?? "",
    streetAddress: studio.streetAddress ?? location.address ?? "",
    latitude: studio.latitude ?? location.latitude,
    longitude: studio.longitude ?? location.longitude,
    hourlyRate: Number(hourlyRate) || 0,
    price: Number(hourlyRate) || 0,
    securityDeposit: Number(studio.securityDeposit ?? pricing.security_deposit) || 0,
    maxCapacity: Number(maxCapacity) || 0,
    capacity: Number(maxCapacity) || 0,
    rules: studio.rules ?? "",
    cancellationPolicy: studio.cancellationPolicy ?? studio.cancellation_policy ?? "",
    amenities: Array.isArray(studio.amenities) ? studio.amenities : [],
    equipment: Array.isArray(studio.equipment) ? studio.equipment : [],
    coverImage: studio.coverImage ?? media.cover_image ?? null,
    gallery: Array.isArray(studio.gallery)
      ? studio.gallery
      : Array.isArray(media.gallery)
        ? media.gallery
        : [],
    rating: Number(studio.rating ?? ratings.average_rating) || 0,
    reviews: Number(studio.reviews ?? ratings.review_count) || 0,
    status: studio.status ?? (studio.is_verified ? "Verified" : "Pending"),
    createdAt,
    updatedAt: studio.updatedAt ?? studio.updated_at ?? createdAt,
  };
}

/* Routes                                                              */

app.get("/", (req, res) => {
  res.send({ message: "Studio Space Server is running." });
});

// Health check used by the client to show a friendly offline message.
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/**
 * Publish a studio listing from the /add-studio wizard.
 * Body: form fields + amenities + equipment + coverImage + gallery (data URLs).
 */
app.post("/add-studio", async (req, res) => {
  try {
    const body = req.body;

    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "Request body is required" });
    }

    if (!body.name?.trim()) {
      return res.status(400).json({ error: "Studio name is required" });
    }

    const studio = {
      ...serializeStudio(body),
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await studiosCollection.insertOne(studio);

    res.status(201).json({
      message: "Studio added successfully",
      insertedId: result.insertedId,
      studio: { ...studio, _id: result.insertedId },
    });
  } catch (err) {
    console.error("Error adding studio:", err);
    res.status(500).json({ error: "Failed to add studio" });
  }
});

/**
 * List published studios (for the dashboard / future marketplace integration).
 */
app.get("/studios", async (req, res) => {
  try {
    const studios = await studiosCollection
      .find({ status: { $in: ["published", "Published", "Verified", "verified"] } })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(studios.map(normalizeStudio));
  } catch (err) {
    console.error("Error fetching studios:", err);
    res.status(500).json({ error: "Failed to fetch studios" });
  }
});

/**
 * Single studio by Mongo id.
 */
app.get("/studios/:id", async (req, res) => {
  try {
    const { ObjectId } = await import("mongodb");
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid studio id" });
    }

    const studio = await studiosCollection.findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!studio) {
      return res.status(404).json({ error: "Studio not found" });
    }

    res.json(normalizeStudio(studio));
  } catch (err) {
    console.error("Error fetching studio:", err);
    res.status(500).json({ error: "Failed to fetch studio" });
  }
});

/* 404 + error handlers                                                */

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  if (err.status === 413) {
    return res.status(413).json({
      error: "Uploaded images are too large. Choose smaller images and try again.",
    });
  }

  res.status(500).json({ error: "Internal server error" });
});

/* Start                                                               */

// Connect to MongoDB before starting server
async function startServer() {
  try {
    await connectToMongoDB();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
