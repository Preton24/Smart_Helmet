import { View, ScrollView, TouchableOpacity, Alert, Image, Share } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Text } from '../../components/Text';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';
import { Button } from '../../components/Button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, MapPin, Clock, Calendar, ChevronLeft, Trash2, Share2, PlayCircle } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { PotholeIncident, currentUser } from '../../lib/mockData';
import { sendReportEmail } from '../../lib/reportUtils';

const VIDEO_MAP: Record<string, any> = {
    'video1': require('../../assets/videos/video1_impact.mp4'),
    'video2': require('../../assets/videos/video2_impact.mp4'),
    'video3': require('../../assets/videos/video3_impact.mp4'),
    'video4_pothole': require('../../assets/videos/video4_pothole.mp4'),
};

const IMAGE_MAP: Record<string, any> = {
    'pothole1': require('../../assets/images/pothole1.jpeg'),
};

export default function PotholeDetail() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [incident, setIncident] = useState<PotholeIncident | null>(null);
    const [loading, setLoading] = useState(true);
    const [videoRef, setVideoRef] = useState<Video | null>(null);
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);

    useEffect(() => {
        loadIncident();
    }, [id]);

    const loadIncident = async () => {
        try {
            const stored = await AsyncStorage.getItem('potholeIncidents');
            if (stored) {
                const incidents: PotholeIncident[] = JSON.parse(stored);
                const found = incidents.find(inc => inc.id === id);
                if (found) setIncident(found);
            }
        } catch (error) {
            console.error('Failed to load pothole incident:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = () => {
        Alert.alert('Delete Record', 'Are you sure you want to delete this pothole report?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const stored = await AsyncStorage.getItem('potholeIncidents');
                        if (stored) {
                            const incidents: PotholeIncident[] = JSON.parse(stored);
                            const filtered = incidents.filter(inc => inc.id !== id);
                            await AsyncStorage.setItem('potholeIncidents', JSON.stringify(filtered));
                            router.back();
                        }
                    } catch (error) {
                        console.error('Failed to delete incident:', error);
                    }
                },
            },
        ]);
    };

    const handleShare = async () => {
        if (!incident) return;
        await sendReportEmail('Pothole', incident, currentUser.name);
    };

    const handlePlayVideo = async () => {
        if (!videoRef || !incident) return;
        try {
            videoRef.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
                if (status.isLoaded && status.didJustFinish) setIsVideoPlaying(false);
            });
            await videoRef.presentFullscreenPlayer();
            setIsVideoPlaying(true);
        } catch (error) {
            console.error('Error playing video:', error);
        }
    };

    if (loading || !incident) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-black">
                <Stack.Screen options={{ headerShown: false }} />
                <Header title={loading ? "Loading..." : "Not Found"} />
                <View className="flex-1 items-center justify-center">
                    <Text variant="muted">{loading ? "Loading details..." : "Incident not found"}</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top', 'bottom', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />
            <Header
                title="Pothole Analysis"
                leftContent={
                    <TouchableOpacity onPress={() => router.back()} className="p-1 rounded-full bg-gray-100 dark:bg-gray-800">
                        <ChevronLeft size={24} color="#6B7280" />
                    </TouchableOpacity>
                }
                rightContent={
                    <TouchableOpacity onPress={handleDelete} className="p-1 rounded-full bg-red-100 dark:bg-red-900/30">
                        <Trash2 size={20} color="#EF4444" />
                    </TouchableOpacity>
                }
            />

            <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                {/* Video Playback */}
                <Card className="mb-6 p-0 overflow-hidden bg-black justify-center items-center relative" style={{ height: 350 }}>
                    <Video
                        ref={(ref) => setVideoRef(ref)}
                        source={VIDEO_MAP[incident.videoPath] || VIDEO_MAP['video1']}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode={ResizeMode.CONTAIN}
                        useNativeControls={false}
                        shouldPlay={false}
                    />
                    <TouchableOpacity onPress={handlePlayVideo} className="absolute z-10 items-center">
                        <View className="bg-black/50 rounded-full p-3">
                            <PlayCircle size={48} color="white" />
                        </View>
                        <Text className="text-white font-medium mt-2">View Detection Clip</Text>
                    </TouchableOpacity>
                </Card>

                {/* Evidence Snapshot */}
                <SectionTitle title="Evidence Snapshot" className="mb-3" />
                <Card className="mb-6 p-0 overflow-hidden border-gray-200 dark:border-gray-800" style={{ height: 350, backgroundColor: '#f3f4f6' }}>
                    <Image
                        source={IMAGE_MAP[incident.thumbnail] || { uri: incident.thumbnail }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="contain"
                    />
                </Card>

                {/* Incident Details */}
                <SectionTitle title="Hazard Details" className="mb-3" />
                <View className="flex-row flex-wrap gap-3 mb-6">
                    <Card className="w-full p-4 flex-row items-center gap-4">
                        <View className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 items-center justify-center">
                            <MapPin size={24} color="#3B82F6" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-xs font-medium" variant="muted">Street Location</Text>
                            <Text className="text-lg font-bold">{incident.location}</Text>
                        </View>
                    </Card>

                    <Card className="w-[48%] py-4 items-center">
                        <Calendar size={24} color="#6366F1" className="mb-2" />
                        <Text className="text-base font-bold text-center">{new Date(incident.timestamp).toLocaleDateString()}</Text>
                        <Text className="text-xs font-medium" variant="muted">Date Detected</Text>
                    </Card>

                    <Card className="w-[48%] py-4 items-center">
                        <Clock size={24} color="#10B981" className="mb-2" />
                        <Text className="text-base font-bold text-center">{new Date(incident.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                        <Text className="text-xs font-medium" variant="muted">Time Detected</Text>
                    </Card>
                </View>

                {/* Risk Level Card */}
                <Card className={`p-4 items-center flex-row justify-between mb-6 ${incident.riskLevel === 'High' ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/50' :
                    incident.riskLevel === 'Medium' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-900/50' :
                        'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/50'
                    }`}>
                    <View className="flex-row items-center gap-3">
                        <AlertTriangle size={24} color={
                            incident.riskLevel === 'High' ? '#EF4444' :
                                incident.riskLevel === 'Medium' ? '#F59E0B' : '#3B82F6'
                        } />
                        <View>
                            <Text className="font-bold">Risk Level</Text>
                            <Text className="text-xs" variant="muted">Road safety analysis</Text>
                        </View>
                    </View>
                    <Text className={`font-bold ${incident.riskLevel === 'High' ? 'text-red-600' :
                        incident.riskLevel === 'Medium' ? 'text-yellow-600' : 'text-blue-600'
                        }`}>
                        {incident.riskLevel.toUpperCase()}
                    </Text>
                </Card>

                {/* Share Report */}
                <Button onPress={handleShare} variant="outline" className="mt-2 bg-white border-gray-200">
                    <Share2 size={20} color="#000000" />
                    <Text className="text-black dark:text-black font-medium ml-2">Share Report</Text>
                </Button>
            </ScrollView>
        </SafeAreaView>
    );
}
