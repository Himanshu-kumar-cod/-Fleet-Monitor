const tripsEl = document.getElementById("metric-trips");
const driversEl = document.getElementById("metric-drivers");
const violationsEl = document.getElementById("metric-violations");
const riskEl = document.getElementById("metric-risk");
const eventsBodyEl = document.getElementById("events-body");
const statusEl = document.getElementById("ws-status");
const alertBannerEl = document.getElementById("alert-banner");
const alertTextEl = document.getElementById("alert-text");

let eventsChart;
const eventCounters = {
  speeding: 0,
  harsh_braking: 0,
  drowsiness: 0,
};

function setStatus(text, variant) {
  statusEl.textContent = text;
  statusEl.classList.remove("status-pill--online", "status-pill--offline");
  if (variant === "online") {
    statusEl.classList.add("status-pill--online");
  } else if (variant === "offline") {
    statusEl.classList.add("status-pill--offline");
  }
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function renderEventsTable(events) {
  eventsBodyEl.innerHTML = "";
  events.forEach((ev) => {
    const tr = document.createElement("tr");
    if (ev.isViolation) {
      tr.classList.add("violation");
    }

    const tdTime = document.createElement("td");
    tdTime.textContent = formatTime(ev.occurredAt);

    const tdDriver = document.createElement("td");
    tdDriver.textContent = ev.driverName;

    const tdVehicle = document.createElement("td");
    tdVehicle.textContent = ev.vehicle;

    const tdType = document.createElement("td");
    const badge = document.createElement("span");
    badge.classList.add("badge");
    if (ev.isViolation) {
      badge.classList.add("badge--alert");
    } else {
      badge.classList.add("badge--ok");
    }
    badge.textContent =
      ev.type === "speeding"
        ? "Speeding"
        : ev.type === "harsh_braking"
        ? "Harsh braking"
        : "Drowsiness";
    tdType.appendChild(badge);

    const tdSpeed = document.createElement("td");
    tdSpeed.textContent = ev.speed.toFixed(0);

    tr.append(tdTime, tdDriver, tdVehicle, tdType, tdSpeed);
    eventsBodyEl.appendChild(tr);
  });
}

function setupChart() {
  const ctx = document.getElementById("eventsChart").getContext("2d");
  eventsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Speeding", "Harsh braking", "Drowsiness"],
      datasets: [
        {
          label: "Total events",
          data: [
            eventCounters.speeding,
            eventCounters.harsh_braking,
            eventCounters.drowsiness,
          ],
          backgroundColor: [
            "rgba(248, 113, 113, 0.7)",
            "rgba(59, 130, 246, 0.7)",
            "rgba(251, 191, 36, 0.7)",
          ],
          borderRadius: 8,
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          labels: {
            color: "#e5e7eb",
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#9ca3af",
          },
          grid: {
            display: false,
          },
        },
        y: {
          ticks: {
            color: "#9ca3af",
          },
          grid: {
            color: "rgba(55, 65, 81, 0.6)",
          },
        },
      },
    },
  });
}

function bumpChartFor(ev) {
  if (!eventsChart) return;
  if (!eventCounters[ev.type]) {
    eventCounters[ev.type] = 0;
  }
  eventCounters[ev.type] += 1;

  const data = eventsChart.data.datasets[0].data;
  data[0] = eventCounters.speeding;
  data[1] = eventCounters.harsh_braking;
  data[2] = eventCounters.drowsiness;

  eventsChart.update();
}

function showAlertIfNeeded(ev) {
  if (ev.type === "speeding" && ev.speed > 80) {
    alertBannerEl.hidden = false;
    alertTextEl.textContent = `Red alert: ${ev.driverName} is speeding at ${ev.speed.toFixed(
      0
    )} km/h on vehicle ${ev.vehicle}.`;
  } else if (ev.isViolation) {
    alertBannerEl.hidden = false;
    alertTextEl.textContent = `Risk alert: ${
      ev.driverName
    } triggered a ${ev.type.replace("_", " ")} event.`;
  } else {
    alertBannerEl.hidden = true;
  }
}

async function bootstrap() {
  setupChart();

  try {
    const statsRes = await fetch("/api/stats");
    if (statsRes.ok) {
      const stats = await statsRes.json();
      tripsEl.textContent = stats.totalTrips;
      driversEl.textContent = stats.liveDrivers;
      violationsEl.textContent = stats.violationCount;
      riskEl.textContent = stats.riskScore.toFixed(1);
    }

    const recentRes = await fetch("/api/events/recent");
    if (recentRes.ok) {
      const events = await recentRes.json();
      events.reverse().forEach((ev) => {
        if (eventCounters[ev.type] != null) {
          eventCounters[ev.type] += 1;
        }
      });
      renderEventsTable(events);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error preloading data", err);
  }

  const socket = io();

  socket.on("connect", () => {
    setStatus("Live · Connected", "online");
  });

  socket.on("disconnect", () => {
    setStatus("Offline · Reconnecting…", "offline");
  });

  socket.on("stats_update", (stats) => {
    tripsEl.textContent = stats.totalTrips;
    driversEl.textContent = stats.liveDrivers;
    violationsEl.textContent = stats.violationCount;
    riskEl.textContent = stats.riskScore.toFixed(1);
  });

  socket.on("events_snapshot", (events) => {
    renderEventsTable(events);
  });

  socket.on("event", (ev) => {
    const existing = Array.from(eventsBodyEl.querySelectorAll("tr")).map((tr) =>
      tr.querySelector("td")?.textContent
    );

    const events = [
      {
        occurredAt: ev.occurredAt,
        driverName: ev.driverName,
        vehicle: ev.vehicle,
        type: ev.type,
        speed: ev.speed,
        isViolation: ev.isViolation,
      },
      ...Array.from(eventsBodyEl.querySelectorAll("tr")).map((tr) => {
        const tds = tr.querySelectorAll("td");
        return {
          occurredAt: tds[0].dataset.ts || new Date().toISOString(),
          driverName: tds[1].textContent,
          vehicle: tds[2].textContent,
          type: tds[3].textContent.toLowerCase().includes("speed")
            ? "speeding"
            : tds[3].textContent.toLowerCase().includes("drows")
            ? "drowsiness"
            : "harsh_braking",
          speed: Number(tds[4].textContent) || 0,
          isViolation: tr.classList.contains("violation"),
        };
      }),
    ].slice(0, 20);

    renderEventsTable(events);
    bumpChartFor(ev);
    showAlertIfNeeded(ev);
  });
}

bootstrap();

