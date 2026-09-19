import { View, Text, ScrollView, Image } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { SectionTitle } from '../../components/SectionTitle';
import { incidents } from '../../lib/mockData';
import { Share2, Clock, MapPin } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function IncidentDetails() {
    const { id } = useLocalSearchParams();
    // Mock finding incident, or default to first
    const incident = incidents.find(i => i.id.toString() === id) || incidents[0];

    return (
        <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />
            <Header
                title="Incident Report"
                rightContent={<Button variant="ghost" size="icon"><Share2 size={24} color="black" /></Button>}
            />

            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 50 }}>
                {/* Media Preview */}
                <View className="w-full h-64 bg-black relative">
                    <Image
                        source={{ uri: incident.thumbnail }}
                        className="w-full h-full opacity-80"
                        resizeMode="cover"
                    />
                    <View className="absolute bottom-4 left-4 right-4 flex-row justify-between items-end">
                        <View>
                            <Text className="text-white font-bold text-xl">Recorded Clip</Text>
                            <Text className="text-gray-300 text-sm">00:14s Duration</Text>
                        </View>
                        <View className="bg-red-500 px-3 py-1 rounded-full">
                            <Text className="text-white font-bold text-xs">{incident.severity} Impact</Text>
                        </View>
                    </View>
                </View>

                <View className="p-4">
                    {/* Details Cards */}
                    <Card className="mb-6">
                        <View className="flex-row items-start mb-4">
                            <Clock size={20} color="#6B7280" className="mt-0.5" />
                            <View className="ml-3">
                                <Text className="text-sm text-gray-500">Time & Date</Text>
                                <Text className="text-base font-semibold text-gray-900">
                                    {new Date(incident.timestamp).toLocaleString()}
                                </Text>
                            </View>
                        </View>
                        <View className="h-[1px] bg-gray-100 my-2" />
                        <View className="flex-row items-start">
                            <MapPin size={20} color="#6B7280" className="mt-0.5" />
                            <View className="ml-3">
                                <Text className="text-sm text-gray-500">Location</Text>
                                <Text className="text-base font-semibold text-gray-900">{incident.location}</Text>
                                <Text className="text-xs text-gray-400 mt-0.5">37.78825, -122.4324</Text>
                            </View>
                        </View>
                    </Card>

                    {/* AI Analysis */}
                    <SectionTitle title="AI Analysis" />
                    <View className="flex-row flex-wrap gap-3 mb-6">
                        <Card className="w-[48%] bg-gray-50 border-gray-100 p-3">
                            <Text className="text-xs text-gray-500 mb-1">Impact Type</Text>
                            <Text className="text-base font-bold text-gray-900">Side Collision</Text>
                        </Card>
                        <Card className="w-[48%] bg-gray-50 border-gray-100 p-3">
                            <Text className="text-xs text-gray-500 mb-1">Confidence</Text>
                            <Text className="text-base font-bold text-green-600">98.5%</Text>
                        </Card>
                        <Card className="w-[48%] bg-gray-50 border-gray-100 p-3">
                            <Text className="text-xs text-gray-500 mb-1">Force</Text>
                            <Text className="text-base font-bold text-red-600">8.5g</Text>
                        </Card>
                        <Card className="w-[48%] bg-gray-50 border-gray-100 p-3">
                            <Text className="text-xs text-gray-500 mb-1">Helmet Status</Text>
                            <Text className="text-base font-bold text-orange-600">Damaged</Text>
                        </Card>
                    </View>

                    {/* Actions */}
                    <Button title="Export Report (PDF)" className="mb-3" />
                    <Button variant="outline" title="Delete Recording" className="border-red-200" />

                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
