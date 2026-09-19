// src/routes/users.js

const express = require('express');
const { loadUserData, saveUserData, listUsers } = require('../utils');

const router = express.Router();

/**
 * GET /users/:userId
 * Get user data by user ID
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await loadUserData(userId);
    res.json(user.toJSON());
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /users/:userId
 * Update user data by user ID
 */
router.post('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userData = req.body;
    
    const user = await loadUserData(userId);
    
    // Update user fields
    if (userData.name) user.name = userData.name;
    if (userData.dashboard) user.dashboard = { ...user.dashboard, ...userData.dashboard };
    if (userData.location) user.location = { ...user.location, ...userData.location };
    if (userData.impact) user.impact = { ...user.impact, ...userData.impact };
    if (userData.incidents) user.incidents = userData.incidents;
    if (userData.settings) user.settings = userData.settings;
    
    await saveUserData(userId, user);
    
    res.json({
      message: `User ${userId} updated successfully`,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /users
 * List all users
 */
router.get('', async (req, res) => {
  try {
    const users = await listUsers();
    res.json({
      users,
      count: users.length
    });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /users/:userId
 * Partially update user data
 */
router.patch('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    
    const user = await loadUserData(userId);
    
    // Apply updates
    Object.keys(updates).forEach(key => {
      if (typeof user[key] === 'object' && typeof updates[key] === 'object') {
        user[key] = { ...user[key], ...updates[key] };
      } else if (key in user) {
        user[key] = updates[key];
      }
    });
    
    await saveUserData(userId, user);
    
    res.json({
      message: `User ${userId} patched successfully`,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Error patching user:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
