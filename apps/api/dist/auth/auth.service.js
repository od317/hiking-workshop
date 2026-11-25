"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const argon2 = __importStar(require("argon2"));
const prisma_service_1 = require("../prisma/prisma.service");
const sha256 = (value) => (0, crypto_1.createHash)('sha256').update(value).digest('hex');
const DAY_MS = 86_400_000;
let AuthService = class AuthService {
    prisma;
    jwt;
    config;
    dummyHash = argon2.hash((0, crypto_1.randomBytes)(16).toString('hex'));
    constructor(prisma, jwt, config) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
    }
    async login(username, password) {
        const user = await this.prisma.user.findUnique({
            where: { username: username.trim().toLowerCase() },
        });
        const valid = await argon2.verify(user?.passwordHash ?? (await this.dummyHash), password);
        if (!user || !user.isActive || !valid) {
            throw new common_1.UnauthorizedException('Invalid username or password');
        }
        return this.issueTokens(user, (0, crypto_1.randomUUID)());
    }
    async refresh(token) {
        const row = await this.prisma.refreshToken.findUnique({
            where: { tokenHash: sha256(token) },
            include: { user: true },
        });
        if (!row)
            throw new common_1.UnauthorizedException();
        if (row.revokedAt) {
            await this.revokeFamily(row.familyId);
            throw new common_1.UnauthorizedException();
        }
        if (row.expiresAt < new Date() || !row.user.isActive) {
            throw new common_1.UnauthorizedException();
        }
        return this.prisma.$transaction(async (tx) => {
            const claimed = await tx.refreshToken.updateMany({
                where: { id: row.id, revokedAt: null },
                data: { revokedAt: new Date() },
            });
            if (claimed.count === 0)
                throw new common_1.UnauthorizedException();
            return this.issueTokens(row.user, row.familyId, tx);
        });
    }
    async logout(token) {
        const row = await this.prisma.refreshToken.findUnique({
            where: { tokenHash: sha256(token) },
        });
        if (row)
            await this.revokeFamily(row.familyId);
    }
    async me(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, fullName: true, role: true },
        });
        if (!user)
            throw new common_1.UnauthorizedException();
        return user;
    }
    revokeFamily(familyId) {
        return this.prisma.refreshToken.updateMany({
            where: { familyId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }
    async issueTokens(user, familyId, db = this.prisma) {
        const accessToken = await this.jwt.signAsync({
            sub: user.id,
            username: user.username,
        });
        const refreshToken = (0, crypto_1.randomBytes)(48).toString('base64url');
        const ttlDays = this.config.get('REFRESH_TTL_DAYS', { infer: true });
        await db.refreshToken.create({
            data: {
                userId: user.id,
                familyId,
                tokenHash: sha256(refreshToken),
                expiresAt: new Date(Date.now() + ttlDays * DAY_MS),
            },
        });
        return {
            accessToken,
            refreshToken,
            expiresIn: this.config.get('ACCESS_TTL_SECONDS', { infer: true }),
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map