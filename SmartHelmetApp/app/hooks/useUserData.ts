import { useState, useEffect } from 'react';
import { currentUser, helmetData, locationData, impactData, incidents } from '../../lib/mockData';
import { API_BASE } from '../../config/api';

export interface UserData {
  rfid: string;
  name: string;
  avatarUrl: string;
  phoneNumber?: string;
  dashboard: {
    speed: number;
    wearing: boolean;
    accident: string;
    battery: number;
    mediaTrack: string;
  };
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  impact: {
    forceScore: number;
    injuryProb: string;
    fallDirection: string;
    tiltAngle: number;
    history: Array<{ timestamp: string; force: number; time: string }>;
  };
  incidents: Array<{
    id: string;
    timestamp: string;
    location: string;
    severity: string;
    thumbnail: string;
  }>;
  settings: Record<string, any>;
  timestamp: string;
}

// Fallback mock data when backend is unavailable
const getMockUserData = (): UserData => ({
  rfid: currentUser.rfid,
  name: currentUser.name,
  avatarUrl: currentUser.avatarUrl,
  phoneNumber: currentUser.phoneNumber || '',
  dashboard: {
    speed: helmetData.speed,
    wearing: helmetData.wearing,
    accident: helmetData.accident,
    battery: helmetData.battery,
    mediaTrack: helmetData.mediaTrack,
  },
  location: {
    latitude: locationData.latitude,
    longitude: locationData.longitude,
    address: "Current Location",
  },
  impact: {
    forceScore: impactData.forceScore,
    injuryProb: impactData.injuryProb,
    fallDirection: "None",
    tiltAngle: 0,
    history: [],
  },
  incidents: incidents.map(inc => ({
    id: inc.id.toString(),
    timestamp: inc.timestamp,
    location: inc.location,
    severity: inc.severity,
    thumbnail: inc.thumbnail,
  })),
  settings: {},
  timestamp: new Date().toISOString(),
});

export default function useUserData(userId: string = 'test_user') {
  // Use mock data locally directly, no slow backend calls
  const [userData, setUserData] = useState<UserData | null>(getMockUserData());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Empty mock methods left behind to prevent Dashboard UI crashing
  const fetchUserData = async () => {
    setUserData(getMockUserData());
  };

  const updateUserData = async (updates: Partial<UserData>) => {
    // We optionally can locally merge changes but it's not required 
    // since data is static: return updated mock if desired
    console.log('[Mock] User data update simulated:', updates);
    return userData;
  };

  return { userData, loading, error, fetchUserData, updateUserData };
}
