import React from 'react';
import { View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Region, Circle } from 'react-native-maps';
import { Text } from './Text';
import { MapPin } from 'lucide-react-native';
import { cn } from '../lib/utils';
import { FamilyMember } from '../context/UserContext';
import { locationData } from '../lib/mockData';

interface LocationMapProps {
    region: Region;
    setRegion: (region: Region) => void;
    familyMembers: FamilyMember[];

}

export function LocationMap({ region, setRegion, familyMembers }: LocationMapProps) {


    return (
        <MapView
            style={{ width: '100%', height: '100%' }}
            region={region}
            onRegionChangeComplete={setRegion}
            provider={PROVIDER_DEFAULT}
        >


            {familyMembers.map((member) => (
                <Marker
                    key={`family-member-${member.id}`}
                    coordinate={{
                        latitude: member.location.lat,
                        longitude: member.location.lng,
                    }}
                    title={member.name}
                    description={member.status}
                >
                    <View className="items-center">
                        <View className={cn(
                            "rounded-full p-1 border-2 border-white shadow-sm flex-row items-center justify-center",
                            member.status === 'Driving' ? "bg-green-500" : "bg-blue-500"
                        )}>
                            <MapPin size={18} color="white" fill="white" />
                        </View>
                        <View className="bg-black/80 px-2 py-1 rounded-md shadow-sm mt-1">
                            <Text className="text-[10px] font-bold text-white">{member.name}</Text>
                        </View>
                    </View>
                </Marker>
            ))}

            <Marker
                key="user-location-marker"
                coordinate={{
                    latitude: locationData.latitude,
                    longitude: locationData.longitude,
                }}
                title="You"
                description="Current Location"
            >
                <View className="items-center">
                    <View className="bg-red-500 rounded-full p-1 border-2 border-white shadow-sm">
                        <MapPin size={24} color="white" fill="white" />
                    </View>
                    <View className="bg-black/80 px-2 py-1 rounded-md shadow-sm mt-1">
                        <Text className="text-[10px] font-bold text-white">You</Text>
                    </View>
                </View>
            </Marker>
        </MapView>
    );
}
