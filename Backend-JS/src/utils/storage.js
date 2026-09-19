// src/utils/storage.js

const fs = require('fs').promises;
const path = require('path');
const UserData = require('../models/User');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

/**
 * Ensure data directory exists
 */
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create data directory:', error);
    throw error;
  }
}

/**
 * Get the path to a user's JSON file
 */
function getUserFilePath(userId) {
  return path.join(DATA_DIR, `${userId}.json`);
}

/**
 * Load user data from JSON file
 * Creates default user data if file doesn't exist
 */
async function loadUserData(userId) {
  try {
    await ensureDataDir();
    const filePath = getUserFilePath(userId);
    
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(fileContent);
      return new UserData(data.rfid, data.name);
    } catch (error) {
      // File doesn't exist or is invalid, create default
      const newUser = new UserData(userId, `User ${userId}`);
      await saveUserData(userId, newUser);
      return newUser;
    }
  } catch (error) {
    console.error(`Failed to load user data for ${userId}:`, error);
    throw new Error(`Failed to load user data: ${error.message}`);
  }
}

/**
 * Save user data to JSON file
 */
async function saveUserData(userId, userData) {
  try {
    await ensureDataDir();
    userData.updateTimestamp();
    const filePath = getUserFilePath(userId);
    await fs.writeFile(filePath, JSON.stringify(userData.toJSON(), null, 2), 'utf-8');
  } catch (error) {
    console.error(`Failed to save user data for ${userId}:`, error);
    throw new Error(`Failed to save user data: ${error.message}`);
  }
}

/**
 * List all users (from JSON files)
 */
async function listUsers() {
  try {
    await ensureDataDir();
    const files = await fs.readdir(DATA_DIR);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => path.basename(file, '.json'));
  } catch (error) {
    console.error('Failed to list users:', error);
    throw new Error(`Failed to list users: ${error.message}`);
  }
}

module.exports = {
  loadUserData,
  saveUserData,
  listUsers,
  ensureDataDir
};
