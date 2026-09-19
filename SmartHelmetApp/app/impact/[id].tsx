import { View, ScrollView, TouchableOpacity, Alert, Share } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Text } from '../../components/Text';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';
import { Button } from '../../components/Button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Activity, AlertTriangle, ShieldAlert, TrendingUp, PlayCircle, ChevronLeft, Trash2, Share2 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

interface ImpactIncident {
    id: string;
    title: string;
    timestamp: string;
    force: number;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    videoPath: string; // Stored as 'video1' or 'video2'
    forceScore?: number;
    injuryProb?: string;
    fallDirection?: string;
    tiltAngle?: number;
    history?: Array<{ time: string; force: number }>;
}

const VIDEO_MAP: Record<string, any> = {
    'video1': require('../../assets/videos/video1_impact.mp4'),
    'video2': require('../../assets/videos/video2_impact.mp4'),
    'video3': require('../../assets/videos/video3_impact.mp4'),
};

export default function ImpactAnalysisDetail() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [incident, setIncident] = useState<ImpactIncident | null>(null);
    const [loading, setLoading] = useState(true);
    const [videoRef, setVideoRef] = useState<Video | null>(null);
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);

    useEffect(() => {
        loadIncident();
    }, [id]);

    const loadIncident = async () => {
        try {
            const stored = await AsyncStorage.getItem('impactIncidents');
            if (stored) {
                const incidents: ImpactIncident[] = JSON.parse(stored);
                const found = incidents.find(inc => inc.id === id);
                if (found) {
                    setIncident(found);
                }
            }
        } catch (error) {
            console.error('Failed to load incident:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Incident',
            'Are you sure you want to delete this incident? This action cannot be undone.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const stored = await AsyncStorage.getItem('impactIncidents');
                            if (stored) {
                                const incidents: ImpactIncident[] = JSON.parse(stored);
                                const filtered = incidents.filter(inc => inc.id !== id);
                                await AsyncStorage.setItem('impactIncidents', JSON.stringify(filtered));
                                router.back();
                            }
                        } catch (error) {
                            console.error('Failed to delete incident:', error);
                            Alert.alert('Error', 'Failed to delete incident. Please try again.');
                        }
                    },
                },
            ]
        );
    };

    const handleShare = async () => {
        if (!incident) return;
        try {
            const subject = `Impact Analysis Report #${id}`;
            const message = `Impact Analysis Report:\n\nImpact Force: ${incident.forceScore || incident.force}g\nInjury Probability: ${incident.injuryProb || 'N/A'}\nFall Direction: ${incident.fallDirection || 'N/A'}\nTilt Angle: ${incident.tiltAngle || 0}°\nTime: ${new Date(incident.timestamp).toLocaleString()}`;

            await Share.share({
                message: message,
                title: subject,
            });
        } catch (error) {
            console.error('Error sharing report:', error);
            Alert.alert('Error', 'Failed to share report.');
        }
    };

    const handlePlayVideo = async () => {
        if (!videoRef || !incident) return;

        try {
            videoRef.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
                if (status.isLoaded && status.didJustFinish) {
                    setIsVideoPlaying(false);
                }
            });

            await videoRef.presentFullscreenPlayer();
            setIsVideoPlaying(true);
        } catch (error) {
            console.error('Error playing video:', error);
            Alert.alert('Error', 'Failed to play video.');
        }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top', 'bottom', 'left', 'right']}>
                <Stack.Screen options={{ headerShown: false }} />
                <Header title="Loading..." />
                <View className="flex-1 items-center justify-center">
                    <Text variant="muted">Loading incident details...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!incident) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top', 'bottom', 'left', 'right']}>
                <Stack.Screen options={{ headerShown: false }} />
                <Header title="Not Found" />
                <View className="flex-1 items-center justify-center">
                    <Text variant="muted">Incident not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    const chartData = (incident.history || []).map((item) => ({ value: item.force, label: item.time }));

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top', 'bottom', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />
            <Header
                title={`Impact Analysis #${id}`}
                leftContent={
                    <TouchableOpacity onPress={() => router.back()} className="p-1 rounded-full bg-gray-100 dark:bg-gray-800">
                        <ChevronLeft size={24} color="#6B7280" />
                    </TouchableOpacity>
                }
                rightContent={
                    <TouchableOpacity
                        onPress={handleDelete}
                        className="p-1 rounded-full bg-red-100 dark:bg-red-900/30"
                    >
                        <Trash2 size={20} color="#EF4444" />
                    </TouchableOpacity>
                }
            />

            <ScrollView
                className="flex-1 px-4 py-4"
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Video Playback */}
                <SectionTitle title="Impact Video" className="mb-3" />
                <Card className="mb-6 p-0 overflow-hidden h-56 bg-black justify-center items-center relative">
                    <Video
                        ref={(ref) => setVideoRef(ref)}
                        source={VIDEO_MAP[incident.videoPath] || VIDEO_MAP['video1']}
                        className="w-full h-full"
                        resizeMode={ResizeMode.COVER}
                        useNativeControls={false}
                        shouldPlay={false}
                    />
                    <TouchableOpacity
                        onPress={handlePlayVideo}
                        className="absolute z-10 items-center"
                        activeOpacity={0.8}
                    >
                        <View className="bg-black/50 rounded-full p-3">
                            <PlayCircle size={48} color="white" />
                        </View>
                        <Text className="text-white font-medium mt-2">Replay Impact Video</Text>
                    </TouchableOpacity>
                </Card>

                {/* Evidence Snapshot */}
                <SectionTitle title="Evidence Snapshot" className="mb-3" />
                <Card className="mb-6 p-0 overflow-hidden border-gray-200 dark:border-gray-800" style={{ height: 220, backgroundColor: '#111' }}>
                    <Video
                        source={VIDEO_MAP[incident.videoPath] || VIDEO_MAP['video1']}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={false}
                        useNativeControls={false}
                        isMuted={true}
                        positionMillis={0}
                    />
                </Card>

                {/* Summary Cards */}
                <View className="flex-row flex-wrap gap-3 mb-6">
                    <Card className="w-[48%] py-4 items-center border-red-100 bg-red-50/50 dark:border-red-900/50 dark:bg-red-900/20">
                        <Activity size={24} color="#EF4444" className="mb-2" />
                        <Text className="text-3xl font-bold">{incident.forceScore || incident.force}</Text>
                        <Text className="text-xs font-medium" variant="destructive">Impact Force</Text>
                    </Card>

                    <Card className="w-[48%] py-4 items-center">
                        <ShieldAlert size={24} color="#F59E0B" className="mb-2" />
                        <Text className="text-xl font-bold">{incident.injuryProb || 'N/A'}</Text>
                        <Text className="text-xs font-medium" variant="muted">Injury Prob.</Text>
                    </Card>

                    <Card className="w-[48%] py-4 items-center">
                        <AlertTriangle size={24} color="#6366F1" className="mb-2" />
                        <Text className="text-lg font-bold">{incident.fallDirection || 'N/A'}</Text>
                        <Text className="text-xs font-medium" variant="muted">Fall Direction</Text>
                    </Card>

                    <Card className="w-[48%] py-4 items-center">
                        <TrendingUp size={24} color="#10B981" className="mb-2" />
                        <Text className="text-2xl font-bold">{incident.tiltAngle || 0}°</Text>
                        <Text className="text-xs font-medium" variant="muted">Tilt Angle</Text>
                    </Card>
                </View>

                {/* Chart Visual */}
                <Card className="mb-6 p-4 pb-8">
                    <SectionTitle title="Impact Force Timeline" className="mb-6" />
                    <View className="h-48 flex-row items-end justify-between px-2">
                        {chartData.map((item, index) => (
                            <View key={index} className="items-center gap-2">
                                <View
                                    className="w-8 rounded-t-sm bg-red-400 opacity-80"
                                    style={{ height: `${Math.min((item.value / 10) * 100, 100)}%` }}
                                />
                                <Text className="text-[10px]" variant="muted">{item.label}</Text>
                            </View>
                        ))}
                    </View>
                </Card>

                {/* Share Report */}
                <Button
                    onPress={handleShare}
                    variant="outline"
                    className="mt-2 bg-white border-gray-200"
                >
                    <Share2 size={20} color="#000000" />
                    <Text className="text-black dark:text-black font-medium ml-2">Share Report</Text>
                </Button>
            </ScrollView>
        </SafeAreaView>
    );
}
