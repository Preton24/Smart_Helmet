import { View, ScrollView, TouchableOpacity, Dimensions, Alert, Image, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Text } from '../../components/Text';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';
import { Button } from '../../components/Button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UploadCloud, ChevronRight, AlertTriangle } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { potholeIncidents as INITIAL_INCIDENTS, PotholeIncident } from '../../lib/mockData';
import { AlertDialog } from '../../components/AlertDialog';

const screenWidth = Dimensions.get('window').width;

const IMAGE_MAP: Record<string, any> = {
    'pothole1': require('../../assets/images/pothole1.jpeg'),
};

export default function Potholes() {
    const router = useRouter();
    const [incidents, setIncidents] = useState<PotholeIncident[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isAlertVisible, setIsAlertVisible] = useState(false);
    const [alertConfig, setAlertConfig] = useState<{title: string, message: string, buttons?: any[]}>({ title: "", message: "" });

    useEffect(() => {
        loadIncidents();
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadIncidents();
        }, [])
    );

    const loadIncidents = async () => {
        try {
            const stored = await AsyncStorage.getItem('potholeIncidents');
            if (stored) {
                setIncidents(JSON.parse(stored));
            } else {
                await saveIncidents(INITIAL_INCIDENTS);
                setIncidents(INITIAL_INCIDENTS);
            }
        } catch (error) {
            console.error('Failed to load pothole incidents:', error);
            setIncidents(INITIAL_INCIDENTS);
        } finally {
            setLoading(false);
        }
    };

    const saveIncidents = async (incidentsToSave: PotholeIncident[]) => {
        try {
            await AsyncStorage.setItem('potholeIncidents', JSON.stringify(incidentsToSave));
        } catch (error) {
            console.error('Failed to save pothole incidents:', error);
        }
    };

    const handleUpload = async () => {
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                setAlertConfig({
                    title: "Permission needed",
                    message: "Please allow media library access to select a video.",
                    buttons: [{ text: "OK" }]
                });
                setIsAlertVisible(true);
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsMultipleSelection: false,
                quality: 1,
            });

            if (result.canceled) return;

            setIsAnalyzing(true);

            const newIncident: PotholeIncident = {
                id: `pot-${Date.now()}`,
                location: 'Uploaded Location, Near Outer Ring Road',
                timestamp: new Date().toISOString(),
                riskLevel: 'Medium',
                thumbnail: 'pothole1',
                videoPath: 'video4_pothole'
            };

            const updatedIncidents = [newIncident, ...incidents];
            setIncidents(updatedIncidents);
            await saveIncidents(updatedIncidents);

            // Navigate after 10 seconds
            setTimeout(() => {
                setIsAnalyzing(false);
                router.push(`/potholes/${newIncident.id}` as any);
            }, 10000);
        } catch (error) {
            console.error('Upload failed:', error);
            setIsAnalyzing(false);
            setAlertConfig({
                title: "Error",
                message: 'Failed to add the selected video.',
                buttons: [{ text: "OK" }]
            });
            setIsAlertVisible(true);
        }
    };

    const formatDate = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        if (diffDays === 1) return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const getRiskColor = (risk: string) => {
        switch (risk.toLowerCase()) {
            case 'high': return 'text-red-500';
            case 'medium': return 'text-yellow-500';
            case 'low': return 'text-blue-500';
            default: return 'text-gray-500';
        }
    };

    const getRiskBgColor = (risk: string) => {
        switch (risk.toLowerCase()) {
            case 'high': return 'bg-red-100 dark:bg-red-900/30';
            case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/30';
            case 'low': return 'bg-blue-100 dark:bg-blue-900/30';
            default: return 'bg-gray-100 dark:bg-gray-900/30';
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black" edges={['top']}>
            <Header title="Pothole Detection" />

            <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
                <Card className="mb-8 p-6 items-center border-dashed border-2 border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-neutral-900">
                    <View className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 items-center justify-center mb-4">
                        {isAnalyzing ? (
                            <ActivityIndicator size="large" color="#3B82F6" />
                        ) : (
                            <UploadCloud size={32} color="#3B82F6" />
                        )}
                    </View>
                    <Text className="text-lg font-bold mb-1">
                        {isAnalyzing ? 'Analyzing Road Hazards...' : 'Upload Road Data'}
                    </Text>
                    <Text className="text-center text-sm mb-4" variant="muted">
                        {isAnalyzing
                            ? 'Scanning footage for potholes and cracks...'
                            : 'Sync helmet footage to detect road hazards and potholes.'}
                    </Text>
                    <Button
                        title={isAnalyzing ? 'Analyzing...' : 'Upload New Data'}
                        onPress={handleUpload}
                        className="w-full"
                        disabled={isAnalyzing}
                    />
                </Card>

                <SectionTitle title="Recent Reports" />
                {loading ? (
                    <View className="py-8 items-center"><Text variant="muted">Loading reports...</Text></View>
                ) : incidents.length === 0 ? (
                    <View className="py-8 items-center"><Text variant="muted">No potholes detected yet</Text></View>
                ) : (
                    <View className="gap-3">
                        {incidents.map((incident) => (
                            <TouchableOpacity key={incident.id} onPress={() => router.push(`/potholes/${incident.id}` as any)}>
                                <Card className="flex-row items-center p-0 overflow-hidden mb-3 h-20 shadow-sm">
                                    <Image
                                        source={IMAGE_MAP[incident.thumbnail] || { uri: incident.thumbnail }}
                                        style={{ width: 80, height: 80 }}
                                        className="w-20 h-20 bg-gray-200"
                                        resizeMode="cover"
                                    />
                                    <View className="flex-1 px-3 flex-row justify-between items-center">
                                        <View className="flex-1 mr-2">
                                            <Text className="font-bold text-base" numberOfLines={1}>Pothole Alert</Text>
                                            <View className="flex-row items-center gap-2">
                                                <Text className="text-[10px]" variant="muted">{formatDate(incident.timestamp)}</Text>
                                            </View>
                                            <Text className="text-[10px] mt-0.5" variant="muted" numberOfLines={1}>
                                                {incident.location}
                                            </Text>
                                        </View>
                                        <View className="items-end">
                                            <Text className={`${getRiskColor(incident.riskLevel)} font-bold text-[10px] mb-1`}>
                                                {incident.riskLevel.toUpperCase()}
                                            </Text>
                                            <ChevronRight size={14} color="#9CA3AF" />
                                        </View>
                                    </View>
                                </Card>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>
            <AlertDialog
                visible={isAlertVisible}
                onClose={() => setIsAlertVisible(false)}
                title={alertConfig.title}
                message={alertConfig.message}
                buttons={alertConfig.buttons}
            />
        </SafeAreaView>
    );
}
