import { TouchableOpacity, View } from 'react-native';
import { LucideIcon, ChevronRight } from 'lucide-react-native';
import { cn } from '../lib/utils';
import { Text } from './Text';

interface ListItemProps {
    icon?: LucideIcon;
    label: string;
    value?: string | number;
    onPress?: () => void;
    className?: string;
    showArrow?: boolean;
}

export function ListItem({ icon: Icon, label, value, onPress, className, showArrow = true }: ListItemProps) {
    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            className={cn("flex-row items-center justify-between p-4 bg-white border border-gray-100 rounded-xl mb-2 dark:bg-neutral-900 dark:border-gray-800", className)}
            disabled={!onPress}
        >
            <View className="flex-row items-center gap-3">
                {Icon && <Icon size={20} color="#666" />}
                <Text className="text-base font-medium">{label}</Text>
            </View>
            <View className="flex-row items-center gap-2">
                {value && <Text variant="muted">{value}</Text>}
                {showArrow && onPress && <ChevronRight size={16} color="#999" />}
            </View>
        </TouchableOpacity>
    );
}
