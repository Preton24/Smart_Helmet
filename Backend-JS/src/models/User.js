// src/models/User.js

/**
 * User Data Model
 * Represents a user's complete profile and related data
 */
class UserData {
  constructor(rfid = "RFID001", name = "User") {
    this.rfid = rfid;
    this.name = name;
    this.avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff&size=150`;
    this.dashboard = {
      speed: 0,
      wearing: false,
      accident: "none",
      battery: 100,
      mediaTrack: "No track playing"
    };
    this.location = {
      latitude: 12.9716,
      longitude: 77.5946,
      address: "Bangalore, India"
    };
    this.impact = {
      forceScore: 0,
      injuryProb: "0%",
      fallDirection: "None",
      tiltAngle: 0,
      history: []
    };
    this.incidents = [];
    this.settings = {};
    this.timestamp = new Date().toISOString();
  }

  updateTimestamp() {
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      rfid: this.rfid,
      name: this.name,
      avatarUrl: this.avatarUrl,
      dashboard: this.dashboard,
      location: this.location,
      impact: this.impact,
      incidents: this.incidents,
      settings: this.settings,
      timestamp: this.timestamp
    };
  }
}

module.exports = UserData;
