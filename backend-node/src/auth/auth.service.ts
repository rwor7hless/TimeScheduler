import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Auth service. Mirrors the Python `backend/app/services/auth.py` behavior:
 *
 * - Argon2id hashing with pwdlib's `PasswordHash.recommended()` parameters
 *   (m=65536, t=3, p=4). The `argon2` npm package emits the same PHC-encoded
 *   hash format that pwdlib does, and reads all tunables from the hash string
 *   on verification — so we stay byte-for-byte compatible with Python-written
 *   hashes already in the DB.
 *
 * - HS256 JWT with payload `{sub: username, user_id: id, exp: unix_seconds}`.
 *   This matches the Python `create_access_token` shape exactly so tokens
 *   issued by either implementation decode under the other.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  async verifyPassword(plain: string, hashed: string): Promise<boolean> {
    try {
      return await argon2.verify(hashed, plain);
    } catch {
      // argon2.verify throws on malformed hashes; Python's pwdlib returns False
      // in the same situations. Match that for safe failure semantics.
      return false;
    }
  }

  async createAccessToken(userId: number, username: string): Promise<string> {
    // `Number(undefined) === NaN` and `NaN ?? 43200 === NaN`, so the old
    // `Number(...) ?? default` pattern silently minted exp=NaN tokens when
    // the env var was missing or malformed. Guard with Number.isFinite and
    // a positivity check before falling back to the 30-day default.
    const rawMinutes = Number(this.configService.get<string>('JWT_EXPIRE_MINUTES'));
    const minutes = Number.isFinite(rawMinutes) && rawMinutes > 0 ? rawMinutes : 43200;
    const exp = Math.floor(Date.now() / 1000) + minutes * 60;
    // jwtService.signAsync will honor `exp` in the payload and skip adding its own.
    return this.jwtService.signAsync({ sub: username, user_id: userId, exp });
  }

  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) return null;
    const ok = await this.verifyPassword(password, user.password_hash);
    if (!ok) return null;
    return user;
  }
}
