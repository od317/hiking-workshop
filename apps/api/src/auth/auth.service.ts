import { createHash, randomBytes, randomUUID } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const DAY_MS = 86_400_000;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // access token lifetime, seconds
}

@Injectable()
export class AuthService {
  // Used to burn the same time as a real check when the username doesn't exist.
  private readonly dummyHash = argon2.hash(randomBytes(16).toString('hex'));

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login(username: string, password: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
    });
    const valid = await argon2.verify(
      user?.passwordHash ?? (await this.dummyHash),
      password,
    );
    if (!user || !user.isActive || !valid) {
      throw new UnauthorizedException('Invalid username or password');
    }
    return this.issueTokens(user, randomUUID());
  }

  async refresh(token: string): Promise<TokenPair> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    if (!row) throw new UnauthorizedException();

    // An already-used token coming back means it may have been stolen:
    // kill the whole session family.
    if (row.revokedAt) {
      await this.revokeFamily(row.familyId);
      throw new UnauthorizedException();
    }
    if (row.expiresAt < new Date() || !row.user.isActive) {
      throw new UnauthorizedException();
    }

    return this.prisma.$transaction(async (tx) => {
      // Atomic claim: only one concurrent request can consume this token.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: row.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (claimed.count === 0) throw new UnauthorizedException();
      return this.issueTokens(row.user, row.familyId, tx);
    });
  }

  async logout(token: string): Promise<void> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (row) await this.revokeFamily(row.familyId);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, fullName: true, role: true },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  private revokeFamily(familyId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    user: { id: string; username: string },
    familyId: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      username: user.username,
    });
    const refreshToken = randomBytes(48).toString('base64url');
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
}
