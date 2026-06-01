declare global {
    interface Window {
        grecaptcha?: {
            ready: (cb: () => void) => void;
            execute: (siteKey: string, opts: {
                action: string;
            }) => Promise<string>;
        };
    }
}
export declare function executeCaptcha(action: string, siteKey?: string): Promise<string>;
export declare function isRecaptchaLoaded(): boolean;
//# sourceMappingURL=index.d.ts.map