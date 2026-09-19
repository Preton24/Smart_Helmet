import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Text } from '../../components/Text';
import { Navigation, Share2, ArrowLeft } from 'lucide-react-native';
import { AddFamilyMemberModal } from '../../components/AddFamilyMemberModal';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { locationData } from '../../lib/mockData';
import { useUser } from '../../context/UserContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { LocationMap } from '../../components/LocationMap';
import { useRouter, useFocusEffect } from 'expo-router';
import { backendAddress } from '@/constants/values';
import axios from 'axios';
import { useCallback } from 'react';

export default function Location() {
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const [region, setRegion] = useState({
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
    });

    const { familyMembers, addFamilyMember } = useUser();
    const [isAddFamilyVisible, setIsAddFamilyVisible] = useState(false);
    const [isViewingMyLocation, setIsViewingMyLocation] = useState(true);
    const [speed, setSpeed] = useState<string>("0");

    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            const fetchSpeed = async () => {
                if (!isActive) return;
                try {
                    const response = await axios.get(`http://${backendAddress}:3000/speed`);
                    if (isActive) setSpeed(response.data.toString());
                } catch (err) { }
            };

            fetchSpeed();
            const interval = setInterval(fetchSpeed, 2000);

            return () => {
                isActive = false;
                clearInterval(interval);
            };
        }, [])
    );

    const focusLocation = (lat: number, lng: number) => {
        setRegion({
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        });
        setIsViewingMyLocation(false);
    };

    const focusMyLocation = () => {
        setRegion({
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        });
        setIsViewingMyLocation(true);
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black" edges={['top']}>
            <Header
                title="Location"
                leftContent={
                    <TouchableOpacity
                        onPress={() => router.push('/tabs/dashboard')}
                        activeOpacity={0.7}
                        className="p-1 -ml-2"
                    >
                        <ArrowLeft size={24} color={isDark ? "#ffffff" : "#000000"} />
                    </TouchableOpacity>
                }
            />
            <View className="flex-1 relative">
                <LocationMap
                    region={region}
                    setRegion={setRegion}
                    familyMembers={familyMembers}
                />

                {/* Overlay Stats */}
                <View className="absolute top-4 left-4 right-4 flex-row justify-between">
                    <View className="bg-white/90 dark:bg-gray-900/90 p-3 rounded-2xl shadow-md shadow-black/10 elevation-3 backdrop-blur-md">
                        <View className="flex-row items-center gap-2">
                            <Navigation size={20} color="#4F46E5" />
                            <View>
                                <Text className="text-xs" variant="muted">Speed</Text>
                                <Text className="text-lg font-bold">{speed} m/s</Text>
                            </View>
                        </View>
                    </View>
                    <View className="bg-white/90 dark:bg-gray-900/90 p-3 rounded-2xl shadow-md shadow-black/10 elevation-3 backdrop-blur-md">
                        <View className="flex-row items-center gap-2">
                            <Share2 size={20} color="#4F46E5" />
                            <View>
                                <Text className="text-xs" variant="muted">Share</Text>
                                <Text className="text-lg font-bold">Live</Text>
                            </View>
                        </View>
                    </View>
                </View>



                {/* Back Button - Shows when viewing family member's location */}
                {!isViewingMyLocation && (
                    <View className="absolute top-20 left-4">
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={focusMyLocation}
                            className="bg-white/90 dark:bg-gray-900/90 p-3 rounded-full shadow-md shadow-black/10 elevation-3 backdrop-blur-md"
                        >
                            <ArrowLeft size={20} color="#4F46E5" />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Family Members List */}
                <View className="absolute bottom-8 left-0 right-0">
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                    >
                        {/* Add Member Button */}
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setIsAddFamilyVisible(true)}
                        >
                            <Card className="w-36 p-3 items-center justify-center h-full border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80">
                                <View className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 items-center justify-center mb-2">
                                    <Text className="text-2xl font-light" variant="muted">+</Text>
                                </View>
                                <Text className="font-medium" variant="muted">Add Member</Text>
                            </Card>
                        </TouchableOpacity>

                        {familyMembers.map((member) => (
                            <TouchableOpacity
                                key={member.id}
                                onPress={() => focusLocation(member.location.lat, member.location.lng)}
                                activeOpacity={0.8}
                            >
                                <Card className="w-36 p-3 items-center">
                                    <View className="relative">
                                        <View className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 items-center justify-center mb-2">
                                            <Text className="text-xl font-bold" variant="muted">{member.name[0]}</Text>
                                        </View>
                                        <View className={cn(
                                            "absolute bottom-2 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-800",
                                            member.status === 'Driving' ? "bg-green-500" :
                                                member.status === 'Not Driving' ? "bg-blue-500" : "bg-gray-400"
                                        )} />
                                    </View>
                                    <Text className="font-semibold">{member.name}</Text>
                                    <Text className="text-xs mb-1" variant="muted">{member.status}</Text>
                                    <View className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full mt-1">
                                        <Text className="text-[10px] font-bold" variant="muted">
                                            0 km/h
                                        </Text>
                                    </View>
                                </Card>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>

            <AddFamilyMemberModal
                visible={isAddFamilyVisible}
                onClose={() => setIsAddFamilyVisible(false)}
                onAdd={(member) => {
                    addFamilyMember({
                        ...member,
                        location: {
                            lat: locationData.latitude + (Math.random() - 0.5) * 0.01,
                            lng: locationData.longitude + (Math.random() - 0.5) * 0.01
                        }
                    });
                }}
            />
        </SafeAreaView>
    );
}
