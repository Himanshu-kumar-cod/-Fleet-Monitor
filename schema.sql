CREATE TABLE IF NOT EXISTS drivers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  vehicle VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS trips (
  id INT PRIMARY KEY AUTO_INCREMENT,
  driver_id INT NOT NULL,
  started_at DATETIME NOT NULL,
  ended_at DATETIME NULL,
  FOREIGN KEY (driver_id) REFERENCES drivers(id)
);

CREATE TABLE IF NOT EXISTS events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  driver_id INT NOT NULL,
  driver_name VARCHAR(255) NOT NULL,
  vehicle VARCHAR(64) NOT NULL,
  type ENUM('speeding', 'harsh_braking', 'drowsiness') NOT NULL,
  speed INT NOT NULL,
  occurred_at DATETIME NOT NULL,
  is_violation TINYINT(1) NOT NULL DEFAULT 0,
  trip_id INT NULL,
  FOREIGN KEY (driver_id) REFERENCES drivers(id),
  FOREIGN KEY (trip_id) REFERENCES trips(id)
);

