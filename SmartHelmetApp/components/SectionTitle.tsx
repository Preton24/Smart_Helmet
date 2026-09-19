import { Text } from './Text';
import { cn } from '../lib/utils';

interface SectionTitleProps {
    title: string;
    className?: string;
}

export function SectionTitle({ title, className }: SectionTitleProps) {
    return (
        <Text className={cn("text-lg font-bold mb-3", className)}>
            {title}
        </Text>
    );
}
