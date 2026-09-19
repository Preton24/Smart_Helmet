import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './Text';

interface MapComponentProps {
    mapRef: any;
    mapRegion: any;
    onRegionChangeComplete: (region: any) => void;
    clusters: any[];
    zoomToCluster: (cluster: any) => void;
    getMarkerColor: (count: number) => string;
}

export default function MapComponent(props: MapComponentProps) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text>Loading Map...</Text>
            </View>
        );
    }

    // Now safe to require Leaflet and React-Leaflet
    const L = require('leaflet');
    require('leaflet/dist/leaflet.css');
    const { MapContainer, TileLayer, Marker, useMap } = require('react-leaflet');

    // Fix Leaflet icon issue
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });

    return <MapInternal {...props} L={L} MapContainer={MapContainer} TileLayer={TileLayer} Marker={Marker} useMap={useMap} />;
}

function MapInternal({ mapRef, mapRegion, onRegionChangeComplete, clusters, zoomToCluster, getMarkerColor, L, MapContainer, TileLayer, Marker, useMap }: any) {
    // Component to handle region changes and exposing map instance
    function MapEvents({ onRegionChangeComplete, mapRef }: { onRegionChangeComplete: (region: any) => void, mapRef: any }) {
        const map = useMap();
        
        useEffect(() => {
            if (mapRef) {
                mapRef.current = {
                    animateToRegion: (region: any, duration: number) => {
                        map.flyTo([region.latitude, region.longitude], map.getZoom() + 1, { duration: duration / 1000 });
                    }
                };
            }
        }, [map, mapRef]);

        useEffect(() => {
            const handleMoveEnd = () => {
                const center = map.getCenter();
                const bounds = map.getBounds();
                onRegionChangeComplete({
                    latitude: center.lat,
                    longitude: center.lng,
                    latitudeDelta: Math.abs(bounds.getNorth() - center.lat),
                    longitudeDelta: Math.abs(bounds.getEast() - center.lng),
                });
            };

            map.on('moveend', handleMoveEnd);
            return () => {
                map.off('moveend', handleMoveEnd);
            };
        }, [map, onRegionChangeComplete]);

        return null;
    }

    return (
        <View style={styles.container}>
            <MapContainer
                center={[mapRegion.latitude, mapRegion.longitude]}
                zoom={12}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <MapEvents onRegionChangeComplete={onRegionChangeComplete} mapRef={mapRef} />
                {clusters.map((cluster: any) => {
                    const color = getMarkerColor(cluster.totalReports);
                    const isCluster = cluster.wardCount > 1;
                    const size = isCluster
                        ? Math.min(28 + cluster.wardCount * 2, 52)
                        : 28;

                    // Create custom DivIcon for Leaflet
                    const icon = L.divIcon({
                        className: 'custom-marker',
                        html: `
                            <div style="
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                cursor: pointer;
                            ">
                                <div style="
                                    background-color: ${color};
                                    min-width: ${size}px;
                                    min-height: ${size}px;
                                    border-radius: ${size / 2}px;
                                    display: flex;
                                    flex-direction: column;
                                    align-items: center;
                                    justify-content: center;
                                    box-shadow: 0 2px 4px rgba(0,0,0,0.25);
                                    border: ${isCluster ? '3px solid rgba(255,255,255,0.6)' : 'none'};
                                    color: white;
                                    font-weight: 800;
                                    padding: 4px;
                                    box-sizing: border-box;
                                ">
                                    <div style="font-size: ${isCluster ? '13px' : '11px'}">${cluster.totalReports}</div>
                                    ${isCluster ? `<div style="font-size: 8px; font-weight: 600; opacity: 0.85">${cluster.wardCount} wards</div>` : ''}
                                </div>
                                ${!isCluster ? `
                                    <div style="
                                        width: 0;
                                        height: 0;
                                        border-left: 6px solid transparent;
                                        border-right: 6px solid transparent;
                                        border-top: 6px solid ${color};
                                        margin-top: -1px;
                                    "></div>
                                ` : ''}
                            </div>
                        `,
                        iconSize: [size, size + (isCluster ? 0 : 6)],
                        iconAnchor: [size / 2, size + (isCluster ? -size / 2 : 5)],
                    });

                    return (
                        <Marker
                            key={cluster.id}
                            position={[cluster.latitude, cluster.longitude]}
                            icon={icon}
                            eventHandlers={{
                                click: () => zoomToCluster(cluster),
                            }}
                        />
                    );
                })}
            </MapContainer>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        height: '100%',
    }
});
