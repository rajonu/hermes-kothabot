#!/bin/bash
set -e

echo "=== Setting up KothaBot VoIP Bridge and Sync Services ==="

# 1. Create bridge directory
mkdir -p /home/raj/kothabot-bridge
cd /home/raj/kothabot-bridge

# 2. Initialize npm and dependencies
if [ ! -f package.json ]; then
  npm init -y
fi
npm install ws uuid

# 3. Create .env file
PUBLIC_IP=$(curl -s https://api.ipify.org || echo "127.0.0.1")
cat << ENV_EOF > .env
KOTHABOT_APP_URL=http://127.0.0.1:3009
KOTHABOT_WSS_URL=wss://voice-server.up.railway.app
GATEWAY_TOKEN=kothabot-voip-secret-token-2026
PUBLIC_IP=$PUBLIC_IP
ENV_EOF

# 4. Create sync_telephony.js
cat << 'SYNC_EOF' > sync_telephony.js
const fs = require('fs');
const { exec } = require('child_process');
const http = require('http');
const https = require('https');

const SYNC_INTERVAL = 15000;
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || 'kothabot-voip-secret-token-2026';
const KOTHABOT_APP_URL = process.env.KOTHABOT_APP_URL || 'http://192.168.68.75:3001';
const PUBLIC_IP = process.env.PUBLIC_IP || '127.0.0.1';

console.log('[sync] Starting Telephony Auto-Sync client...');
console.log('[sync] App URL: ' + KOTHABOT_APP_URL);
console.log('[sync] Public IP: ' + PUBLIC_IP);

function fetchConfig() {
  return new Promise((resolve, reject) => {
    const url = `${KOTHABOT_APP_URL}/api/voice/telephony-sync`;
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, {
      headers: {
        'Authorization': `Bearer ${GATEWAY_TOKEN}`
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch config, status code: ${res.statusCode}`));
        return;
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function sync() {
  try {
    const data = await fetchConfig();
    if (!data || !data.shops) {
      console.warn('[sync] Invalid response from server');
      return;
    }
    
    const shops = data.shops;
    console.log(`[sync] Found ${shops.length} active telephony shops`);
    
    // 1. Generate PJSIP config content
    let pjsipContent = `[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060
local_net=192.168.0.0/16

[transport-tcp]
type=transport
protocol=tcp
bind=0.0.0.0:5060
local_net=192.168.0.0/16

`;

    for (const shop of shops) {
      const { shopId, number, host, username, password } = shop;
      // remove hyphens from registration DID
      const cleanUsername = username.replace(/[-\s]/g, '');
      pjsipContent += `
; ── REGISTRATION for ${shopId} ──
[reg-${shopId}]
type=registration
transport=transport-tcp
outbound_auth=auth-${shopId}
server_uri=sip:${host};transport=tcp
client_uri=sip:${cleanUsername}@${host};transport=tcp

[auth-${shopId}]
type=auth
auth_type=userpass
username=${cleanUsername}
password=${password}

[aor-${shopId}]
type=aor
contact=sip:${host};transport=tcp

[endpoint-${shopId}]
type=endpoint
transport=transport-tcp
context=kothabot-incoming
disallow=all
allow=ulaw,alaw
outbound_auth=auth-${shopId}
aors=aor-${shopId}
force_rport=yes
rtp_symmetric=yes
rewrite_contact=yes

[identify-${shopId}]
type=identify
endpoint=endpoint-${shopId}
match=${host}
`;
    }
    
    // 2. Generate extensions config content
    let extensionsContent = `[kothabot-incoming]
`;
    
    for (const shop of shops) {
      const { shopId, number } = shop;
      const rawNumber = number.replace(/[-\s]/g, '');
      
      extensionsContent += `exten => ${number},1,NoOp(Incoming call to ${number} for ${shopId})
same => n,Answer()
same => n,Audiosocket(${shopId},127.0.0.1:9092)
same => n,Hangup()

`;
      if (rawNumber !== number) {
        extensionsContent += `exten => ${rawNumber},1,NoOp(Incoming call to ${rawNumber} for ${shopId})
same => n,Answer()
same => n,Audiosocket(${shopId},127.0.0.1:9092)
same => n,Hangup()

`;
      }
    }
    
    if (shops.length > 0) {
      const firstShop = shops[0];
      extensionsContent += `exten => s,1,NoOp(Incoming call to s - routing to first shop ${firstShop.shopId})
same => n,Answer()
same => n,Audiosocket(${firstShop.shopId},127.0.0.1:9092)
same => n,Hangup()
`;
    } else {
      extensionsContent += `exten => s,1,NoOp(No active shops configured)
same => n,Hangup()
`;
    }
    
    let changed = false;
    const configPath = '/home/raj/asterisk-config';
    
    const currentPjsip = fs.existsSync(`${configPath}/pjsip.conf`) ? fs.readFileSync(`${configPath}/pjsip.conf`, 'utf8') : '';
    const currentExtensions = fs.existsSync(`${configPath}/extensions.conf`) ? fs.readFileSync(`${configPath}/extensions.conf`, 'utf8') : '';
    
    if (currentPjsip.trim() !== pjsipContent.trim()) {
      console.log('[sync] Configuration PJSIP changed, writing new config...');
      fs.writeFileSync(`${configPath}/pjsip.conf`, pjsipContent);
      changed = true;
    }
    
    if (currentExtensions.trim() !== extensionsContent.trim()) {
      console.log('[sync] Configuration Dialplan changed, writing new config...');
      fs.writeFileSync(`${configPath}/extensions.conf`, extensionsContent);
      changed = true;
    }
    
    if (changed) {
      console.log('[sync] Reloading Asterisk configuration inside container...');
      exec('docker exec asterisk asterisk -rx "pjsip reload" && docker exec asterisk asterisk -rx "dialplan reload"', (err, stdout, stderr) => {
        if (err) {
          console.error('[sync] Failed to reload Asterisk:', err.message);
        } else {
          console.log('[sync] Asterisk reloaded successfully.');
        }
      });
    } else {
      console.log('[sync] Configuration is up to date.');
    }
    
  } catch (err) {
    console.error('[sync] Error during sync:', err.message);
  }
}

// Run immediately, then periodically
sync();
setInterval(sync, SYNC_INTERVAL);
SYNC_EOF

# 5. Create bridge.js
cat << 'BRIDGE_EOF' > bridge.js
const net = require('net');
const WebSocket = require('ws');

const AUDIOSOCKET_PORT = 9092;
const KOTHABOT_WSS_URL = process.env.KOTHABOT_WSS_URL || 'wss://voice-server.up.railway.app'; 

function bufferToUuid(buf) {
  if (buf.length !== 16) return null;
  const hex = buf.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join('-');
}

function upscale8To24(buffer) {
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const input = new Int16Array(ab);
  const output = new Int16Array(input.length * 3);
  for (let i = 0; i < input.length; i++) {
    const val = input[i];
    output[i * 3] = val;
    output[i * 3 + 1] = val;
    output[i * 3 + 2] = val;
  }
  return Buffer.from(output.buffer, output.byteOffset, output.byteLength);
}

function downscale24To8(buffer) {
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const input = new Int16Array(ab);
  const output = new Int16Array(Math.floor(input.length / 3));
  for (let i = 0; i < output.length; i++) {
    output[i] = Math.round((input[i * 3] + input[i * 3 + 1] + input[i * 3 + 2]) / 3);
  }
  return Buffer.from(output.buffer, output.byteOffset, output.byteLength);
}

const tcpServer = net.createServer((socket) => {
  console.log('[bridge] New call connected from Asterisk Audiosocket');

  let ws = null;
  let wsReady = false;
  let shopId = null;
  let buffer = Buffer.alloc(0);
  let pendingAudioQueue = [];

  function initializeWs(targetShopId) {
    shopId = targetShopId;
    console.log(`[bridge] Initializing connection to KothaBot for shop: ${shopId}`);

    ws = new WebSocket(KOTHABOT_WSS_URL, {
      headers: {
        Origin: 'http://localhost'
      }
    });

    ws.on('open', () => {
      console.log(`[bridge] Connected to KothaBot Voice Server for shop: ${shopId}`);
      ws.send(JSON.stringify({
        type: 'START_SESSION',
        shopId: shopId,
        config: {
          shopId: shopId,
          language: 'bn',
          voice: 'Aoede',
        }
      }));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'SESSION_READY') {
          wsReady = true;
          console.log('[bridge] Voice AI session is ready');
          while (pendingAudioQueue.length > 0) {
            const pcm24 = pendingAudioQueue.shift();
            ws.send(JSON.stringify({
              type: 'AUDIO_CHUNK',
              data: pcm24.toString('base64')
            }));
          }
        } else if (msg.type === 'AUDIO_CHUNK') {
          const pcm24 = Buffer.from(msg.data, 'base64');
          const pcm8 = downscale24To8(pcm24);
          const header = Buffer.alloc(3);
          header.writeUInt8(0x10, 0);
          header.writeUInt16BE(pcm8.length, 1);
          socket.write(header);
          socket.write(pcm8);
        }
      } catch (err) {}
    });

    ws.on('close', () => {
      console.log('[bridge] Cloud WebSocket connection closed');
      socket.destroy();
    });

    ws.on('error', (err) => console.error('[bridge] ws error:', err.message));
  }

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    
    while (buffer.length >= 3) {
      const type = buffer.readUInt8(0);
      const length = buffer.readUInt16BE(1);
      
      if (buffer.length < 3 + length) break;
      
      const payload = buffer.slice(3, 3 + length);
      buffer = buffer.slice(3 + length);
      
      if (type === 0x01) {
        const parsedUuid = bufferToUuid(payload);
        if (parsedUuid) {
          initializeWs(parsedUuid);
        } else {
          console.error('[bridge] Failed to parse UUID frame from Audiosocket');
          socket.destroy();
        }
      } else if (type === 0x10) {
        const pcm24 = upscale8To24(payload);
        if (wsReady && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'AUDIO_CHUNK',
            data: pcm24.toString('base64')
          }));
        } else if (shopId) {
          pendingAudioQueue.push(pcm24);
        }
      }
    }
  });

  socket.on('close', () => {
    console.log('[bridge] Call hung up');
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'END_SESSION' }));
      ws.close();
    }
  });

  socket.on('error', (err) => console.error('[bridge] socket error:', err.message));
});

tcpServer.listen(AUDIOSOCKET_PORT, '0.0.0.0', () => {
  console.log(`🎙️  KothaBot Multi-Tenant SIP-to-WebSocket Bridge Listening on port ${AUDIOSOCKET_PORT}`);
});
BRIDGE_EOF

# 6. Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
  echo "Installing PM2 globally..."
  sudo npm install -g pm2
fi

# 7. Start services under PM2
echo "Starting services under PM2..."
pm2 delete kothabot-sync || true
pm2 delete kothabot-bridge || true

# Load env variables when starting PM2 processes
pm2 start sync_telephony.js --name "kothabot-sync" --update-env
pm2 start bridge.js --name "kothabot-bridge" --update-env
pm2 save

echo "Configuring PM2 startup..."
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u raj --hp /home/raj || true

echo "=== PM2 Status ==="
pm2 status

echo "=== Bridge Setup Completed Successfully ==="
