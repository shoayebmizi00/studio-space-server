import express from "express";
import { MongoClient } from "mongodb";
import "dotenv/config";
import cors from "cors";

const app = express();

/* Middleware                                                          */

// Only the Next.js dev origin needs to talk to this server.
app.use(
  cors({
    origin: ["http://localhost:3000"],
  }),
);

// Cover image + up to 6 gallery photos travel as base64 data URLs,
// so the JSON body can be large.
app.use(express.json({ limit: "30mb" }));

const PORT = process.env.PORT || 5000;

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

/* Routes                                                              */

app.get("/", (req, res) => {
  res.send("This is from Server");
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
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    res.json(studios);
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

    res.json(studio);
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
