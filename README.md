# okDriver Full Stack Assignment - Fleet Monitoring Prototype

This repository contains a working solution for the **okDriver Full Stack Developer assignment**.

It implements a **simulated live fleet monitoring dashboard** with:

- Node.js + Express backend
- MySQL integration (via `mysql2`) with example schema
- WebSocket-based realtime updates using Socket.IO
- A modern, responsive HTML/CSS/JS dashboard with Chart.js
- Embedded YouTube live stream to mimic a dashcam feed

## Features

- **Dummy event generator**
  - Simulated drivers generate events (`speeding`, `harsh_braking`, `drowsiness`) every **2–3 seconds**.
  - Events drive:
    - Recent events table
    - Metric cards
    - Events-by-type bar chart
    - Risk score
- **REST APIs**
  - `GET /api/health` – basic health check.
  - `GET /api/stats` – current metrics (trips, live drivers, violations, risk score).
  - `GET /api/events/recent` – last 20 events.
  - `POST /api/events` – ingest driver events manually.
- **Realtime dashboard**
  - Auto-updates without page refresh using Socket.IO.
  - Red alert banner when **speed > 80 km/h** for a speeding event.
  - Risk score increases when violations accumulate, including an extra bump every **3 violations** for a driver (captures the “3 violations in one trip” requirement).
- **Dashcam simulation**
  - Embedded YouTube live stream (configurable) in the UI.

## Project Structure

```text
fleet-dashcam/
  package.json          # Node/Express project configuration
  schema.sql            # MySQL schema (drivers, trips, events)
  ARCHITECTURE.md       # System architecture and data flow
  API_DOCS.md           # REST + WebSocket API documentation

  server/
    index.js            # Express app, Socket.IO, state, APIs
    simulator.js        # 2–3s dummy event generator
    mysql.js            # MySQL pool initialization helper

  public/
    index.html          # Dashboard layout + embedded live stream
    styles.css          # Dashboard styling
    app.js              # Frontend logic + WebSocket client
```

## Running the Project

### 1. Install dependencies

From the `fleet dashcam` directory:

```bash
npm install
```

### 2. (Optional but recommended) Configure MySQL

Create a database and apply the schema:

```sql
CREATE DATABASE okdriver_fleet;
USE okdriver_fleet;
SOURCE schema.sql;
```

Set environment variables (for example in a `.env` file next to `package.json`):

```bash
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=your_user
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=okdriver_fleet
PORT=4000
```

If these are not set, the app still runs in **demo mode** using in-memory data only (no database writes).

### 3. Start the server

```bash
npm run dev
```

Or:

```bash
npm start
```

Then open the dashboard at:

```text
http://localhost:4000
```

You should see:

- Live metrics updating every 2–3 seconds.
- A bar chart showing events per type.
- A recent events table filling up in real time.
- A red alert banner when speeding events exceed 80 km/h.
- An embedded YouTube dashcam-like stream.

## How Requirements Are Addressed

- **Backend & APIs**
  - Implemented with **Express** and documented in `API_DOCS.md`.
  - Supports health, stats, recent events, and manual event ingestion.
- **Database**
  - Uses **MySQL** (via `mysql2` pool) with schema defined in `schema.sql`.
  - `POST /api/events` writes into the `events` table when MySQL is configured.
- **Realtime sync**
  - Uses **Socket.IO** (WebSocket) to push:
    - `stats_update` messages with global metrics.
    - `event` messages for every new event (simulated or ingested).
    - `events_snapshot` on initial connection.
- **Dashboard**
  - Auto-updating UI without manual refresh, using WebSocket events.
  - Clean, modern UI with:
    - Metric cards
    - Chart.js bar chart
    - Table of recent events
    - Alert banner for violations
- **Business rules example**
  - Speed > 80 km/h triggers a **red alert card** in the UI.
  - Every 3rd violation for a driver gives an extra bump to the risk score.

## Demo Video (How to Record)

To create the submission demo:

1. Start the server (`npm run dev`).
2. Open `http://localhost:4000` in a browser.
3. Use a screen recorder (e.g., OBS, QuickTime, Loom) to capture:
   - Metrics updating live.
   - The dashboard reacting to events (table + chart).
   - The red alert banner when speeding > 80 km/h.
   - (Optional) A `curl` or Postman request to `POST /api/events` and how it affects the UI.
4. Save the recording and include it in your email to okDriver along with:
   - GitHub repository link
   - Architecture diagram (this repo’s `ARCHITECTURE.md`)
   - API documentation (`API_DOCS.md`)

