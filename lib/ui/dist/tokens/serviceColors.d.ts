export interface ServiceColorEntry {
    id: string;
    name: string;
    color: string;
    gradient: [string, string];
    bgLight: string;
    bgDark: string;
    textLight: string;
    textDark: string;
    icon: string;
}
export declare const SERVICE_COLORS: Record<string, ServiceColorEntry>;
export type ServiceId = keyof typeof SERVICE_COLORS;
//# sourceMappingURL=serviceColors.d.ts.map