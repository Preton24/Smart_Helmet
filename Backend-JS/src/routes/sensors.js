// src/routes/sensors.js

const express = require('express');
const { SensorData, SensorReading } = require('../models');
const { loadSensorData, saveSensorData } = require('../utils');

const router = express.Router();

const MAX_HISTORY = 100;

/**
 * POST /sensors/upload
 * Receive sensor data from ESP32 and store it
 */
router.post('/upload', async (req, res) => {
  try {
    const sensorDataInput = req.body;
    
    // Validate required fields
    if (!sensorDataInput || typeof sensorDataInput !== 'object') {
      return res.status(400).json({
        error: 'Invalid sensor data format'
      });
    }
    
    // Create sensor data and reading
    const sensorData = new SensorData(sensorDataInput);
    const reading = new SensorReading(sensorData);
    
    // Load current sensor data
    let allData = await loadSensorData();
    
    // Update latest reading
    allData.latest = reading;
    
    // Initialize history if needed
    if (!allData.history) {
      allData.history = [];
    }
    
    // Add to history
    allData.history.push(reading);
    
    // Keep only last 100 readings to avoid file bloat
    if (allData.history.length > MAX_HISTORY) {
      allData.history = allData.history.slice(-MAX_HISTORY);
    }
    
    // Save updated data
    await saveSensorData(allData);
    
    res.json({
      message: 'Sensor data received and stored successfully',
      timestamp: reading.timestamp,
      data: sensorData
    });
  } catch (error) {
    console.error('Error uploading sensor data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /sensors/latest
 * Get the latest sensor reading
 */
router.get('/latest', async (req, res) => {
  try {
    const allData = await loadSensorData();
    
    if (!allData.latest) {
      return res.json({
        message: 'No sensor data available yet',
        latest: null
      });
    }
    
    res.json({
      latest: allData.latest
    });
  } catch (error) {
    console.error('Error fetching latest sensor data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /sensors/history
 * Get sensor data history
 */
router.get('/history', async (req, res) => {
  try {
    const allData = await loadSensorData();
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    
    let history = allData.history || [];
    
    // Get the last 'limit' readings
    if (history.length > limit) {
      history = history.slice(-limit);
    }
    
    res.json({
      count: history.length,
      history
    });
  } catch (error) {
    console.error('Error fetching sensor history:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /sensors/stats
 * Get sensor statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const allData = await loadSensorData();
    const history = allData.history || [];
    
    if (history.length === 0) {
      return res.json({
        message: 'No sensor data available yet',
        stats: null
      });
    }
    
    // Calculate average values from history
    const accelValues = history
      .filter(r => r.data.accel && r.data.accel.length > 0)
      .map(r => r.data.accel);
    
    const gyroValues = history
      .filter(r => r.data.gyro && r.data.gyro.length > 0)
      .map(r => r.data.gyro);
    
    const stats = {
      totalReadings: history.length,
      sosCount: history.filter(r => r.data.sos).length,
      gpsFixCount: history.filter(r => r.data.gps_fix).length,
      avgMQ3: (history.reduce((sum, r) => sum + (r.data.mq3_v || 0), 0) / history.length).toFixed(3),
      avgTurbidity: Math.round(history.reduce((sum, r) => sum + (r.data.turb_raw || 0), 0) / history.length),
      avgUltrasonic: Math.round(history.reduce((sum, r) => sum + (r.data.ultrasonic_cm || 0), 0) / history.length),
      buttonPressCount: history.filter(r => r.data.button).length
    };
    
    res.json({ stats });
  } catch (error) {
    console.error('Error fetching sensor stats:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
