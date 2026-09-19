import { View, ScrollView, TouchableOpacity, Alert, Linking, Share } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Text } from '../../components/Text';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';
import { Button } from '../../components/Button';
import { ZoomableImage } from '../../components/ZoomableImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, ShieldAlert, PlayCircle, ChevronLeft, Trash2, MapPin, Clock, CreditCard, Share2, Video as VideoIcon } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { TrafficIncident, currentUser } from '../../lib/mockData';
import { sendReportEmail } from '../../lib/reportUtils';
import { API_BASE } from '../../config/api';

const VIDEO_MAP: Record<string, any> = {
    'video1': require('../../assets/videos/video1_impact.mp4'),
    'video2': require('../../assets/videos/video2_impact.mp4'),
    'video3': require('../../assets/videos/video3_impact.mp4'),
    'video5.mp4': require('../../assets/videos/video5_violation.mp4'),
    'video6.mp4': require('../../assets/videos/video6_violation.mp4'),
};

export default function TrafficIncidentDetail() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [incident, setIncident] = useState<TrafficIncident | null>(null);
    const [loading, setLoading] = useState(true);
    const [videoRef, setVideoRef] = useState<Video | null>(null);
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);

    useEffect(() => {
        loadIncident();
    }, [id]);

    const loadIncident = async () => {
        try {
            const stored = await AsyncStorage.getItem('trafficIncidents');
            if (stored) {
                const incidents: TrafficIncident[] = JSON.parse(stored);
                const found = incidents.find(inc => inc.id === id);
                if (found) {
                    setIncident(found);
                }
            }
        } catch (error) {
            console.error('Failed to load traffic incident:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Record',
            'Are you sure you want to delete this traffic violation record?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const stored = await AsyncStorage.getItem('trafficIncidents');
                            if (stored) {
                                const incidents: TrafficIncident[] = JSON.parse(stored);
                                const filtered = incidents.filter(inc => inc.id !== id);
                                await AsyncStorage.setItem('trafficIncidents', JSON.stringify(filtered));
                                router.back();
                            }
                        } catch (error) {
                            console.error('Failed to delete incident:', error);
                            Alert.alert('Error', 'Failed to delete record.');
                        }
                    },
                },
            ]
        );
    };

    const handlePlayVideo = async () => {
        if (!videoRef || !incident) return;

        try {
            // Reset video to start first
            await videoRef.setPositionAsync(0);

            // Set up playback status listener to detect when video stops or finishes
            videoRef.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
                if (status.isLoaded) {
                    // When video finishes or is paused/stopped, reset the play button
                    if (status.didJustFinish) {
                        setIsVideoPlaying(false);
                        videoRef.setPositionAsync(0); // Reset to start for replay
                    } else if (!status.isPlaying && status.positionMillis > 0) {
                        // Video paused or fullscreen dismissed
                        setIsVideoPlaying(false);
                    }
                }
            });

            // Start playing and go fullscreen
            await videoRef.playAsync();
            await videoRef.presentFullscreenPlayer();
            setIsVideoPlaying(true);
        } catch (error) {
            console.error('Error playing video:', error);
            Alert.alert('Error', 'Failed to play video.');
            setIsVideoPlaying(false);
        }
    };

    const handleShare = async () => {
        if (!incident) return;
        await sendReportEmail('Traffic', incident, currentUser.name);
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

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top', 'bottom', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />
            <Header
                title="Violation Report"
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
                {/* Video Playback - Annotated Video with Play Button */}
                <SectionTitle title="Violation Video" className="mb-3" />
                <Card className="mb-6 p-0 overflow-hidden bg-black justify-center items-center relative" style={{ height: 350 }}>
                    {incident.annotatedVideoUrl ? (
                        // Use annotated video from API with play button overlay
                        <>
                            <Video
                                ref={(ref) => setVideoRef(ref)}
                                source={{ uri: incident.annotatedVideoUrl }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode={ResizeMode.CONTAIN}
                                useNativeControls={true}
                                shouldPlay={false}
                                posterSource={{ uri: incident.bestFrameUrl || incident.thumbnail }}
                                usePoster={true}
                            />
                            {!isVideoPlaying && (
                                <TouchableOpacity
                                    onPress={handlePlayVideo}
                                    className="absolute z-10 items-center"
                                    activeOpacity={0.8}
                                >
                                    <View className="bg-black/60 rounded-full p-4">
                                        <PlayCircle size={52} color="white" />
                                    </View>
                                    <Text className="text-white font-bold mt-2 text-base">Play Annotated Video</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    ) : VIDEO_MAP[incident.videoPath] ? (
                        // Fallback to bundled video
                        <>
                            <Video
                                ref={(ref) => setVideoRef(ref)}
                                source={VIDEO_MAP[incident.videoPath]}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode={ResizeMode.CONTAIN}
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
                                <Text className="text-white font-medium mt-2">Watch Violation Clip</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        // No video available
                        <View className="items-center justify-center">
                            <VideoIcon size={48} color="#6B7280" />
                            <Text className="text-gray-400 mt-2">No video available</Text>
                        </View>
                    )}
                </Card>

                {/* Evidence Snapshot */}
                <SectionTitle title="Evidence Snapshot" className="mb-3" />
                <Card className="mb-6 p-0 overflow-hidden border-gray-200 dark:border-gray-800" style={{ height: 350, backgroundColor: '#111' }}>
                    {VIDEO_MAP[incident.videoPath] ? (
                        // Demo incident: show first frame of the violation video as snapshot
                        <Video
                            source={VIDEO_MAP[incident.videoPath]}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode={ResizeMode.CONTAIN}
                            shouldPlay={false}
                            useNativeControls={false}
                            isMuted={true}
                            positionMillis={0}
                        />
                    ) : (
                        // API incident: use best frame or thumbnail
                        <ZoomableImage
                            source={{ uri: incident.bestFrameUrl || incident.thumbnail }}
                            thumbnailHeight={350}
                        />
                    )}
                </Card>

                {/* Violation Details */}
                <SectionTitle title="Incident Details" className="mb-3" />
                <View className="flex-row flex-wrap gap-3 mb-6">
                    <Card className="w-[48%] py-4 items-center">
                        <ShieldAlert size={24} color="#EF4444" className="mb-2" />
                        <Text className="text-lg font-bold text-center">{incident.type}</Text>
                        <Text className="text-xs font-medium" variant="muted">Violation Type</Text>
                    </Card>

                    <Card className="w-[48%] py-4 items-center">
                        <CreditCard size={24} color="#3B82F6" className="mb-2" />
                        <Text className="text-lg font-bold">MH14GE9533</Text>
                        <Text className="text-xs font-medium" variant="muted">Number Plate</Text>
                    </Card>

                    <Card className="w-[48%] py-4 items-center">
                        <Clock size={24} color="#6366F1" className="mb-2" />
                        <Text className="text-sm font-bold text-center">
                            {new Date(incident.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text className="text-xs font-medium" variant="muted">Time Detected</Text>
                    </Card>

                    <Card className="w-[48%] py-4 items-center px-2">
                        <MapPin size={24} color="#10B981" className="mb-2" />
                        <Text className="text-xs font-bold text-center" numberOfLines={2}>{incident.location}</Text>
                        <Text className="text-xs font-medium" variant="muted">Location</Text>
                    </Card>
                </View>

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
