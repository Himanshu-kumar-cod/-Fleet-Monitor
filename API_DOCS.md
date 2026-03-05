# API Documentation - okDriver Fleet Monitoring Prototype

This document describes the REST APIs and WebSocket events exposed by the prototype.

> Base URL: `http://localhost:4000`

## Health

### `GET /api/health`

Returns basic service health information.

**Response 200**

```json
{
  "status": "ok",
  "timestamp": "2026-03-05T10:00:00.000Z"
}
```

## Fleet Metrics

### `GET /api/stats`

Returns the current high-level metrics that power the dashboard.

**Response 200**

```json
{
  "totalTrips": 10,
  "liveDrivers": 2,
  "violationCount": 34,
  "riskScore": 72.5
}
```

Fields:

- `totalTrips` – simulated number of active/known trips.
- `liveDrivers` – number of drivers that generated an event in the last 20 seconds.
- `violationCount` – cumulative number of *violation* events.
- `riskScore` – overall fleet risk score (10–100, higher is riskier).

### `GET /api/events/recent`

Returns a list of the most recent events kept in memory (up to 20).

**Response 200**

```json
[
  {
    "id": 1709639060000,
    "driverId": 1,
    "driverName": "Alice Johnson",
    "vehicle": "KA-01-AB-1234",
    "type": "speeding",
    "speed": 96,
    "occurredAt": "2026-03-05T10:04:20.123Z",
    "isViolation": true
  }
]
```

## Event Ingestion

### `POST /api/events`

Ingest a driver event (manual injection, in addition to the built-in simulator).

**Request body**

```json
{
  "driverId": 1,
  "driverName": "Alice Johnson",
  "vehicle": "KA-01-AB-1234",
  "type": "speeding",
  "speed": 92
}
```

Fields:

- `driverId` *(number, required)* – numeric ID of the driver.
- `driverName` *(string, required)* – human-readable driver name.
- `vehicle` *(string, required)* – registration number or identifier.
- `type` *(string, required)* – one of: `speeding`, `harsh_braking`, `drowsiness`.
- `speed` *(number, required)* – speed in km/h.

Business rules:

- A *violation* is any event of type:
  - `speeding` with `speed > 80`, or
  - `drowsiness`, or
  - `harsh_braking` (always treated as a safety-relevant event).
- Each violation:
  - Increments `violationCount`.
  - Increases `riskScore` by 1.5 points.
- When a driver accumulates **3, 6, 9, … violations**, the system:
  - Applies an extra **+5** bump to `riskScore` (captures “3 violations in a trip” example).

Side effects:

- Inserts an `events` row into MySQL when MySQL is configured via environment variables.
- Updates in-memory aggregates and broadcasts to all WebSocket clients.

**Responses**

- `201 Created` – returns the stored event payload.
- `400 Bad Request` – invalid/missing fields.
- `500 Internal Server Error` – unexpected server error.

## WebSocket Events

The dashboard uses **Socket.IO** (WebSocket transport) for real-time updates.

- WebSocket endpoint: `ws://localhost:4000` (handled by Socket.IO)
- Client connects using:

```js
const socket = io("http://localhost:4000");
```

### `stats_update`

Pushed whenever metrics change (new events generated or ingested).

**Payload**

```json
{
  "totalTrips": 10,
  "liveDrivers": 2,
  "violationCount": 34,
  "riskScore": 72.5
}
```

### `events_snapshot`

Sent once on initial connection, providing the current in-memory event window.

**Payload**

```json
[
  {
    "id": 1709639060000,
    "driverId": 1,
    "driverName": "Alice Johnson",
    "vehicle": "KA-01-AB-1234",
    "type": "speeding",
    "speed": 96,
    "occurredAt": "2026-03-05T10:04:20.123Z",
    "isViolation": true
  }
]
```

### `event`

Emitted every 2–3 seconds by the simulator, and on every successful `POST /api/events`.

**Payload**

```json
{
  "id": 1709639060000,
  "driverId": 1,
  "driverName": "Alice Johnson",
  "vehicle": "KA-01-AB-1234",
  "type": "speeding",
  "speed": 96,
  "occurredAt": "2026-03-05T10:04:20.123Z",
  "isViolation": true
}
```

