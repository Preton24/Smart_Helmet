import { View, ScrollView, TouchableOpacity, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Text } from '../../components/Text';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';
import { Button } from '../../components/Button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Activity, UploadCloud, ChevronRight } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';

const screenWidth = Dimensions.get('window').width;

interface ImpactIncident {
    id: string;
    title: string;
    timestamp: string;
    force: number;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    videoPath: string; // Store as 'video1' or 'video2' for AsyncStorage
    forceScore?: number;
    injuryProb?: string;
    fallDirection?: string;
    tiltAngle?: number;
    history?: Array<{ time: string; force: number }>;
}

const INITIAL_INCIDENTS: ImpactIncident[] = [
    {
        id: '123',
        title: 'High Impact Detected',
        timestamp: new Date().toISOString(),
        force: 8.5,
        severity: 'CRITICAL',
        videoPath: 'video1', // Reference to video1_impact.mp4
        forceScore: 8.5,
        injuryProb: 'Low',
        fallDirection: 'Left',
        tiltAngle: 45,
        history: [
            { time: '10:00', force: 2 },
            { time: '10:05', force: 3 },
            { time: '10:10', force: 8.5 },
            { time: '10:15', force: 0 },
        ]
    },
    {
        id: '124',
        title: 'Minor Bump',
        timestamp: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        force: 3.0,
        severity: 'LOW',
        videoPath: 'video2', // Reference to video2_impact.mp4
        forceScore: 3.0,
        injuryProb: 'Very Low',
        fallDirection: 'Forward',
        tiltAngle: 15,
        history: [
            { time: '16:00', force: 1 },
            { time: '16:05', force: 3.0 },
            { time: '16:10', force: 0 },
        ]
    }
];

