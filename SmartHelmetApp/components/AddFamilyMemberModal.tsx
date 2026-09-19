import { View, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text } from './Text';
import { X } from 'lucide-react-native';
import { Button } from './Button';
import { useState } from 'react';

interface AddFamilyMemberModalProps {
    visible: boolean;
    onClose: () => void;
    onAdd: (member: { name: string; rfid: string; mobileNumber: string; status: string }) => void;
}

export function AddFamilyMemberModal({ visible, onClose, onAdd }: AddFamilyMemberModalProps) {
    const [name, setName] = useState('');
    const [rfid, setRfid] = useState('');
    const [mobileNumber, setMobileNumber] = useState('');
    const [status, setStatus] = useState('Home');

    const handleAdd = () => {
        if (name && rfid && mobileNumber) {
            onAdd({ name, rfid, mobileNumber, status });
            setName('');
            setRfid('');
            setMobileNumber('');
            setStatus('Home');
            onClose();
        }
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white dark:bg-gray-800 rounded-t-3xl p-6">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-xl font-bold">Add Family Member</Text>
                            <TouchableOpacity onPress={onClose}>
                                <X size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View className="mb-4">
                                <Text className="text-sm font-medium mb-2">Name</Text>
                                <TextInput
                                    className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4 text-gray-900 dark:text-white"
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="Enter name"
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            <View className="mb-4">
                                <Text className="text-sm font-medium mb-2">RFID Tag Number</Text>
                                <TextInput
                                    className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4 text-gray-900 dark:text-white"
                                    value={rfid}
                                    onChangeText={setRfid}
                                    placeholder="Enter RFID Tag"
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            <View className="mb-4">
                                <Text className="text-sm font-medium mb-2">Mobile Number</Text>
                                <TextInput
                                    className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4 text-gray-900 dark:text-white"
                                    value={mobileNumber}
                                    onChangeText={setMobileNumber}
                                    placeholder="Enter Mobile Number"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="phone-pad"
                                />
                            </View>

                            <View className="mb-6">
                                <Text className="text-sm font-medium mb-2">Status (e.g. Home, Work)</Text>
                                <TextInput
                                    className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4 text-gray-900 dark:text-white"
                                    value={status}
                                    onChangeText={setStatus}
                                    placeholder="Enter status"
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            <Button title="Add Member" onPress={handleAdd} />
                            <View className="h-8" />
                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
