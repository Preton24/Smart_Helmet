import React, { useEffect, useState } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ChevronLeft, Camera, RefreshCw } from 'lucide-react-native';
import { Header } from '../components/Header';
import { Text } from '../components/Text';
import { cameraAddress, backendAddress } from '@/constants/values';

function uint8ToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
        const sub = bytes.subarray(i, Math.min(i + chunkSize, len));
        binary += String.fromCharCode.apply(null, sub as unknown as number[]);
    }
    return btoa(binary);
}

export default function LiveCamScreen() {
    const [frame, setFrame] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const streamHost = cameraAddress || backendAddress;

    const connect = () => {
        setConnected(false);
        setError(null);
        const ws = new WebSocket(`ws://${streamHost}:8080`);

        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
            setConnected(true);
        };

        let buffer = new Uint8Array(0);

        ws.onmessage = (event) => {
            try {
                const chunk = new Uint8Array(event.data);
                if (chunk.length === 0) return;

                // Append new chunk
                const newBuffer = new Uint8Array(buffer.length + chunk.length);
                newBuffer.set(buffer, 0);
                newBuffer.set(chunk, buffer.length);
                buffer = newBuffer;

                let latestFrameBytes: Uint8Array | null = null;

                // Look for JPEG markers (SOI: 0xFF 0xD8, EOI: 0xFF 0xD9)
                while (true) {
                    let startIndex = -1;
                    for (let i = 0; i < buffer.length - 1; i++) {
                        if (buffer[i] === 0xFF && buffer[i + 1] === 0xD8) {
                            startIndex = i;
                            break;
                        }
                    }

                    if (startIndex === -1) {
                        if (buffer.length > 512 * 1024) buffer = new Uint8Array(0);
                        break;
                    }

                    let endIndex = -1;
                    for (let i = startIndex + 2; i < buffer.length - 1; i++) {
                        if (buffer[i] === 0xFF && buffer[i + 1] === 0xD9) {
                            endIndex = i;
                            break;
                        }
                    }

                    if (endIndex === -1) {
                        if (startIndex > 0) {
                            buffer = buffer.slice(startIndex);
                        }
                        break;
                    }

                    // Extract complete frame and advance buffer
                    latestFrameBytes = buffer.subarray(startIndex, endIndex + 2);
                    buffer = buffer.slice(endIndex + 2);
                }

                // Render latest frame for smooth real-time video
                if (latestFrameBytes) {
                    const base64 = uint8ToBase64(latestFrameBytes);
                    setFrame(`data:image/jpeg;base64,${base64}`);
                }
            } catch (err) {
                console.error("Error processing frame:", err);
            }
        };

        ws.onerror = (e) => {
            console.error("WebSocket error:", e);
            setError("Failed to connect to camera");
            setConnected(false);
        };

        ws.onclose = () => {
            setConnected(false);
        };

        return ws;
    };

    useEffect(() => {
        const ws = connect();
        return () => ws.close();
    }, []);

    return (
        <SafeAreaView className="flex-1 bg-black" edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <View className="flex-row items-center px-4 py-3 bg-black border-b border-gray-800">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <ChevronLeft size={28} color="#ffffff" />
                </TouchableOpacity>
                <View className="flex-1">
                    <Text className="text-xl font-bold text-white">Live Helmet Feed</Text>
                    <View className="flex-row items-center">
                        <View className={`w-2 h-2 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                        <Text className="text-xs text-gray-400">{connected ? 'Live' : 'Disconnected'}</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={() => connect()} className="p-2">
                    <RefreshCw size={20} color="#3b82f6" />
                </TouchableOpacity>
            </View>

            <View className="flex-1 items-center justify-center bg-black">
                {frame ? (
                    <Image
                        source={{ uri: frame }}
                        style={styles.fullImage}
                        resizeMode="contain"
                    />
                ) : (
                    <View className="items-center px-10">
                        {error ? (
                            <>
                                <View className="w-20 h-20 rounded-full bg-red-900/20 items-center justify-center mb-4">
                                    <Camera size={40} color="#ef4444" />
                                </View>
                                <Text variant="destructive" className="text-center mb-2">{error}</Text>
                                <Text variant="muted" className="text-center text-gray-400">
                                    Make sure the helmet is powered on and connected to the same network.
                                </Text>
                            </>
                        ) : (
                            <>
                                <ActivityIndicator color="#3b82f6" size="large" className="mb-4" />
                                <Text className="text-gray-400">Establishing secure link...</Text>
                                <Text className="text-xs text-gray-600 mt-2">{streamHost}:8080</Text>
                            </>
                        )}
                    </View>
                )}
            </View>

            {/* Overlay Info */}
            <View className="absolute bottom-10 left-4 right-4 bg-black/40 p-4 rounded-xl backdrop-blur-md border border-white/10">
                <View className="flex-row justify-between items-center">
                    <View>
                        <Text className="text-white font-medium">Helmet Camera 01</Text>
                        <Text className="text-gray-400 text-xs">Standard Field of View</Text>
                    </View>
                    <View className="bg-white/10 px-2 py-1 rounded">
                        <Text className="text-white text-[10px] font-bold">480P</Text>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    fullImage: {
        width: '100%',
        height: '100%',
    }
});