import React, { createContext, useContext, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { currentUser as initialUser, familyMembers as initialFamily } from '../lib/mockData';

// Define types based on mock data
export type User = typeof initialUser & { phoneNumber?: string };
export type FamilyMember = typeof initialFamily[0] & { speed?: number; rfid?: string; mobileNumber?: string };

interface UserContextType {
    user: User;
    familyMembers: FamilyMember[];
    helmetVolume: number;
    unitSystem: 'metric' | 'imperial';
    updateUser: (updatedUser: Partial<User>) => void;
    addFamilyMember: (member: Omit<FamilyMember, 'id' | 'speed'>) => void;
    removeFamilyMember: (id: number) => void;
    updateHelmetVolume: (volume: number) => void;
    updateUnitSystem: (units: 'metric' | 'imperial') => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User>(initialUser);
    const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
    const [helmetVolume, setHelmetVolume] = useState(80);
    const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>('metric');

    // Load data from storage on mount
    React.useEffect(() => {
        const loadData = async () => {
            try {
                const [storedFamily, storedVolume, storedUnits] = await Promise.all([
                    AsyncStorage.getItem('familyMembers'),
                    AsyncStorage.getItem('helmetVolume'),
                    AsyncStorage.getItem('unitSystem')
                ]);

                if (storedFamily) {
                    const parsedFamily = JSON.parse(storedFamily);
                    // Migration: Ensure Mom and Dad have RFID/Phone even if already stored
                    const migratedFamily = parsedFamily.map((m: any) => {
                        const original = initialFamily.find(o => o.name === m.name);
                        if (original) {
                            return { ...original, ...m, rfid: m.rfid || original.rfid, mobileNumber: m.mobileNumber || original.mobileNumber };
                        }
                        return m;
                    });
                    setFamilyMembers(migratedFamily);
                } else {
                    const initialData = initialFamily.map(m => ({ ...m, speed: 0, status: 'Not Driving' }));
                    setFamilyMembers(initialData);
                    await AsyncStorage.setItem('familyMembers', JSON.stringify(initialData));
                }

                if (storedVolume) {
                    setHelmetVolume(JSON.parse(storedVolume));
                }

                if (storedUnits) {
                    setUnitSystem(storedUnits as 'metric' | 'imperial');
                }
            } catch (e) {
                console.error("Failed to load user context data", e);
            }
        };
        loadData();
    }, []);

    // Removed random simulation for family member driving status

    const updateUser = (updatedUser: Partial<User>) => {
        setUser((prev) => ({ ...prev, ...updatedUser }));
    };

    const addFamilyMember = async (member: Omit<FamilyMember, 'id' | 'speed'>) => {
        const newMember = { ...member, id: Date.now(), speed: 0 };
        const updatedList = [...familyMembers, newMember];
        setFamilyMembers(updatedList);
        await AsyncStorage.setItem('familyMembers', JSON.stringify(updatedList));
    };

    const removeFamilyMember = async (id: number) => {
        const updatedList = familyMembers.filter((member) => member.id !== id);
        setFamilyMembers(updatedList);
        await AsyncStorage.setItem('familyMembers', JSON.stringify(updatedList));
    };

    const updateHelmetVolume = async (volume: number) => {
        const newVolume = Math.max(0, Math.min(100, volume));
        setHelmetVolume(newVolume);
        await AsyncStorage.setItem('helmetVolume', JSON.stringify(newVolume));
    };

    const updateUnitSystem = async (units: 'metric' | 'imperial') => {
        setUnitSystem(units);
        await AsyncStorage.setItem('unitSystem', units);
    };

    return (
        <UserContext.Provider value={{ user, familyMembers, helmetVolume, unitSystem, updateUser, addFamilyMember, removeFamilyMember, updateHelmetVolume, updateUnitSystem }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}
