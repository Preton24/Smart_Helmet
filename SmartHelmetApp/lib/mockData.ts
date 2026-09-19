export const currentUser = {
    name: "Kumar",
    rfid: "RFID12345",
    status: "active", // green dot
    avatarUrl: "https://github.com/shadcn.png", // dummy
    phoneNumber: "+91 78993 96101"
};

export const helmetData = {
    speed: 42,
    wearing: true,
    alcohol: false,
    accident: "normal", // normal | fall | impact
    battery: 87,
    mediaTrack: "Night Drive - Chill Mix",
    isEmergencyPressed: false,
};

export const locationData = {
    latitude: 12.8865647,
    longitude: 77.4472367,
    timestamp: new Date().toISOString(),
    speed: 42,
    direction: "NW",
};

export const familyMembers = [
    {
        id: 1, name: "Mom", location: {
            lat: 12.9362778,
            lng: 77.5182222
        }, 
        status: "Not Driving",
        rfid: "RFID98765",
        mobileNumber: "+91 98860 12345"
    },
    {
        id: 2, name: "Dad", location: {
            lat: 13.0115833,
            lng: 77.5544722
        }, 
        status: "Not Driving",
        rfid: "RFID54321",
        mobileNumber: "+91 94480 54321"
    },
];

export interface TrafficIncident {
    id: string;
    type: 'No Helmet' | 'One Way' | 'Triple Riding' | 'Signal Jump' | 'Speeding' | 'Helmet Violation';
    location: string;
    timestamp: string;
    severity: 'High' | 'Low' | 'Medium';
    numberPlate: string;
    thumbnail: string;
    videoPath: string; // reference to bundled video or URL
    // API response fields
    videoId?: string;
    annotatedVideoUrl?: string;
    bestFrameUrl?: string;
    helmetViolationsCount?: number;
    vehicleThreatsCount?: number;
    processingTime?: number;
    isProcessing?: boolean;
}

export const incidents: TrafficIncident[] = [
    {
        id: 'tra-1',
        type: 'No Helmet',
        timestamp: "2026-01-24T14:30:00Z",
        severity: "High",
        location: "Main St & 4th Ave",
        numberPlate: "KA 01 EB 1234",
        thumbnail: "https://media.istockphoto.com/id/526110307/photo/motorcycle-accident.jpg?s=612x612&w=0&k=20&c=bDS8Vs6e4zbngG8ck-tJXgW5b5ZMfjXPFQl-H1E9dcI=",
        videoPath: 'video1'
    },
    {
        id: 'tra-2',
        type: 'One Way',
        timestamp: "2026-01-28T09:15:00Z",
        severity: "Low",
        location: "Park Rd, Near Metro",
        numberPlate: "KA 05 MN 5678",
        thumbnail: "https://images.unsplash.com/photo-1592126296549-0e3edb40aca1?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NDB8fHRyYWZmaWMlMjB2aW9sYXRpb258ZW58MHx8MHx8fDA%3D",
        videoPath: 'video2'
    },
];

export interface WasteIncident {
    id: string;
    type: 'Littering' | 'Illegal Dumping' | 'Overflowing Bin' | 'Hazardous Waste' | 'Garbage Detected' | 'Clean Area';
    location: string;
    timestamp: string;
    severity: 'High' | 'Low' | 'Medium';
    thumbnail: string;
    // API response fields
    garbageDetected?: boolean;
    confidence?: number;
    annotatedImageUrl?: string;
    isProcessing?: boolean;
}

export const wasteIncidents: WasteIncident[] = [
    {
        id: 'waste-1',
        type: 'Illegal Dumping',
        location: 'Central Plaza',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        severity: 'High',
        thumbnail: 'https://images.unsplash.com/photo-1589627762073-9aca94506fa1?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    }
];

export const impactData = {
    forceScore: 8.5, // out of 10
    injuryProb: "Low",
    fallDirection: "Left",
    tiltAngle: 45,
    history: [
        { time: "10:00", force: 2 },
        { time: "10:05", force: 3 },
        { time: "10:10", force: 8.5 }, // impact
        { time: "10:15", force: 0 },
    ]
};

export interface PotholeIncident {
    id: string;
    location: string;
    timestamp: string;
    riskLevel: 'High' | 'Low' | 'Medium';
    thumbnail: string;
    videoPath: string;
}

export const potholeIncidents: PotholeIncident[] = [
    {
        id: 'pot-1',
        location: 'MG Road, Near Trinity Circle',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        riskLevel: 'High',
        thumbnail: 'pothole1',
        videoPath: 'video4_pothole'
    },
    {
        id: 'pot-2',
        location: 'Indiranagar 100ft Road',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        riskLevel: 'Medium',
        thumbnail: 'pothole1',
        videoPath: 'video4_pothole'
    }
];
