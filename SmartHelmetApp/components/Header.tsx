import { View } from 'react-native';
import { cn } from '../lib/utils';
import { Text } from './Text';

interface HeaderProps {
    title: string;
    rightContent?: React.ReactNode;
    leftContent?: React.ReactNode;
    className?: string;
}

export function Header({ title, rightContent, leftContent, className }: HeaderProps) {
    return (
        <View className={cn("px-4 py-3 flex-row justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-200/50 dark:bg-black/80 dark:border-gray-800", className)}>
            <View className="flex-row items-center gap-3">
                {leftContent}
                <Text className="text-2xl font-bold">{title}</Text>
            </View>
            {rightContent}
        </View>
    );
}
