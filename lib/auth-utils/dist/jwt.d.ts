export interface JwtPayload {
    sub?: string;
    exp?: number;
    iat?: number;
    jti?: string;
    role?: string;
    [key: string]: unknown;
}
export declare function decodeJwt(token: string): JwtPayload | null;
export declare function isTokenExpired(token: string, leewaySeconds?: number): boolean;
//# sourceMappingURL=jwt.d.ts.map