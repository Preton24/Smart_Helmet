const express = require('express');
const os = require('os');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const app = express();
const PORT = 3000;

// ============================================
// Get Raspberry Pi Local IP
// ============================================
function getLocalIP() {

  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {

    for (const iface of interfaces[name]) {

      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }

  return 'localhost';
}

const PI_IP = getLocalIP();

// ============================================
// Latest Data Object
// ============================================
let latestData = {

  latitude: null,
  longitude: null,
  altitude: null,

  speed: null,

  accelX: null,
  accelY: null,
  accelZ: null,

  aqi: null,

  fall: false,

  lastUpdated: null
};

// ============================================
// SHOW AVAILABLE SERIAL PORTS
// ============================================
async function listPorts() {

  try {

    const ports = await SerialPort.list();

    console.log("\n=================================");
    console.log(" AVAILABLE SERIAL PORTS ");
    console.log("=================================");

    ports.forEach((p) => {
      console.log(`Path: ${p.path}`);
    });

    console.log("=================================\n");

  } catch (err) {

    console.error("❌ Failed to list ports:", err);
  }
}

// ============================================
// START SERIAL CONNECTION
// ============================================
async function startSerial() {

  await listPorts();

  console.log("🔌 Opening serial port /dev/serial0 ...");

  const port = new SerialPort({

    path: '/dev/serial0',
    baudRate: 115200,

    autoOpen: false
  });

  // ============================================
  // OPEN PORT
  // ============================================
  port.open((err) => {

    if (err) {

      console.error("❌ Failed to open serial port:");
      console.error(err.message);

      console.log("\nTry:");
      console.log("sudo raspi-config");
      console.log("Interface Options → Serial Port");
      console.log("Disable login shell");
      console.log("Enable serial hardware");
      console.log("");

      return;
    }

    console.log("✅ Serial port opened successfully");
  });

  // ============================================
  // SERIAL ERRORS
  // ============================================
  port.on('error', (err) => {

    console.error("❌ Serial Error:");
    console.error(err.message);
  });

  // ============================================
  // SERIAL CLOSED
  // ============================================
  port.on('close', () => {

    console.log("⚠️ Serial port closed");
  });

  // ============================================
  // PARSER
  // ============================================
  const parser = port.pipe(

    new ReadlineParser({
      delimiter: '\n'
    })
  );

  // ============================================
  // RECEIVE DATA
  // ============================================
  parser.on('data', (line) => {

    line = line.trim();

    if (!line) return;

    console.log("\n📡 RAW DATA:");
    console.log(line);

    try {

      const data = JSON.parse(line);

      latestData = {

        latitude: data.lat ?? null,
        longitude: data.lon ?? null,
        altitude: data.alt ?? null,

        speed: data.speed ?? null,

        accelX: data.acc?.x ?? null,
        accelY: data.acc?.y ?? null,
        accelZ: data.acc?.z ?? null,

        aqi: data.aqi?.value ?? null,

        fall: data.fall ?? false,

        lastUpdated: new Date().toISOString()
      };

      console.log("✅ JSON Parsed Successfully");

      console.log(
        `✅ lat=${latestData.latitude} ` +
        `lon=${latestData.longitude} ` +
        `alt=${latestData.altitude} ` +
        `speed=${latestData.speed} ` +
        `accX=${latestData.accelX} ` +
        `accY=${latestData.accelY} ` +
        `accZ=${latestData.accelZ} ` +
        `aqi=${latestData.aqi} ` +
        `fall=${latestData.fall}`
      );

    } catch (err) {

      console.error("❌ JSON Parse Error:");
      console.error(err.message);

      console.log("Bad JSON was:");
      console.log(line);
    }
  });
}

startSerial();

// ============================================
// API ROUTES
// ============================================

// Full data
app.get('/data', (req, res) => {

  res.json(latestData);
});

// Speed
app.get('/speed', (req, res) => {

  res.send(String(latestData.speed ?? 'NA'));
});

// AQI
app.get('/aqi', (req, res) => {

  res.send(String(latestData.aqi ?? 'NA'));
});

// Altitude
app.get('/altitude', (req, res) => {

  res.send(String(latestData.altitude ?? 'NA'));
});

// Latitude
app.get('/latitude', (req, res) => {

  res.send(String(latestData.latitude ?? 'NA'));
});

// Longitude
app.get('/longitude', (req, res) => {

  res.send(String(latestData.longitude ?? 'NA'));
});

// Fall
app.get('/fall', (req, res) => {

  res.send(String(latestData.fall));
});

// Acceleration
app.get('/acceleration', (req, res) => {

  res.json({

    x: latestData.accelX,
    y: latestData.accelY,
    z: latestData.accelZ
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {

  console.log("\n=================================");
  console.log(" SMART HELMET API SERVER ");
  console.log("=================================");

  console.log(`🚀 Server running at:`);
  console.log(`http://${PI_IP}:${PORT}`);

  console.log("\nEndpoints:");

  console.log("/data");
  console.log("/speed");
  console.log("/aqi");
  console.log("/altitude");
  console.log("/latitude");
  console.log("/longitude");
  console.log("/fall");
  console.log("/acceleration");

  console.log("=================================\n");
});