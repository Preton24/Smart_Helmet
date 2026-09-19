import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { FamilyMember } from '../context/UserContext';
import { locationData } from '../lib/mockData';

let MapContainer: any, TileLayer: any, Marker: any, Popup: any, useMap: any;
let L: any;

if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const ReactLeaflet = require('react-leaflet');
    MapContainer = ReactLeaflet.MapContainer;
    TileLayer = ReactLeaflet.TileLayer;
    Marker = ReactLeaflet.Marker;
    Popup = ReactLeaflet.Popup;
    useMap = ReactLeaflet.useMap;
    require('leaflet/dist/leaflet.css');
    L = require('leaflet');

    // Fix icons using CDN to avoid bundling issues
    const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
    const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
    const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

    let DefaultIcon = L.icon({
        iconUrl: iconUrl,
        iconRetinaUrl: iconRetinaUrl,
        shadowUrl: shadowUrl,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    L.Marker.prototype.options.icon = DefaultIcon;
}

interface LocationMapProps {
    region: {
        latitude: number;
        longitude: number;
        latitudeDelta: number;
        longitudeDelta: number;
    };
    setRegion: (region: any) => void;
    familyMembers: FamilyMember[];
}

function MapUpdater({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
}

export function LocationMap({ region, setRegion, familyMembers }: LocationMapProps) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient || !MapContainer) {
        return <View style={styles.container} />;
    }

    // Calculate zoom from delta (approximate)
    const zoom = Math.round(Math.log(360 / region.longitudeDelta) / Math.LN2);

    return (
        <View style={styles.container}>
            {/* 
              React-Leaflet MapContainer must have explicit height. 
              We use a wrapper div via React Native Web's View or styled equivalent if possible.
              But here we are inside a View, so we render the MapContainer which renders a div.
              We adjust the style to fill the parent.
            */}
            <MapContainer
                center={[region.latitude, region.longitude]}
                zoom={zoom}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Sync map center with region prop */}
                <MapUpdater center={[region.latitude, region.longitude]} />

                {/* Current User Marker */}
                <Marker position={[locationData.latitude, locationData.longitude]}>
                    <Popup>
                        You <br /> Current Location
                    </Popup>
                </Marker>

                {/* Family Members Markers */}
                {familyMembers.map((member) => (
                    <Marker
                        key={member.id}
                        position={[member.location.lat, member.location.lng]}
                    >
                        <Popup>
                            <strong>{member.name}</strong><br />
                            {member.status}<br />
                            {member.speed} km/h
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // Ensure the container takes full space on web
        height: '100%',
        width: '100%',
    },
});
