import React from 'react';
import { Platform } from 'react-native';

interface MapComponentProps {
    mapRef: any;
    mapRegion: any;
    onRegionChangeComplete: (region: any) => void;
    clusters: any[];
    zoomToCluster: (cluster: any) => void;
    getMarkerColor: (count: number) => string;
}

/**
 * Bridge component that selects the correct map implementation based on platform.
 * This file exists to satisfy TypeScript's module resolution while allowing 
 * platform-specific extensions (.web.tsx and .native.tsx) to handle the implementation.
 */
const MapComponent = (props: MapComponentProps) => {
    if (Platform.OS === 'web') {
        const WebMap = require('./GarbageMapComponent.web').default;
        return <WebMap {...props} />;
    } else {
        const NativeMap = require('./GarbageMapComponent.native').default;
        return <NativeMap {...props} />;
    }
};

export default MapComponent;
