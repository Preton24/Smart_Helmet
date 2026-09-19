import React, { useState } from 'react';
import { View, Image, ScrollView, Dimensions, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { Text } from './Text';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ZoomableImageProps {
    source: { uri: string };
    thumbnailHeight?: number;
    showExpandHint?: boolean;
}

export function ZoomableImage({ source, thumbnailHeight = 200, showExpandHint = true }: ZoomableImageProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    return (
        <>
            {/* Thumbnail with tap to expand */}
            <TouchableOpacity activeOpacity={0.9} onPress={() => setIsFullscreen(true)}>
                <View className="bg-black rounded-lg overflow-hidden">
                    <Image
                        source={source}
                        style={{ width: '100%', height: thumbnailHeight }}
                        resizeMode="contain"
                    />
                    {showExpandHint && (
                        <View className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded">
                            <Text className="text-white text-xs">Tap to expand • Pinch to zoom</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>

            {/* Fullscreen Modal with Zoom */}
            <Modal
                visible={isFullscreen}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsFullscreen(false)}
            >
                <View style={styles.modalContainer}>
                    {/* Close button */}
                    <TouchableOpacity
                        onPress={() => setIsFullscreen(false)}
                        style={styles.closeButton}
                    >
                        <X size={28} color="white" />
                    </TouchableOpacity>

                    {/* Zoomable ScrollView */}
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        maximumZoomScale={5}
                        minimumZoomScale={1}
                        showsHorizontalScrollIndicator={false}
                        showsVerticalScrollIndicator={false}
                        centerContent={true}
                        bouncesZoom={true}
                    >
                        <Image
                            source={source}
                            style={styles.fullImage}
                            resizeMode="contain"
                        />
                    </ScrollView>

                    {/* Zoom hint */}
                    <View style={styles.zoomHint}>
                        <Text className="text-white/70 text-xs">Pinch to zoom • Double-tap to reset</Text>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        right: 16,
        zIndex: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 20,
        padding: 8,
    },
    scrollContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullImage: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT * 0.85,
    },
    zoomHint: {
        position: 'absolute',
        bottom: 40,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
});
