import { View } from 'react-native';
import { cn } from '../lib/utils';
import { Text } from './Text';

interface BadgeProps {
    variant?: 'default' | 'outline' | 'destructive' | 'success' | 'warning';
    children: React.ReactNode;
    className?: string;
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
    let bgClass = 'bg-gray-100 dark:bg-gray-800';
    let textClass = 'text-gray-800 dark:text-gray-300';

    switch (variant) {
        case 'success':
            bgClass = 'bg-green-100 dark:bg-green-900/40';
            textClass = 'text-green-800 dark:text-green-400';
            break;
        case 'warning':
            bgClass = 'bg-yellow-100 dark:bg-yellow-900/40';
            textClass = 'text-yellow-800 dark:text-yellow-400';
            break;
        case 'destructive':
            bgClass = 'bg-red-100 dark:bg-red-900/40';
            textClass = 'text-red-800 dark:text-red-400';
            break;
        case 'outline':
            bgClass = 'bg-transparent border border-gray-200 dark:border-gray-700';
            textClass = 'text-gray-800 dark:text-gray-300';
            break;
    }

    return (
        <View className={cn("px-2.5 py-0.5 rounded-full items-center justify-center self-start", bgClass, className)}>
            <Text className={cn("text-xs font-semibold", textClass)}>{children}</Text>
        </View>
    );
}
