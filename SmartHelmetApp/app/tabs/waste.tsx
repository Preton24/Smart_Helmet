import { View, ScrollView, TouchableOpacity, Dimensions, Alert, Image, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { Text } from '../../components/Text';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';
import { Button } from '../../components/Button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, UploadCloud, ChevronRight, Calendar, Trash2, MapPin } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { wasteIncidents as INITIAL_INCIDENTS, WasteIncident } from '../../lib/mockData';
import { API_BASE } from '../../config/api';
import { GarbageMap } from '../../components/GarbageMap';
import { AlertDialog } from '../../components/AlertDialog';

const screenWidth = Dimensions.get('window').width;

export default function Waste() {
    const { colorScheme } = useColorScheme();
    const isDarkMode = colorScheme === 'dark';
    const router = useRouter();
    const [incidents, setIncidents] = useState<WasteIncident[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [isAlertVisible, setIsAlertVisible] = useState(false);
    const [alertConfig, setAlertConfig] = useState<{title: string, message: string, buttons?: any[]}>({ title: "", message: "" });

    useEffect(() => {
        loadIncidents();
    }, []);

    // Reload incidents when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            loadIncidents();
        }, [])
    );

    const loadIncidents = async () => {
        try {
            const stored = await AsyncStorage.getItem('wasteIncidents');
            if (stored) {
                const parsed = JSON.parse(stored);
                setIncidents(parsed);
            } else {
                // Initialize with default incidents
                await saveIncidents(INITIAL_INCIDENTS);
                setIncidents(INITIAL_INCIDENTS);
            }
        } catch (error) {
            console.error('Failed to load waste incidents:', error);
            setIncidents(INITIAL_INCIDENTS);
        } finally {
            setLoading(false);
        }
    };

    const saveIncidents = async (incidentsToSave: WasteIncident[]) => {
        try {
            await AsyncStorage.setItem('wasteIncidents', JSON.stringify(incidentsToSave));
        } catch (error) {
            console.error('Failed to save waste incidents:', error);
        }
    };

    const handleUpload = async () => {
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                setAlertConfig({
                    title: "Permission needed",
                    message: "Please allow media library access to select an image.",
                    buttons: [{ text: "OK" }]
                });
                setIsAlertVisible(true);
                return;
            }

            // Changed to Images for garbage detection
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: false,
                quality: 0.8,
            });

            if (result.canceled || !result.assets[0]) {
                return;
            }

            const imageAsset = result.assets[0];
            setUploading(true);

            // Create form data for API
            const formData = new FormData();
            
            if (Platform.OS === 'web') {
                // For web, we need to fetch the blob from the URI
                const response = await fetch(imageAsset.uri);
                const blob = await response.blob();
                formData.append('image', blob, `garbage_${Date.now()}.jpg`);
            } else {
                // For native (iOS/Android)
                formData.append('image', {
                    uri: imageAsset.uri,
                    type: 'image/jpeg',
                    name: `garbage_${Date.now()}.jpg`,
                } as any);
            }

            // Call garbage detection API
            const response = await fetch(`${API_BASE}/api/garbage-image-check`, {
                method: 'POST',
                body: formData,
                // No headers needed for FormData - fetch will set Content-Type with boundary automatically
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Garbage detection failed');
            }

            // Create incident from API response
            const newIncident: WasteIncident = {
                id: `waste-${Date.now()}`,
                type: data.garbage_detected ? 'Garbage Detected' : 'Clean Area',
                timestamp: new Date().toISOString(),
                severity: data.garbage_detected 
                    ? (data.confidence > 0.8 ? 'High' : data.confidence > 0.5 ? 'Medium' : 'Low')
                    : 'Low',
                location: 'Detected via Helmet Camera',
                thumbnail: imageAsset.uri, // Original image
                // Store API response data
                garbageDetected: data.garbage_detected,
                confidence: data.confidence,
                annotatedImageUrl: data.processed_image_path 
                    ? `${API_BASE}${data.processed_image_path.replace(/\\/g, '/')}`
                    : undefined,
            };

            const updatedIncidents = [newIncident, ...incidents];
            setIncidents(updatedIncidents);
            await saveIncidents(updatedIncidents);

            setUploading(false);
            
            // Navigate to the new incident detail
            router.push(`/waste/${newIncident.id}` as any);
        } catch (error: any) {
            console.error('Upload failed:', error);
            setUploading(false);
            setAlertConfig({
                title: "Error",
                message: error.message || 'Failed to analyze image. Please try again.',
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

        if (diffDays === 0) {
            return `Today, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
        } else if (diffDays === 1) {
            return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
    };


    return (
        <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black" edges={['top']}>
            {!showMap ? (
                <>
                    <Header title="Waste Management" />

                    <ScrollView
                        className="flex-1 px-4 py-4"
                        contentContainerStyle={{ paddingBottom: 20 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Upload Section */}
                        <Card className="mb-8 p-6 items-center border-dashed border-2 border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-neutral-900">
                            <View className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 items-center justify-center mb-4">
                                {uploading ? (
                                    <ActivityIndicator size="large" color="#10B981" />
                                ) : (
                                    <UploadCloud size={32} color="#10B981" />
                                )}
                            </View>
                            <Text className="text-lg font-bold mb-1">
                                {uploading ? 'Analyzing Image...' : 'Upload Waste Image'}
                            </Text>
                            <Text className="text-center text-sm mb-4" variant="muted">
                                {uploading 
                                    ? 'Detecting garbage in the image...'
                                    : 'Upload an image to detect garbage and waste.'}
                            </Text>
                            <Button
                                title={uploading ? 'Processing...' : 'Upload Image'}
                                onPress={handleUpload}
                                className="w-full"
                                disabled={uploading}
                            />
                        </Card>

                        {/* History List */}
                        <SectionTitle title="Recent Reports" />
                        {loading ? (
                            <View className="py-8 items-center">
                                <Text variant="muted">Loading reports...</Text>
                            </View>
                        ) : incidents.length === 0 ? (
                            <View className="py-8 items-center">
                                <Text variant="muted">No reports recorded yet</Text>
                            </View>
                        ) : (
                            <View className="gap-3">
                                {incidents.map((incident) => (
                                    <TouchableOpacity
                                        key={incident.id}
                                        onPress={() => router.push(`/waste/${incident.id}` as any)}
                                    >
                                        <Card className="flex-row items-center p-0 overflow-hidden mb-3 h-20 shadow-sm">
                                            <Image
                                                source={{ uri: incident.thumbnail }}
                                                style={{ width: 80, height: 80 }}
                                                className="w-20 h-20 bg-gray-200"
                                                resizeMode="cover"
                                            />
                                            <View className="flex-1 px-3 flex-row justify-between items-center">
                                                <View className="flex-1 mr-2">
                                                    <Text className="font-bold text-base" numberOfLines={1}>{incident.type}</Text>
                                                    <Text className="text-[10px]" variant="muted">
                                                        {formatDate(incident.timestamp)}
                                                    </Text>
                                                    <Text className="text-[10px] mt-0.5" variant="muted" numberOfLines={1}>
                                                        {incident.location}
                                                    </Text>
                                                </View>
                                                <View className="items-end">
                                                    <ChevronRight size={14} color="#9CA3AF" />
                                                </View>
                                            </View>
                                        </Card>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                        
                        {/* Reports Button */}
                        <Button 
                            onPress={() => setShowMap(true)}
                            className="mt-6 mb-10"
                        >
                            <MapPin size={20} color={isDarkMode ? 'black' : 'white'} className="mr-2" />
                            <Text className="text-white font-medium dark:text-black">Garbage Map</Text>
                        </Button>
                    </ScrollView>
                </>
            ) : (
                <GarbageMap onBack={() => setShowMap(false)} />
            )}
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