export default function Impact() {
    const router = useRouter();
    const [incidents, setIncidents] = useState<ImpactIncident[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        loadIncidents();
    }, []);

    // Reload incidents when screen comes into focus (e.g., after deleting an incident)
    useFocusEffect(
        useCallback(() => {
            loadIncidents();
        }, [])
    );

    const loadIncidents = async () => {
        try {
            const stored = await AsyncStorage.getItem('impactIncidents');
            if (stored) {
                const parsed = JSON.parse(stored);
                // Convert videoPath back to require format if needed
                setIncidents(parsed);
            } else {
                // Initialize with default incidents
                await saveIncidents(INITIAL_INCIDENTS);
                setIncidents(INITIAL_INCIDENTS);
            }
        } catch (error) {
            console.error('Failed to load incidents:', error);
            // Fallback to initial incidents
            setIncidents(INITIAL_INCIDENTS);
        } finally {
            setLoading(false);
        }
    };

    const saveIncidents = async (incidentsToSave: ImpactIncident[]) => {
        try {
            // videoPath is already a string, so we can store directly
            await AsyncStorage.setItem('impactIncidents', JSON.stringify(incidentsToSave));
        } catch (error) {
            console.error('Failed to save incidents:', error);
        }
    };

    // Demo mapping: uploaded filename → videoPath key used in impact/[id].tsx VIDEO_MAP
    const DEMO_VIDEO_MAP: Record<string, {
        videoPath: string;
        title: string;
        force: number;
        severity: ImpactIncident['severity'];
        injuryProb: string;
        fallDirection: string;
        tiltAngle: number;
        history: Array<{ time: string; force: number }>;
    }> = {
        'video1.mp4': {
            videoPath: 'video1',
            title: 'High Impact Detected',
            force: 8.5,
            severity: 'CRITICAL',
            injuryProb: 'Low',
            fallDirection: 'Left',
            tiltAngle: 45,
            history: [
                { time: '10:00', force: 2 },
                { time: '10:05', force: 3 },
                { time: '10:10', force: 8.5 },
                { time: '10:15', force: 0 },
            ],
        },
        'video2.mp4': {
            videoPath: 'video2',
            title: 'Minor Bump',
            force: 3.0,
            severity: 'LOW',
            injuryProb: 'Very Low',
            fallDirection: 'Forward',
            tiltAngle: 15,
            history: [
                { time: '16:00', force: 1 },
                { time: '16:05', force: 3.0 },
                { time: '16:10', force: 0 },
            ],
        },
        'video3.mp4': {
            videoPath: 'video3',
            title: 'Moderate Impact',
            force: 6.2,
            severity: 'MEDIUM',
            injuryProb: 'Medium',
            fallDirection: 'Backward',
            tiltAngle: 30,
            history: [
                { time: '12:00', force: 1.5 },
                { time: '12:05', force: 2.8 },
                { time: '12:10', force: 6.2 },
                { time: '12:15', force: 0 },
            ],
        },
    };

    const handleUpload = async () => {
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Permission needed', 'Please allow media library access to select a video.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsMultipleSelection: false,
                quality: 1,
            });

            if (result.canceled || !result.assets[0]) {
                return;
            }

            const videoAsset = result.assets[0];

            // Use fileName (preserved by expo-image-picker) for demo detection.
            // iOS randomises the temp URI path, so URI alone is unreliable.
            const rawName = videoAsset.fileName ?? videoAsset.uri.split('/').pop() ?? '';
            const fileName = rawName.toLowerCase();
            const demoKey = Object.keys(DEMO_VIDEO_MAP).find(
                (k) => fileName === k || fileName.endsWith(k)
            );

            if (!demoKey) {
                Alert.alert('Unsupported video', 'Please upload video1.mp4, video2.mp4, or video3.mp4 for analysis.');
                return;
            }

            setIsAnalyzing(true);

            // Simulate 5s processing — no actual network upload
            await new Promise((resolve) => setTimeout(resolve, 5000));

            const demo = DEMO_VIDEO_MAP[demoKey];
            const newIncident: ImpactIncident = {
                id: Date.now().toString(),
                title: demo.title,
                timestamp: new Date().toISOString(),
                force: demo.force,
                severity: demo.severity,
                videoPath: demo.videoPath,
                forceScore: demo.force,
                injuryProb: demo.injuryProb,
                fallDirection: demo.fallDirection,
                tiltAngle: demo.tiltAngle,
                history: demo.history,
            };

            const updatedIncidents = [newIncident, ...incidents];
            setIncidents(updatedIncidents);
            await saveIncidents(updatedIncidents);
            setIsAnalyzing(false);
            router.push(`/impact/${newIncident.id}`);
        } catch (error) {
            console.error('Upload failed:', error);
            setIsAnalyzing(false);
            Alert.alert('Error', 'Failed to add the selected video. Please try again.');
        }
    };

    const formatDate = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return `Today, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
        } else if (diffDays === 1) {
            return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'CRITICAL':
                return 'text-red-500';
            case 'HIGH':
                return 'text-orange-500';
            case 'MEDIUM':
                return 'text-yellow-500';
            case 'LOW':
                return 'text-blue-500';
            default:
                return 'text-gray-500';
        }
    };

    const getSeverityBgColor = (severity: string) => {
        switch (severity) {
            case 'CRITICAL':
                return 'bg-red-100 dark:bg-red-900/30';
            case 'HIGH':
                return 'bg-orange-100 dark:bg-orange-900/30';
            case 'MEDIUM':
                return 'bg-yellow-100 dark:bg-yellow-900/30';
            case 'LOW':
                return 'bg-blue-100 dark:bg-blue-900/30';
            default:
                return 'bg-gray-100 dark:bg-gray-900/30';
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black" edges={['top']}>
            <Header title="Impact" />

            <ScrollView
                className="flex-1 px-4 py-4"
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Upload Section */}
                <Card className="mb-8 p-6 items-center border-dashed border-2 border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-neutral-900">
                    <View className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 items-center justify-center mb-4">
                        {isAnalyzing ? (
                            <ActivityIndicator size="large" color="#3B82F6" />
                        ) : (
                            <UploadCloud size={32} color="#3B82F6" />
                        )}
                    </View>
                    <Text className="text-lg font-bold mb-1">
                        {isAnalyzing ? 'Analyzing Impact...' : 'Upload Impact Data'}
                    </Text>
                    <Text className="text-center text-sm mb-4" variant="muted">
                        {isAnalyzing
                            ? 'Processing g-force and orientation data...'
                            : 'Sync data from your smart helmet to analyze latest impacts.'}
                    </Text>
                    <Button
                        title={isAnalyzing ? 'Analyzing...' : 'Upload New Data'}
                        onPress={handleUpload}
                        className="w-full"
                        disabled={isAnalyzing}
                    />
                </Card>

                {/* History List */}
                <SectionTitle title="Recent Activity" />
                {loading ? (
                    <View className="py-8 items-center">
                        <Text variant="muted">Loading incidents...</Text>
                    </View>
                ) : incidents.length === 0 ? (
                    <View className="py-8 items-center">
                        <Text variant="muted">No incidents recorded yet</Text>
                    </View>
                ) : (
                    <View className="gap-3">
                        {incidents.map((incident) => (
                            <TouchableOpacity
                                key={incident.id}
                                onPress={() => router.push(`/impact/${incident.id}`)}
                            >
                                <Card className="flex-row justify-between items-center p-4">
                                    <View className="flex-row items-center gap-4">
                                        <View className={`w-12 h-12 rounded-full ${getSeverityBgColor(incident.severity)} items-center justify-center`}>
                                            <Activity
                                                size={24}
                                                color={incident.severity === 'CRITICAL' ? '#EF4444' : incident.severity === 'LOW' ? '#3B82F6' : '#F59E0B'}
                                            />
                                        </View>
                                        <View>
                                            <Text className="font-bold text-base">{incident.title}</Text>
                                            <Text className="text-xs" variant="muted">
                                                {formatDate(incident.timestamp)} • {incident.force}g Force
                                            </Text>
                                        </View>
                                    </View>
                                    <View className="items-end">
                                        <Text className={`${getSeverityColor(incident.severity)} font-bold text-xs mb-1`}>
                                            {incident.severity}
                                        </Text>
                                        <ChevronRight size={16} color="#9CA3AF" />
                                    </View>
                                </Card>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
