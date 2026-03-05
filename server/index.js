const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const { Server } = require("socket.io");
require("dotenv").config();

const { initDb, getPool } = require("./mysql");
const { createEventSimulator } = require("./simulator");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// Serve static frontend
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Simple in-memory aggregates used for realtime metrics.
const state = {
  totalTrips: 10,
  liveDrivers: 0,
  violationCount: 0,
  riskScore: 50,
  lastEvents: [],
  activeDrivers: new Map(), // driverId -> lastEventTimestamp
  driverViolations: new Map(), // driverId -> count
};

app.get("/api/stats", (req, res) => {
  res.json({
    totalTrips: state.totalTrips,
    liveDrivers: state.liveDrivers,
    violationCount: state.violationCount,
    riskScore: state.riskScore,
  });
});

app.get("/api/events/recent", (req, res) => {
  res.json(state.lastEvents);
});

// REST API to ingest driver events manually (in addition to the simulator).
app.post("/api/events", async (req, res) => {
  try {
    const { driverId, driverName, vehicle, type, speed } = req.body || {};

    if (!driverId || !driverName || !vehicle || !type || typeof speed !== "number") {
      return res.status(400).json({ message: "driverId, driverName, vehicle, type, and numeric speed are required." });
    }

    const isSpeedViolation = speed > 80;
    const timestamp = new Date().toISOString();
    const event = {
      id: Date.now(),
      driverId,
      driverName,
      vehicle,
      type,
      speed,
      occurredAt: timestamp,
      isViolation: type !== "harsh_braking" || isSpeedViolation,
    };

    // Persist to MySQL if configured.
    try {
      const pool = getPool();
      await pool.query(
        "INSERT INTO events (driver_id, driver_name, vehicle, type, speed, occurred_at, is_violation) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          driverId,
          driverName,
          vehicle,
          type,
          speed,
          timestamp,
          event.isViolation ? 1 : 0,
        ]
      );
    } catch (dbErr) {
      // eslint-disable-next-line no-console
      console.warn("MySQL insert skipped or failed:", dbErr.message);
    }

    // Mirror the simulator logic to update aggregates.
    state.lastEvents.unshift(event);
    if (state.lastEvents.length > 20) {
      state.lastEvents.pop();
    }

    state.activeDrivers.set(driverId, Date.now());
    const cutoff = Date.now() - 20_000;
    for (const [id, lastTs] of state.activeDrivers.entries()) {
      if (lastTs < cutoff) {
        state.activeDrivers.delete(id);
      }
    }
    state.liveDrivers = state.activeDrivers.size;

    if (event.isViolation) {
      state.violationCount += 1;
      const current = state.driverViolations.get(driverId) || 0;
      const next = current + 1;
      state.driverViolations.set(driverId, next);

      // Base risk bump.
      state.riskScore = Math.min(100, state.riskScore + 1.5);

      // Example rule from assignment: if 3 violations occur in one "trip", increase risk more aggressively.
      if (next >= 3 && next % 3 === 0) {
        state.riskScore = Math.min(100, state.riskScore + 5);
      }
    } else {
      state.riskScore = Math.max(10, state.riskScore - 0.5);
    }

    io.emit("event", event);
    io.emit("stats_update", {
      totalTrips: state.totalTrips,
      liveDrivers: state.liveDrivers,
      violationCount: state.violationCount,
      riskScore: state.riskScore,
    });

    return res.status(201).json(event);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error handling /api/events:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

io.on("connection", (socket) => {
  socket.emit("stats_update", {
    totalTrips: state.totalTrips,
    liveDrivers: state.liveDrivers,
    violationCount: state.violationCount,
    riskScore: state.riskScore,
  });
  socket.emit("events_snapshot", state.lastEvents);
});

const PORT = process.env.PORT || 4000;

async function start() {
  // Initialize DB connection (optional for running demo, but required by assignment).
  try {
    await initDb();
    // eslint-disable-next-line no-console
    console.log("MySQL connection initialized (or skipped with warning).");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error initializing MySQL:", err.message);
  }

  // Start simulator that will push events + stats to all clients.
  createEventSimulator(io, state);

  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

start();

