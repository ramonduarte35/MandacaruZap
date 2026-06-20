import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  ConnectionState,
  fetchLatestBaileysVersion,
  Browsers
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import prisma from '../lib/prisma';
import { handleIncomingMessage } from '../listeners/messageListener';

const logger = pino({ level: 'error' });

class WhatsAppManager {
  private activeSockets: Map<string, WASocket> = new Map();
  private retryCounts: Map<string, number> = new Map();
  private maxRetries = 5;

  /**
   * Inicializa todas as instâncias que deveriam estar conectadas (ou tentando conectar) no banco de dados.
   */
  async bootstrap() {
    try {
      const instances = await prisma.whatsappInstance.findMany({
        where: {
          status: {
            in: ['CONNECTED', 'CONNECTING', 'QRCODE']
          }
        }
      });

      console.log(`[Manager] Bootstrapping ${instances.length} active instances...`);
      for (const inst of instances) {
        this.startInstance(inst.id).catch(err => {
          console.error(`[Manager] Failed to auto-start instance ${inst.id}:`, err);
        });
      }
    } catch (error) {
      console.error('[Manager] Error bootstrapping instances:', error);
    }
  }

  /**
   * Conecta uma instância de WhatsApp baseada no ID.
   */
  async startInstance(instanceId: string): Promise<void> {
    if (this.activeSockets.has(instanceId)) {
      console.log(`[Manager] Instance ${instanceId} is already running.`);
      return;
    }

    try {
      console.log(`[Manager] Starting instance ${instanceId}...`);
      await prisma.whatsappInstance.update({
        where: { id: instanceId },
        data: { status: 'CONNECTING', qrCode: null }
      });

      const sessionDir = path.join(process.cwd(), 'sessions', instanceId);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

      // Obtém a versão do cliente do WhatsApp Web mais recente recomendada
      const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({
        version: [2, 3000, 1015901307], // Fallback moderno
        isLatest: false
      }));

      console.log(`[Manager] Connecting instance ${instanceId} using WA version ${version.join('.')}, isLatest: ${isLatest}`);

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger,
        browser: Browsers.macOS('Desktop')
      });

      this.activeSockets.set(instanceId, sock);

      sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log(`[Manager] New QR Code generated for instance: ${instanceId}`);
          try {
            const qrDataUrl = await QRCode.toDataURL(qr);
            await prisma.whatsappInstance.update({
              where: { id: instanceId },
              data: { status: 'QRCODE', qrCode: qrDataUrl }
            });
          } catch (qrError) {
            console.error('[Manager] Failed to generate QR data URL:', qrError);
          }
        }

        if (connection === 'open') {
          console.log(`[Manager] Instance ${instanceId} is CONNECTED.`);
          const phone = sock.user?.id ? sock.user.id.split(':')[0] : null;
          
          await prisma.whatsappInstance.update({
            where: { id: instanceId },
            data: {
              status: 'CONNECTED',
              qrCode: null,
              phone: phone
            }
          });
          
          this.retryCounts.set(instanceId, 0); // Reset do contador de retentativas
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          console.error(`[Manager] Instance ${instanceId} connection closed. Code: ${statusCode}. Reconnecting: ${shouldReconnect}`);
          console.error(`[Manager] Full disconnection error for ${instanceId}:`, lastDisconnect?.error);

          this.activeSockets.delete(instanceId);

          if (shouldReconnect) {
            const retries = this.retryCounts.get(instanceId) || 0;
            if (retries < this.maxRetries) {
              this.retryCounts.set(instanceId, retries + 1);
              const delay = Math.min(1000 * Math.pow(2, retries), 30000); // Backoff exponencial
              console.log(`[Manager] Reconnecting instance ${instanceId} in ${delay}ms... (Attempt ${retries + 1}/${this.maxRetries})`);
              setTimeout(() => this.startInstance(instanceId), delay);
            } else {
              console.log(`[Manager] Max reconnection attempts reached for instance ${instanceId}. Setting to DISCONNECTED.`);
              try {
                await prisma.whatsappInstance.update({
                  where: { id: instanceId },
                  data: { status: 'DISCONNECTED', qrCode: null }
                });
              } catch (e) {}
            }
          } else {
            console.log(`[Manager] Logged out from WhatsApp for instance ${instanceId}. Cleaning directory.`);
            try {
              await prisma.whatsappInstance.update({
                where: { id: instanceId },
                data: { status: 'DISCONNECTED', qrCode: null, phone: null }
              });
            } catch (e) {}
            // Remove a pasta de sessão pois ela foi invalidada
            try {
              fs.rmSync(sessionDir, { recursive: true, force: true });
            } catch (rmError) {
              console.error('[Manager] Failed to delete session directory:', rmError);
            }
          }
        }
      });

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('messages.upsert', async (m) => {
        console.log(`[Worker] messages.upsert received event: type=${m.type}, count=${m.messages?.length}`);
        
        if (m.type === 'notify') {
          for (const message of m.messages) {
            const remoteJid = message.key.remoteJid;
            const fromMe = message.key.fromMe;
            
            console.log(`[Worker] Received message: JID=${remoteJid}, fromMe=${fromMe}, id=${message.key.id}`);

            // Ignora mensagens do próprio bot somente se não forem enviadas em um grupo mapeado como origem (permitindo testes do próprio usuário)
            if (fromMe) {
              const isSourceGroup = await prisma.groupMapping.count({
                where: {
                  instanceId: instanceId,
                  sourceGroupId: remoteJid,
                  isActive: true
                }
              });
              if (isSourceGroup === 0) {
                console.log(`[Worker] Skipped message ${message.key.id} because it was sent by the bot (fromMe: true) and is not in an active source group.`);
                continue;
              }
              console.log(`[Worker] Processing message ${message.key.id} sent by the bot owner (fromMe: true) in source group ${remoteJid}.`);
            }
            
            handleIncomingMessage(instanceId, sock, message).catch(err => {
              console.error('[Manager] Error processing incoming message:', err);
            });
          }
        }
      });
    } catch (error) {
      console.error(`[Manager] Error in startInstance for ${instanceId}:`, error);
      try {
        await prisma.whatsappInstance.update({
          where: { id: instanceId },
          data: { status: 'DISCONNECTED', qrCode: null }
        });
      } catch (e) {}
    }
  }

  /**
   * Desconecta e encerra uma instância específica.
   */
  async stopInstance(instanceId: string): Promise<void> {
    const sock = this.activeSockets.get(instanceId);
    if (sock) {
      console.log(`[Manager] Stopping instance ${instanceId}...`);
      try {
        sock.end(undefined);
      } catch (err) {
        console.error(`[Manager] Error calling sock.end for ${instanceId}:`, err);
      }
      this.activeSockets.delete(instanceId);
    }

    await prisma.whatsappInstance.update({
      where: { id: instanceId },
      data: { status: 'DISCONNECTED', qrCode: null }
    });
  }

  /**
   * Retorna o socket ativo de uma instância para envios manuais ou consulta.
   */
  getSocket(instanceId: string): WASocket | undefined {
    return this.activeSockets.get(instanceId);
  }
}

export const whatsappManager = new WhatsAppManager();
export default whatsappManager;
