// src/models/Sensor.js

/**
 * Sensor Data Model
 * Represents sensor readings from ESP32
 */
class SensorData {
  constructor(data = {}) {
    this.sos = data.sos || false;
    this.rfid = data.rfid || "";
    this.accel = data.accel || [];
    this.gyro = data.gyro || [];
    this.gps_fix = data.gps_fix || false;
    this.gps = data.gps || "";
    this.mq3_v = data.mq3_v || 0.0;
    this.turb_raw = data.turb_raw || 0;
    this.ultrasonic_cm = data.ultrasonic_cm || -1;
    this.button = data.button || false;
  }
}

class SensorReading {
  constructor(sensorData) {
    this.timestamp = new Date().toISOString();
    this.data = sensorData instanceof SensorData ? sensorData : new SensorData(sensorData);
  }
}

module.exports = {
  SensorData,
  SensorReading
};
