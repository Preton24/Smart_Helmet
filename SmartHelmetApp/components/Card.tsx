import { View, ViewProps } from 'react-native';
import { cn } from '../lib/utils';

interface CardProps extends ViewProps {
    className?: string;
}

export function Card({ className, ...props }: CardProps) {
    return (
        <View
            className={cn("rounded-xl border border-gray-100 bg-white shadow-md shadow-gray-200/50 p-4 elevation-2 dark:bg-neutral-900 dark:border-gray-800 dark:shadow-none", className)}
            {...props}
        />
    );
}
