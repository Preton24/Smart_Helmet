import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { cn } from '../lib/utils';

export interface TextProps extends RNTextProps {
    className?: string;
    variant?: 'default' | 'muted' | 'primary' | 'destructive' | 'success' | 'warning';
}

export function Text({ className, variant = 'default', style, ...props }: TextProps) {
    let variantClass = "text-gray-900 dark:text-gray-100";

    switch (variant) {
        case 'muted':
            variantClass = "text-gray-500 dark:text-gray-400";
            break;
        case 'primary':
            variantClass = "text-indigo-600 dark:text-indigo-400";
            break;
        case 'destructive':
            variantClass = "text-red-500 dark:text-red-400";
            break;
        case 'success':
            variantClass = "text-green-600 dark:text-green-400";
            break;
        case 'warning':
            variantClass = "text-yellow-600 dark:text-yellow-400";
            break;
    }

    return (
        <RNText
            className={cn(
                variantClass,
                className
            )}
            style={style}
            {...props}
        />
    );
}
