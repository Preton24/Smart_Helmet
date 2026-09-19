// src/utils/sensorStorage.js

const fs = require('fs').promises;
const path = require('path');

const SENSOR_DATA_FILE = path.join(__dirname, '..', '..', 'sensor_data.json');

/**
 * Ensure sensor data file exists
 */
async function ensureSensorFile() {
  try {
    try {
      await fs.access(SENSOR_DATA_FILE);
    } catch {
      const initialData = {
        latest: null,
        history: []
      };
      await fs.writeFile(SENSOR_DATA_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
    }
  } catch (error) {
    console.error('Failed to ensure sensor file:', error);
    throw error;
  }
}

/**
 * Load sensor data from JSON file
 */
async function loadSensorData() {
  try {
    await ensureSensorFile();
    const fileContent = await fs.readFile(SENSOR_DATA_FILE, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Failed to load sensor data:', error);
    throw new Error(`Failed to load sensor data: ${error.message}`);
  }
}

/**
 * Save sensor data to JSON file
 */
async function saveSensorData(data) {
  try {
    await ensureSensorFile();
    await fs.writeFile(SENSOR_DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save sensor data:', error);
    throw new Error(`Failed to save sensor data: ${error.message}`);
  }
}

module.exports = {
  loadSensorData,
  saveSensorData,
  ensureSensorFile
};
