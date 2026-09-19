import React, { useState, useMemo, useRef } from 'react';
import {
    View,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Platform,
    Dimensions,
    Image,
    Animated,
    Linking,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import MapComponent from './GarbageMapComponent';
import { Text } from './Text';
import { Header } from './Header';
import { ArrowLeft, X, User, MapPin, AlertTriangle, BarChart3, Building2, ChevronDown, ChevronUp } from 'lucide-react-native';

import wardsData from '../lib/wards.json';
import reportsData from '../lib/reports.json';
import representativesData from '../lib/representatives.json';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Ward {
    ward_number_369: number;
    slug: string;
    ward_name: string;
    ward_name_kn: string;
    zone_name: string;
    corporation: string;
    corporation_id: number;
    ward_id_within_corp: number;
    assembly_constituency: string;
    parliamentary_constituency: string;
    center_lat: number;
    center_lng: number;
}

interface Report {
    id: string;
    latitude: number;
    longitude: number;
    ward_number_369: number;
    address: string;
    severity: string;
    category: string;
    status: string;
    photo_url: string;
    upvote_count: number;
    created_at: string;
}

interface Representative {
    id: number;
    name: string;
    role: string;
    party: string;
    constituency: string;
    phone: string | null;
    email: string | null;
    photo_url: string;
    twitter_handle: string | null;
    active: boolean;
}

interface GarbageMapProps {
    onBack: () => void;
}

interface Cluster {
    id: string;
    latitude: number;
    longitude: number;
    totalReports: number;
    wardCount: number;
    wards: Ward[];
}

interface MapRegion {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
}

// Grid-based clustering: groups nearby wards based on zoom level
function clusterWards(
    wards: Ward[],
    reportCounts: Record<number, number>,
    region: MapRegion
): Cluster[] {
    // Cell size scales with zoom: bigger cells when zoomed out
    const cellSize = region.latitudeDelta / 6;
    const grid: Record<string, Ward[]> = {};

    wards.forEach((ward) => {
        const cellX = Math.floor(ward.center_lat / cellSize);
        const cellY = Math.floor(ward.center_lng / cellSize);
        const key = `${cellX}_${cellY}`;
        if (!grid[key]) grid[key] = [];
        grid[key].push(ward);
    });

    return Object.entries(grid).map(([key, cellWards]) => {
        let totalLat = 0, totalLng = 0, totalReports = 0;
        cellWards.forEach((w) => {
            totalLat += w.center_lat;
            totalLng += w.center_lng;
            totalReports += reportCounts[w.ward_number_369] || 0;
        });
        return {
            id: key,
            latitude: totalLat / cellWards.length,
            longitude: totalLng / cellWards.length,
            totalReports,
            wardCount: cellWards.length,
            wards: cellWards,
        };
    });
}

// Color based on report severity count
function getMarkerColor(reportCount: number): string {
    if (reportCount === 0) return '#22C55E'; // green
    if (reportCount <= 3) return '#EAB308'; // yellow
    if (reportCount <= 8) return '#F97316'; // orange
    return '#EF4444'; // red
}

function getSeverityLabel(reportCount: number): string {
    if (reportCount === 0) return 'Clean';
    if (reportCount <= 3) return 'Low';
    if (reportCount <= 8) return 'Moderate';
    return 'High';
}

function getPartyColor(party: string): string {
    switch (party) {
        case 'BJP': return '#FF9933';
        case 'INC': return '#19AAED';
        case 'JDS': return '#006400';
        default: return '#888888';
    }
}

export function GarbageMap({ onBack }: GarbageMapProps) {
    const { colorScheme } = useColorScheme();
    const isDarkMode = colorScheme === 'dark';
    const [selectedWard, setSelectedWard] = useState<Ward | null>(null);
    const [showPanel, setShowPanel] = useState(false);
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const [mapRegion, setMapRegion] = useState<MapRegion>({
        latitude: 12.9716,
        longitude: 77.5946,
        latitudeDelta: 0.15,
        longitudeDelta: 0.15,
    });
    const mapRef = useRef<any>(null);

    // Build report counts per ward
    const reportCountByWard = useMemo(() => {
        const counts: Record<number, number> = {};
        (reportsData as Report[]).forEach((report) => {
            const wn = report.ward_number_369;
            counts[wn] = (counts[wn] || 0) + 1;
        });
        return counts;
    }, []);

    // Build severity breakdown per ward
    const severityByWard = useMemo(() => {
        const breakdown: Record<number, Record<string, number>> = {};
        (reportsData as Report[]).forEach((report) => {
            const wn = report.ward_number_369;
            if (!breakdown[wn]) breakdown[wn] = {};
            breakdown[wn][report.severity] = (breakdown[wn][report.severity] || 0) + 1;
        });
        return breakdown;
    }, []);

    // Build status breakdown per ward
    const statusByWard = useMemo(() => {
        const breakdown: Record<number, Record<string, number>> = {};
        (reportsData as Report[]).forEach((report) => {
            const wn = report.ward_number_369;
            if (!breakdown[wn]) breakdown[wn] = {};
            breakdown[wn][report.status] = (breakdown[wn][report.status] || 0) + 1;
        });
        return breakdown;
    }, []);

    // Find representatives for a ward
    const getRepresentatives = (ward: Ward): Representative[] => {
        const reps: Representative[] = [];
        (representativesData as Representative[]).forEach((rep) => {
            if (
                rep.constituency === ward.assembly_constituency ||
                rep.constituency === ward.parliamentary_constituency
            ) {
                reps.push(rep);
            }
        });
        return reps;
    };

    // Only show wards that have reports (to avoid 369 markers)
    const wardsWithReports = useMemo(() => {
        return (wardsData as Ward[]).filter(
            (w) => (reportCountByWard[w.ward_number_369] || 0) > 0
        );
    }, [reportCountByWard]);

    // Clustered markers based on current zoom
    const clusters = useMemo(
        () => clusterWards(wardsWithReports, reportCountByWard, mapRegion),
        [wardsWithReports, reportCountByWard, mapRegion]
    );

    const handleTweet = () => {
        if (!selectedWard) return;

        const wardName = selectedWard.ward_name;
        const totalReports = wardReports.length;
        const severity = getSeverityLabel(selectedReportCount).toUpperCase();
        const repNames = selectedReps.map(r => `${r.name} (${r.role.toUpperCase()})`).join(', ');

        const tweetText = `🚨 GARBAGE CRISIS: ${severity} condition in Ward ${selectedWard.ward_number_369} (${wardName})!
${totalReports} active reports. Accountability needed from:

Elected Reps: ${repNames}
Officials: Commissioner, Additional Commissioner, AEE, JHI.

📍 ${selectedWard.zone_name}`;

        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        Linking.openURL(url);
    };

    // Summary stats
    const totalReports = useMemo(() => (reportsData as Report[]).length, []);
    const affectedWards = useMemo(() => wardsWithReports.length, [wardsWithReports]);

    const openPanel = (ward: Ward) => {
        setSelectedWard(ward);
        setShowPanel(true);
        Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
        }).start();
    };

    const closePanel = () => {
        Animated.timing(slideAnim, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            useNativeDriver: true,
        }).start(() => {
            setShowPanel(false);
            setSelectedWard(null);
        });
    };

    // Zoom into a cluster to expand it
    const zoomToCluster = (cluster: Cluster) => {
        if (cluster.wardCount === 1) {
            openPanel(cluster.wards[0]);
            return;
        }
        const newDelta = mapRegion.latitudeDelta / 3;
        mapRef.current?.animateToRegion(
            {
                latitude: cluster.latitude,
                longitude: cluster.longitude,
                latitudeDelta: newDelta,
                longitudeDelta: newDelta,
            },
            400
        );
    };

    const selectedReportCount = selectedWard
        ? reportCountByWard[selectedWard.ward_number_369] || 0
        : 0;
    const selectedReps = selectedWard ? getRepresentatives(selectedWard) : [];
    const selectedSeverity = selectedWard
        ? severityByWard[selectedWard.ward_number_369] || {}
        : {};
    const selectedStatus = selectedWard
        ? statusByWard[selectedWard.ward_number_369] || {}
        : {};

    // Get all reports for the selected ward
    const wardReports = useMemo(() => {
        if (!selectedWard) return [];
        return (reportsData as Report[]).filter(
            (r) => r.ward_number_369 === selectedWard.ward_number_369
        );
    }, [selectedWard]);

    return (
        <View style={styles.container} className="bg-gray-50 dark:bg-black">
            <Header
                title="Garbage Map"
                className="bg-white dark:bg-neutral-900 border-gray-200 dark:border-gray-800"
                leftContent={
                    <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                        <ArrowLeft size={24} color={isDarkMode ? "#fff" : "#000"} />
                    </TouchableOpacity>
                }
            />

            {/* Summary bar */}
            <View style={styles.summaryBar} className="bg-white dark:bg-neutral-900 border-gray-200 dark:border-gray-800">
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryNumber} className="text-gray-900 dark:text-gray-100">{totalReports.toLocaleString()}</Text>
                    <Text style={styles.summaryLabel} variant="muted">Total Reports</Text>
                </View>
                <View style={styles.summaryDivider} className="bg-gray-200 dark:bg-gray-800" />
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryNumber} className="text-gray-900 dark:text-gray-100">{affectedWards}</Text>
                    <Text style={styles.summaryLabel} variant="muted">Affected Wards</Text>
                </View>
                <View style={styles.summaryDivider} className="bg-gray-200 dark:bg-gray-800" />
                <View style={styles.summaryItem}>
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
                        <View style={[styles.legendDot, { backgroundColor: '#EAB308' }]} />
                        <View style={[styles.legendDot, { backgroundColor: '#F97316' }]} />
                        <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                    </View>
                    <Text style={styles.summaryLabel} variant="muted">Severity Scale</Text>
                </View>
            </View>

            {/* Map */}
            <View style={styles.mapContainer}>
                <MapComponent
                    mapRef={mapRef}
                    mapRegion={mapRegion}
                    onRegionChangeComplete={(r: any) => setMapRegion(r)}
                    clusters={clusters}
                    zoomToCluster={zoomToCluster}
                    getMarkerColor={getMarkerColor}
                />
            </View>

            {/* Bottom detail panel */}
            {showPanel && selectedWard && (
                <Animated.View
                    style={[
                        styles.panelOverlay,
                        { transform: [{ translateY: slideAnim }] },
                    ]}
                >
                    <View style={styles.panel} className="bg-white dark:bg-neutral-900">
                        {/* Panel handle */}
                        <View style={styles.panelHandle} className="bg-gray-300 dark:bg-gray-700" />

                        {/* Close button */}
                        <TouchableOpacity
                            onPress={closePanel}
                            style={styles.panelClose}
                            className="bg-gray-100 dark:bg-gray-800 rounded-full"
                        >
                            <X size={20} color={isDarkMode ? "#999" : "#666"} />
                        </TouchableOpacity>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            style={styles.panelScroll}
                        >
                            {/* Ward header */}
                            <View style={styles.wardHeader}>
                                <View style={styles.wardTitleRow}>
                                    <View
                                        style={[
                                            styles.wardBadge,
                                            {
                                                backgroundColor:
                                                    getMarkerColor(selectedReportCount) + '20',
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.wardBadgeText,
                                                {
                                                    color: getMarkerColor(
                                                        selectedReportCount
                                                    ),
                                                },
                                            ]}
                                        >
                                            Ward {selectedWard.ward_number_369}
                                        </Text>
                                    </View>
                                    <View
                                        style={[
                                            styles.severityPill,
                                            {
                                                backgroundColor:
                                                    getMarkerColor(selectedReportCount) + '20',
                                            },
                                        ]}
                                    >
                                        <AlertTriangle
                                            size={12}
                                            color={getMarkerColor(selectedReportCount)}
                                        />
                                        <Text
                                            style={[
                                                styles.severityPillText,
                                                {
                                                    color: getMarkerColor(
                                                        selectedReportCount
                                                    ),
                                                },
                                            ]}
                                        >
                                            {getSeverityLabel(selectedReportCount)}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.wardName} className="text-gray-900 dark:text-gray-100">
                                    {selectedWard.ward_name}
                                </Text>
                                <Text style={styles.wardNameKn} className="text-gray-600 dark:text-gray-400">
                                    {selectedWard.ward_name_kn}
                                </Text>
                                <View style={styles.wardMeta}>
                                    <MapPin size={12} color={isDarkMode ? "#666" : "#888"} />
                                    <Text style={styles.wardMetaText} className="text-gray-500 dark:text-gray-500">
                                        {selectedWard.zone_name} • {selectedWard.corporation}
                                    </Text>
                                </View>
                            </View>

                            {/* Recent Photos */}
                            {wardReports.length > 0 && (
                                <View style={styles.photosSection}>
                                    <Text style={styles.sectionTitle} className="text-gray-700 dark:text-gray-300">Report Photos</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
                                        {wardReports.map((report) => (
                                            <View key={report.id} style={styles.photoContainer} className="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                                <Image 
                                                    source={{ uri: report.photo_url }} 
                                                    style={styles.reportPhoto}
                                                    resizeMode="cover"
                                                />
                                                <View style={styles.photoSeverity} className="bg-black/50">
                                                    <Text style={styles.photoSeverityText}>{report.severity}</Text>
                                                </View>
                                            </View>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            {/* Stats cards */}
                            <View style={styles.statsRow}>
                                <View style={[styles.statCard, { backgroundColor: isDarkMode ? '#451a03' : '#FEF3C7' }]}>
                                    <BarChart3 size={18} color={isDarkMode ? "#fbbf24" : "#D97706"} />
                                    <Text style={[styles.statNumber, { color: isDarkMode ? '#fbbf24' : '#D97706' }]}>
                                        {selectedReportCount}
                                    </Text>
                                    <Text style={styles.statLabel} className="text-gray-600 dark:text-gray-400">Total Reports</Text>
                                </View>
                                <View style={[styles.statCard, { backgroundColor: isDarkMode ? '#450a0a' : '#FEE2E2' }]}>
                                    <AlertTriangle size={18} color={isDarkMode ? "#f87171" : "#DC2626"} />
                                    <Text style={[styles.statNumber, { color: isDarkMode ? '#f87171' : '#DC2626' }]}>
                                        {selectedStatus['unresolved'] || 0}
                                    </Text>
                                    <Text style={styles.statLabel} className="text-gray-600 dark:text-gray-400">Unresolved</Text>
                                </View>
                                <View style={[styles.statCard, { backgroundColor: isDarkMode ? '#064e3b' : '#DCFCE7' }]}>
                                    <Building2 size={18} color={isDarkMode ? "#34d399" : "#16A34A"} />
                                    <Text style={[styles.statNumber, { color: isDarkMode ? '#34d399' : '#16A34A' }]}>
                                        {selectedStatus['resolved'] || 0}
                                    </Text>
                                    <Text style={styles.statLabel} className="text-gray-600 dark:text-gray-400">Resolved</Text>
                                </View>
                            </View>

                            {/* Severity breakdown */}
                            {Object.keys(selectedSeverity).length > 0 && (
                                <View style={styles.breakdownSection}>
                                    <Text style={styles.sectionTitle} className="text-gray-700 dark:text-gray-300">Severity Breakdown</Text>
                                    <View style={styles.breakdownBar} className="bg-gray-200 dark:bg-gray-800">
                                        {['massive', 'large', 'medium', 'small'].map((sev) => {
                                            const count = selectedSeverity[sev] || 0;
                                            if (count === 0) return null;
                                            const pct = (count / selectedReportCount) * 100;
                                            const colors: Record<string, string> = {
                                                massive: '#DC2626',
                                                large: '#F97316',
                                                medium: '#EAB308',
                                                small: '#22C55E',
                                            };
                                            return (
                                                <View
                                                    key={sev}
                                                    style={[
                                                        styles.breakdownSegment,
                                                        {
                                                            width: `${pct}%` as any,
                                                            backgroundColor: colors[sev],
                                                        },
                                                    ]}
                                                />
                                            );
                                        })}
                                    </View>
                                    <View style={styles.breakdownLegend}>
                                        {['massive', 'large', 'medium', 'small'].map((sev) => {
                                            const count = selectedSeverity[sev] || 0;
                                            if (count === 0) return null;
                                            const colors: Record<string, string> = {
                                                massive: '#DC2626',
                                                large: '#F97316',
                                                medium: '#EAB308',
                                                small: '#22C55E',
                                            };
                                            return (
                                                <View key={sev} style={styles.legendItem}>
                                                    <View
                                                        style={[
                                                            styles.legendDotSmall,
                                                            { backgroundColor: colors[sev] },
                                                        ]}
                                                    />
                                                    <Text style={styles.legendText} className="text-gray-500 dark:text-gray-400">
                                                        {sev.charAt(0).toUpperCase() + sev.slice(1)}: {count}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>
                            )}

                            {/* Constituency info */}
                            <View style={styles.constituencySection} className="bg-gray-100 dark:bg-gray-800/50">
                                <Text style={styles.sectionTitle} className="text-gray-700 dark:text-gray-300">Constituency</Text>
                                <View style={styles.constituencyRow}>
                                    <Text style={styles.constituencyLabel} className="text-gray-500 dark:text-gray-400">Assembly:</Text>
                                    <Text style={styles.constituencyValue} className="text-gray-800 dark:text-gray-200">
                                        {selectedWard.assembly_constituency}
                                    </Text>
                                </View>
                                <View style={styles.constituencyRow}>
                                    <Text style={styles.constituencyLabel} className="text-gray-500 dark:text-gray-400">Parliamentary:</Text>
                                    <Text style={styles.constituencyValue} className="text-gray-800 dark:text-gray-200">
                                        {selectedWard.parliamentary_constituency}
                                    </Text>
                                </View>
                            </View>

                            {/* Representatives */}
                            <View style={styles.repsSection}>
                                <Text style={styles.sectionTitle} className="text-gray-700 dark:text-gray-300">
                                    Responsible Representatives ({selectedReps.length})
                                </Text>
                                {selectedReps.length === 0 ? (
                                    <Text style={styles.noReps} className="text-gray-400 dark:text-gray-500">
                                        No representatives found for this ward.
                                    </Text>
                                ) : (
                                    selectedReps.map((rep) => (
                                        <View key={rep.id} style={styles.repCard} className="bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-800">
                                            <Image
                                                source={{ uri: rep.photo_url }}
                                                style={styles.repPhoto}
                                                defaultSource={require('../assets/images/icon.png')}
                                            />
                                            <View style={styles.repInfo}>
                                                <Text style={styles.repName} className="text-gray-900 dark:text-gray-100">{rep.name}</Text>
                                                <View style={styles.repMetaRow}>
                                                    <View
                                                        style={[
                                                            styles.roleBadge,
                                                            {
                                                                backgroundColor:
                                                                    rep.role === 'mp'
                                                                        ? (isDarkMode ? '#2e1065' : '#EDE9FE')
                                                                        : (isDarkMode ? '#172554' : '#DBEAFE'),
                                                            },
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.roleBadgeText,
                                                                {
                                                                    color:
                                                                        rep.role === 'mp'
                                                                            ? (isDarkMode ? '#a78bfa' : '#7C3AED')
                                                                            : (isDarkMode ? '#60a5fa' : '#2563EB'),
                                                                },
                                                            ]}
                                                        >
                                                            {rep.role.toUpperCase()}
                                                        </Text>
                                                    </View>
                                                    <View
                                                        style={[
                                                            styles.partyBadge,
                                                            {
                                                                backgroundColor:
                                                                    getPartyColor(rep.party) + (isDarkMode ? '40' : '20'),
                                                            },
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.partyBadgeText,
                                                                {
                                                                    color: getPartyColor(rep.party),
                                                                },
                                                            ]}
                                                        >
                                                            {rep.party}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Text style={styles.repConstituency} className="text-gray-500 dark:text-gray-400">
                                                    {rep.constituency}
                                                </Text>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </View>

                             {/* Accountability CTA */}
                            <TouchableOpacity 
                                style={[
                                    styles.tweetCta,
                                    { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }
                                ]} 
                                onPress={handleTweet}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.xLogo, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>𝕏</Text>
                                <Text style={[styles.tweetCtaText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>Tweet</Text>
                            </TouchableOpacity>

                            {/* Bottom spacing */}
                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </View>
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backBtn: {
        padding: 8,
    },
    summaryBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryNumber: {
        fontSize: 18,
        fontWeight: '700',
    },
    summaryLabel: {
        fontSize: 10,
        marginTop: 2,
    },
    summaryDivider: {
        width: 1,
        height: 30,
    },
    legendRow: {
        flexDirection: 'row',
        gap: 4,
        marginBottom: 2,
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    mapContainer: {
        flex: 1,
    },
    // Panel styles
    panelOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: SCREEN_HEIGHT * 0.55,
    },
    panel: {
        flex: 1,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 20,
    },
    panelHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 4,
    },
    panelClose: {
        position: 'absolute',
        top: 12,
        right: 16,
        zIndex: 10,
        padding: 4,
    },
    panelScroll: {
        flex: 1,
        paddingHorizontal: 20,
    },
    // Ward header
    wardHeader: {
        marginTop: 8,
        marginBottom: 16,
    },
    wardTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    wardBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    wardBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    severityPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    severityPillText: {
        fontSize: 11,
        fontWeight: '600',
    },
    wardName: {
        fontSize: 22,
        fontWeight: '800',
    },
    wardNameKn: {
        fontSize: 14,
        marginTop: 2,
    },
    wardMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 6,
    },
    wardMetaText: {
        fontSize: 12,
    },
    // Stats
    statsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        gap: 4,
    },
    statNumber: {
        fontSize: 20,
        fontWeight: '800',
    },
    statLabel: {
        fontSize: 10,
        fontWeight: '500',
    },
    // Breakdown
    breakdownSection: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 8,
    },
    breakdownBar: {
        flexDirection: 'row',
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },
    breakdownSegment: {
        height: '100%',
    },
    breakdownLegend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 8,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    legendDotSmall: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        fontSize: 11,
    },
    // Constituency
    constituencySection: {
        marginBottom: 16,
        padding: 12,
        borderRadius: 12,
    },
    constituencyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    constituencyLabel: {
        fontSize: 12,
    },
    constituencyValue: {
        fontSize: 12,
        fontWeight: '600',
    },
    // Representatives
    repsSection: {
        marginBottom: 8,
    },
    noReps: {
        fontSize: 13,
        fontStyle: 'italic',
    },
    repCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 14,
        marginBottom: 8,
        borderWidth: 1,
    },
    repPhoto: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#E5E7EB',
        marginRight: 12,
    },
    repInfo: {
        flex: 1,
    },
    repName: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 4,
    },
    repMetaRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 2,
    },
    roleBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    roleBadgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    partyBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    partyBadgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    repConstituency: {
        fontSize: 11,
        marginTop: 2,
    },
    // Photos section styles
    photosSection: {
        marginBottom: 20,
    },
    photosScroll: {
        marginHorizontal: -4,
    },
    photoContainer: {
        width: 120,
        height: 120,
        borderRadius: 12,
        marginHorizontal: 4,
        overflow: 'hidden',
        borderWidth: 1,
    },
    reportPhoto: {
        width: '100%',
        height: '100%',
    },
    photoSeverity: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingVertical: 2,
        alignItems: 'center',
    },
    photoSeverityText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    tweetCta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        gap: 8,
        marginVertical: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    xLogo: {
        fontSize: 18,
        fontWeight: '900',
    },
    tweetCtaText: {
        fontSize: 16,
        fontWeight: '800',
    },
});
