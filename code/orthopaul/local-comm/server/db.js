// db.js
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import fs from "fs";
import path from "path";

// pwa__ SQLite DB path (Railway Volume support)
const dbBasePath = process.env.SQLITE_DIR || process.cwd();
const dbPath = path.join(dbBasePath, "data.db");


// Öffne oder erstelle die Datenbank
export const dbPromise = open({
  filename: dbPath,
  driver: sqlite3.Database,
});

export async function initDB() {
  const db = await dbPromise;

  // Tabelle step_loads sauber erstellen, falls nicht vorhanden
  await db.exec(`
    CREATE TABLE IF NOT EXISTS step_loads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      peak_value REAL NOT NULL,
      timestamp TEXT NOT NULL,
      day TEXT NOT NULL
    );
  `);

  console.log("✅ Tabelle 'step_loads' überprüft/erstellt.");

  // Schritte tabelle
  await db.exec(`
  CREATE TABLE IF NOT EXISTS steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    step INTEGER NOT NULL
  );
`);

  console.log("✅ Tabelle 'schritte' überprüft/erstellt.");

  // Schritteziel 
  await db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      user_id INTEGER PRIMARY KEY,
      step_goal INTEGER NOT NULL
    );
  `);

  console.log("✅ Tabelle 'settings' überprüft/erstellt.");


  // Limits-Tabelle wie gehabt
  await db.exec(`
    CREATE TABLE IF NOT EXISTS limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      limit_value REAL NOT NULL
    );
  `);

  console.log("✅ Tabelle 'limits' überprüft/erstellt.");


  //Limit-history
  // Historie der Belastungsgrenze
  await db.exec(`
  CREATE TABLE IF NOT EXISTS limit_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    limit_value REAL NOT NULL
  );
`);

  console.log("✅ Tabelle 'limit_history' überprüft/erstellt.");

  //Db für Feedback

  // Runs / Feedback
  await db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      step_goal INTEGER,
      steps_total INTEGER DEFAULT 0,
      peaks_count INTEGER DEFAULT 0,
      rating TEXT,
      comment TEXT
    );
  `);

  console.log("✅ Tabelle 'runs' überprüft/erstellt.");

  // pwa__ push subscriptions
  await db.exec(`
  CREATE TABLE IF NOT EXISTS pwa__push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

  console.log("✅ Tabelle 'pwa__push_subscriptions' überprüft/erstellt.");

  // pwa__ daily summary log
  await db.exec(`
  CREATE TABLE IF NOT EXISTS pwa__daily_summary_log (
    day TEXT PRIMARY KEY,
    sent_at TEXT NOT NULL
  );
`);

  console.log("✅ Tabelle 'pwa__daily_summary_log' überprüft/erstellt.");

  return db;
}





// Funktion zum Einfügen eines Step-Loads

export async function getStepLoadsSince(sinceTimestamp) {
  const db = await dbPromise;
  return db.all(
    `SELECT * FROM step_loads 
     WHERE timestamp >= ?
     ORDER BY timestamp ASC`,
    [sinceTimestamp]
  );
}

export async function insertStepLoad({ peak_value, timestamp, day }) {
  const db = await dbPromise;
  await db.run(
    "INSERT INTO step_loads (peak_value, timestamp, day) VALUES (?, ?, ?)",
    [peak_value, timestamp, day]
  );
  console.log(`💾 Peak gespeichert: ${peak_value} (${day})`);
}

// Optional: Werte abrufen (z. B. zum Testen)
export async function getAllStepLoads() {
  const db = await dbPromise;
  const rows = await db.all("SELECT * FROM step_loads ORDER BY timestamp DESC");
  return rows;
}

export async function getLimit(userId) {
  const db = await dbPromise;
  return db.get("SELECT limit_value FROM limits WHERE user_id = ?", userId);
}

// Belastungsgrenze speichern oder aktualisieren
export async function upsertLimit(userId, limitValue) {
  const db = await dbPromise;
  const existing = await db.get("SELECT 1 FROM limits WHERE user_id = ?", userId);
  if (existing) {
    await db.run("UPDATE limits SET limit_value = ? WHERE user_id = ?", limitValue, userId);
  } else {
    await db.run("INSERT INTO limits (user_id, limit_value) VALUES (?, ?)", userId, limitValue);
  }
}

//Schritteziel speichern
export async function getStepGoal(userId) {
  const db = await dbPromise;
  const row = await db.get("SELECT step_goal FROM settings WHERE user_id = ?", [userId]);
  return row?.step_goal ?? null;
}

export async function upsertStepGoal(userId, stepGoal) {
  const db = await dbPromise;
  await db.run(
    `INSERT INTO settings (user_id, step_goal)
     VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET step_goal = excluded.step_goal`,
    [userId, stepGoal]
  );
}
