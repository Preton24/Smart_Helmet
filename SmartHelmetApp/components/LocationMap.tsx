import React from 'react';
import { Platform } from 'react-native';

interface LocationMapProps {
    region: any;
    setRegion: (region: any) => void;
    familyMembers: any[];
}

/**
 * Bridge component for LocationMap to handle cross-platform rendering.
 */
export function LocationMap(props: LocationMapProps) {
    if (Platform.OS === 'web') {
        const { LocationMap: WebMap } = require('./LocationMap.web');
        return <WebMap {...props} />;
    } else {
        const { LocationMap: NativeMap } = require('./LocationMap.native');
        return <NativeMap {...props} />;
    }
}
