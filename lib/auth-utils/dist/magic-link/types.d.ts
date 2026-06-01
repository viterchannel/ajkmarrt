export interface MagicLinkSenderProps {
    onSend: (email: string) => Promise<void>;
    cooldownSeconds?: number;
    title?: string;
    subtitle?: string;
}
//# sourceMappingURL=types.d.ts.map