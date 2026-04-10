import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

export interface WsUser {
  sub:      string;
  id:       string;
  tenantId: string;
  role:     string;
  email:    string;
}

/**
 * WsJwtGuard — authentification JWT au niveau WebSocket
 *
 * Flux :
 *   1. Extrait le token depuis client.handshake.auth.token  (ou headers.authorization)
 *   2. Vérifie la signature avec le secret JWT serveur
 *   3. Stocke le payload vérifié dans client.data.user
 *   4. Ne fait PAS confiance à client.data.role fourni par le client
 *
 * Usage en tant que middleware de connexion (handleConnection) :
 *   await this.wsJwtGuard.authenticate(client);  // lève WsException si invalide
 *
 * Usage en tant que CanActivate (sur handlers) :
 *   @UseGuards(WsJwtGuard)
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger  = new Logger(WsJwtGuard.name);
  private readonly secret: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.secret = this.config.get<string>('jwt.secret') ?? 'dev_secret_change_me';
  }

  // ── CanActivate (pour @UseGuards sur handlers) ─────────────────────────────

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    if (!client.data?.user) {
      client.emit('error', { message: 'Non authentifié' });
      throw new WsException('Token JWT manquant ou invalide');
    }
    return true;
  }

  // ── authenticate() — appelé dans handleConnection ─────────────────────────

  async authenticate(client: Socket): Promise<WsUser> {
    const token = this.extractToken(client);
    if (!token) {
      client.emit('error', { message: 'Token JWT requis' });
      client.disconnect(true);
      throw new WsException('Token JWT manquant');
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(token, { secret: this.secret });
    } catch (err: any) {
      this.logger.warn(`[WsJwt] Token invalide: ${err.message}`);
      client.emit('error', { message: 'Token invalide ou expiré' });
      client.disconnect(true);
      throw new WsException('Token invalide');
    }

    const user: WsUser = {
      sub:      payload.sub,
      id:       payload.sub,
      tenantId: payload.tenantId,
      role:     payload.role,
      email:    payload.email,
    };

    // Stocker côté serveur uniquement — jamais faire confiance au client
    client.data = { ...client.data, user };

    this.logger.debug(`[WsJwt] Auth OK: userId=${user.id} role=${user.role} tenant=${user.tenantId}`);
    return user;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private extractToken(client: Socket): string | null {
    // Priorité 1 : client.handshake.auth.token (recommandé Socket.io)
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) return authToken.replace(/^Bearer\s+/i, '');

    // Priorité 2 : Authorization header (compatibilité HTTP)
    const authHeader = client.handshake.headers?.authorization as string | undefined;
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);

    // Priorité 3 : query string (moins sécurisé, logs serveur exposent le token)
    const queryToken = client.handshake.query?.token as string | undefined;
    if (queryToken) return queryToken;

    return null;
  }

  /** Raccourci pour vérifier le rôle depuis client.data (déjà authentifié) */
  static requireRoles(client: Socket, roles: string[]): void {
    const role = client.data?.user?.role;
    if (!role || !roles.includes(role)) {
      client.emit('error', { message: 'Permissions insuffisantes' });
      throw new WsException('Permissions insuffisantes');
    }
  }
}
