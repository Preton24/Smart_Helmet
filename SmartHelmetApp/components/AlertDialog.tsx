import React from 'react';
import { View, Modal, TouchableOpacity, Pressable, StyleSheet, Platform } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';

interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}

interface AlertDialogProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    message: string;
    buttons?: AlertButton[];
}

export function AlertDialog({ visible, onClose, title, message, buttons }: AlertDialogProps) {
    const handlePress = (onPress?: () => void) => {
        if (onPress) onPress();
        onClose();
    };

    const renderButtons = () => {
        if (!buttons || buttons.length === 0) {
            return (
                <Button 
                    title="Close" 
                    onPress={onClose} 
                    className="w-full h-12 rounded-2xl"
                />
            );
        }

        return (
            <View className={buttons.length > 2 ? "flex-col gap-2" : "flex-row gap-3"}>
                {buttons.map((btn, index) => (
                    <Button 
                        key={index}
                        variant={btn.style === 'destructive' ? 'destructive' : btn.style === 'cancel' ? 'outline' : 'default'}
                        title={btn.text} 
                        onPress={() => handlePress(btn.onPress)} 
                        className={buttons.length > 2 ? "w-full h-12 rounded-2xl" : "flex-1 h-12 rounded-2xl"}
                    />
                ))}
            </View>
        );
    };

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <Pressable 
                className="flex-1 bg-black/60 items-center justify-center p-4" 
                onPress={onClose}
            >
                <Pressable 
                    className="bg-white dark:bg-neutral-900 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-800"
                    onPress={(e) => e.stopPropagation()} 
                >
                    <View className="px-6 pt-6 pb-2">
                        <Text className="text-xl font-bold">{title}</Text>
                    </View>
                    <View className="px-6 pb-6">
                        <Text variant="muted" className="text-base leading-6 mb-8">
                            {message}
                        </Text>
                        {renderButtons()}
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
