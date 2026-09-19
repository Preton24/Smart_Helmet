import { View, ScrollView, TouchableOpacity, Alert, Linking, Share } from 'react-native';
import { Button } from '../../components/Button';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Text } from '../../components/Text';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';
import { ZoomableImage } from '../../components/ZoomableImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldAlert, ChevronLeft, Trash2, MapPin, Clock, Share2, CheckCircle, AlertTriangle } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import { WasteIncident, currentUser } from '../../lib/mockData';
import { sendReportEmail } from '../../lib/reportUtils';

export default function WasteIncidentDetail() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [incident, setIncident] = useState<WasteIncident | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadIncident();
    }, [id]);

    const loadIncident = async () => {
        try {
            const stored = await AsyncStorage.getItem('wasteIncidents');
            if (stored) {
                const incidents: WasteIncident[] = JSON.parse(stored);
                const found = incidents.find(inc => inc.id === id);
                if (found) {
                    setIncident(found);
                }
            }
        } catch (error) {
            console.error('Failed to load waste incident:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Record',
            'Are you sure you want to delete this waste report?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const stored = await AsyncStorage.getItem('wasteIncidents');
                            if (stored) {
                                const incidents: WasteIncident[] = JSON.parse(stored);
                                const filtered = incidents.filter(inc => inc.id !== id);
                                await AsyncStorage.setItem('wasteIncidents', JSON.stringify(filtered));
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

    const handleShare = async () => {
        if (!incident) return;
        await sendReportEmail('Garbage', incident, currentUser.name);
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top', 'bottom', 'left', 'right']}>
                <Stack.Screen options={{ headerShown: false }} />
                <Header title="Loading..." />
                <View className="flex-1 items-center justify-center">
                    <Text variant="muted">Loading report details...</Text>
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
                    <Text variant="muted">Report not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top', 'bottom', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />
            <Header
                title="Waste Report"
                leftContent={
                    <TouchableOpacity onPress={() => router.back()} className="p-1 rounded-full bg-gray-100 dark:bg-gray-800">
                        <ChevronLeft size={24} color="#6B7280" />
                    </TouchableOpacity>
                }
                rightContent={
                    <View className="flex-row gap-2">
                        <TouchableOpacity
                            onPress={handleDelete}
                            className="p-1 rounded-full bg-red-100 dark:bg-red-900/30"
                        >
                            <Trash2 size={20} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                }
            />

            <ScrollView
                className="flex-1 px-4 py-4"
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Detection Result Banner */}
                {incident.garbageDetected !== undefined && (
                    <Card className={`mb-4 p-4 flex-row items-center ${incident.garbageDetected ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                        {incident.garbageDetected ? (
                            <AlertTriangle size={24} color="#EF4444" />
                        ) : (
                            <CheckCircle size={24} color="#10B981" />
                        )}
                        <View className="ml-3 flex-1">
                            <Text className={`font-bold ${incident.garbageDetected ? 'text-red-600' : 'text-green-600'}`}>
                                {incident.garbageDetected ? 'Garbage Detected' : 'Area is Clean'}
                            </Text>
                            <Text className="text-xs" variant="muted">
                                Confidence: {((incident.confidence || 0) * 100).toFixed(1)}%
                            </Text>
                        </View>
                    </Card>
                )}

                {/* Evidence Snapshot with Zoom */}
                <SectionTitle title="Analyzed Image" className="mb-3" />
                <Card className="mb-6 p-0 overflow-hidden border-gray-200 dark:border-gray-800">
                    <ZoomableImage
                        source={{ uri: incident.annotatedImageUrl || incident.thumbnail }}
                        thumbnailHeight={256}
                    />
                </Card>

                {/* Incident Details */}
                <SectionTitle title="Report Details" className="mb-3" />
                <View className="flex-row flex-wrap gap-3 mb-6">
                    <Card className="w-[48%] py-4 items-center">
                        {incident.garbageDetected ? (
                            <AlertTriangle size={24} color="#EF4444" className="mb-2" />
                        ) : (
                            <CheckCircle size={24} color="#10B981" className="mb-2" />
                        )}
                        <Text className="text-lg font-bold text-center">{incident.type}</Text>
                        <Text className="text-xs font-medium" variant="muted">Detection Result</Text>
                    </Card>

                    <Card className="w-[48%] py-4 items-center">
                        <Clock size={24} color="#6366F1" className="mb-2" />
                        <Text className="text-sm font-bold text-center">
                            {new Date(incident.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text className="text-xs font-medium" variant="muted">Time Analyzed</Text>
                    </Card>

                    <Card className="w-full py-4 items-center px-4 flex-row gap-4">
                        <MapPin size={24} color="#10B981" />
                        <View className="flex-1">
                            <Text className="text-sm font-bold" numberOfLines={2}>{incident.location}</Text>
                            <Text className="text-xs font-medium" variant="muted">Location</Text>
                        </View>
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
