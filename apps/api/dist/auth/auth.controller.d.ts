import { AuthService } from './auth.service';
import type { AuthUser } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    login(dto: LoginDto): Promise<import("./auth.service").TokenPair>;
    refresh(dto: RefreshDto): Promise<import("./auth.service").TokenPair>;
    logout(dto: RefreshDto): Promise<void>;
    me(user: AuthUser): Promise<{
        id: string;
        username: string;
        fullName: string;
        role: string;
    }>;
}
