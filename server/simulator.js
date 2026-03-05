function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const EVENT_TYPES = ["speeding", "harsh_braking", "drowsiness"];

const DRIVERS = [
  { id: 1, name: "Alice Johnson", vehicle: "KA-01-AB-1234" },
  { id: 2, name: "Bob Singh", vehicle: "KA-02-CD-5678" },
  { id: 3, name: "Carlos Diaz", vehicle: "KA-03-EF-9012" },
];

function createEventSimulator(io, state) {
  function pushStats() {
    io.emit("stats_update", {
      totalTrips: state.totalTrips,
      liveDrivers: state.liveDrivers,
      violationCount: state.violationCount,
      riskScore: state.riskScore,
    });
  }

  function simulateEvent() {
    const driver = DRIVERS[randomInt(0, DRIVERS.length - 1)];
    const eventType = EVENT_TYPES[randomInt(0, EVENT_TYPES.length - 1)];
    const speed = randomInt(50, 110);
    const isSpeedViolation = speed > 80;

    const timestamp = new Date().toISOString();
    const event = {
      id: Date.now(),
      driverId: driver.id,
      driverName: driver.name,
      vehicle: driver.vehicle,
      type: eventType,
      speed,
      occurredAt: timestamp,
      isViolation: eventType !== "harsh_braking" || isSpeedViolation,
    };

    // Update in-memory state.
    state.lastEvents.unshift(event);
    if (state.lastEvents.length > 20) {
      state.lastEvents.pop();
    }

    // Track active drivers in the last 20 seconds.
    state.activeDrivers.set(driver.id, Date.now());
    const cutoff = Date.now() - 20_000;
    for (const [id, lastTs] of state.activeDrivers.entries()) {
      if (lastTs < cutoff) {
        state.activeDrivers.delete(id);
      }
    }
    state.liveDrivers = state.activeDrivers.size;

    if (event.isViolation) {
      state.violationCount += 1;
      const current = state.driverViolations.get(driver.id) || 0;
      const next = current + 1;
      state.driverViolations.set(driver.id, next);

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
    pushStats();
  }

  const minIntervalMs = 2000;
  const maxIntervalMs = 3000;

  function scheduleNext() {
    const delay = randomInt(minIntervalMs, maxIntervalMs);
    setTimeout(() => {
      simulateEvent();
      scheduleNext();
    }, delay);
  }

  scheduleNext();
}

module.exports = {
  createEventSimulator,
};

