import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { UrlTile, Marker } from 'react-native-maps';
import { Text } from './Text';

interface MapComponentProps {
    mapRef: React.RefObject<MapView>;
    mapRegion: any;
    onRegionChangeComplete: (region: any) => void;
    clusters: any[];
    zoomToCluster: (cluster: any) => void;
    getMarkerColor: (count: number) => string;
}

export default function MapComponent({
    mapRef,
    mapRegion,
    onRegionChangeComplete,
    clusters,
    zoomToCluster,
    getMarkerColor,
}: MapComponentProps) {
    return (
        <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            initialRegion={mapRegion}
            onRegionChangeComplete={onRegionChangeComplete}
        >
            <UrlTile
                urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maximumZ={19}
                flipY={false}
            />
            {clusters.map((cluster) => {
                const color = getMarkerColor(cluster.totalReports);
                const isCluster = cluster.wardCount > 1;
                const size = isCluster
                    ? Math.min(28 + cluster.wardCount * 2, 52)
                    : 28;
                return (
                    <Marker
                        key={cluster.id}
                        coordinate={{
                            latitude: cluster.latitude,
                            longitude: cluster.longitude,
                        }}
                        onPress={() => zoomToCluster(cluster)}
                        tracksViewChanges={false}
                    >
                        <View style={styles.markerContainer}>
                            <View
                                style={[
                                    styles.markerBubble,
                                    {
                                        backgroundColor: color,
                                        minWidth: size,
                                        minHeight: size,
                                        borderRadius: size / 2,
                                        borderWidth: isCluster ? 3 : 0,
                                        borderColor: 'rgba(255,255,255,0.6)',
                                    },
                                ]}
                            >
                                <Text style={[
                                    styles.markerText,
                                    { fontSize: isCluster ? 13 : 11 },
                                ]}>
                                    {cluster.totalReports}
                                </Text>
                                {isCluster && (
                                    <Text style={styles.clusterSubText}>
                                        {cluster.wardCount} wards
                                    </Text>
                                )}
                            </View>
                            {!isCluster && (
                                <View
                                    style={[
                                        styles.markerArrow,
                                        { borderTopColor: color },
                                    ]}
                                />
                            )}
                        </View>
                    </Marker>
                );
            })}
        </MapView>
    );
}

const styles = StyleSheet.create({
    markerContainer: {
        alignItems: 'center',
    },
    markerBubble: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        minWidth: 28,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    markerText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '800',
    },
    clusterSubText: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 8,
        fontWeight: '600',
        marginTop: -1,
    },
    markerArrow: {
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 6,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        marginTop: -1,
    },
});
