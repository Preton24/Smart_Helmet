import React, { useState } from 'react';
import { View, Pressable, Platform } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    cancelAnimation,
    Easing,
    runOnJS
} from 'react-native-reanimated';
import { Text } from './Text';
import { cn } from '../lib/utils';
import { AlertTriangle } from 'lucide-react-native';

interface SOSButtonProps {
    onTrigger: () => void;
    className?: string;
}

export function SOSButton({ onTrigger, className }: SOSButtonProps) {
    const progress = useSharedValue(0);
    const [isPressed, setIsPressed] = useState(false);

    const handlePressIn = () => {
        setIsPressed(true);
        progress.value = withTiming(1, {
            duration: 3000,
            easing: Easing.linear,
        }, (finished) => {
            if (finished) {
                runOnJS(triggerAction)();
            }
        });
    };

    const triggerAction = () => {
        setIsPressed(false);
        onTrigger();
        progress.value = withTiming(0, { duration: 200 });
    };

    const handlePressOut = () => {
        setIsPressed(false);
        cancelAnimation(progress);
        progress.value = withTiming(0, { duration: 300 });
    };

    const animatedStyle = useAnimatedStyle(() => {
        return {
            width: `${progress.value * 100}%`,
        };
    });

    return (
        <View className={cn("relative h-28 w-full rounded-2xl overflow-hidden bg-red-500 shadow-lg shadow-red-500/30 elevation-5 dark:bg-red-600", className)}>
            {/* Background fill animation layer */}
            <Animated.View
                style={[
                    {
                        position: 'absolute',
                        height: '100%',
                        backgroundColor: '#7f1d1d', // red-900
                        left: 0,
                        top: 0
                    },
                    animatedStyle
                ]}
            />

            <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                className="w-full h-full items-center justify-center"
            >
                <View className="items-center z-10 px-4">
                    <AlertTriangle size={32} color="white" className="mb-2" />
                    <Text className="text-white font-bold text-xl uppercase text-center">
                        {isPressed ? "Keep Holding..." : "Test SOS Emergency"}
                    </Text>
                    <Text className="text-white/90 text-sm mt-1 font-medium text-center">
                        {isPressed ? "Relaying Emergency Signal..." : "Hold for 3 seconds"}
                    </Text>
                </View>
            </Pressable>
        </View>
    );
}
