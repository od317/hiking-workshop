import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
export declare class AuthService {
    private readonly prisma;
    private readonly jwt;
    private readonly config;
    private readonly dummyHash;
    constructor(prisma: PrismaService, jwt: JwtService, config: ConfigService<Env, true>);
    login(username: string, password: string): Promise<TokenPair>;
    refresh(token: string): Promise<TokenPair>;
    logout(token: string): Promise<void>;
    me(userId: string): Promise<{
        id: string;
        username: string;
        fullName: string;
        role: string;
    }>;
    private revokeFamily;
    private issueTokens;
}
