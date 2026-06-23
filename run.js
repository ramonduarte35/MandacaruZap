import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

const localBinPath = path.join(__dirname, 'node-env', 'bin');
const hasLocalNode = fs.existsSync(localBinPath);

// Prepara o PATH incluindo a pasta bin local para que comandos como 'node', 'npx', etc. sejam resolvidos localmente
const env = { ...process.env };
if (hasLocalNode) {
  env.PATH = `${localBinPath}${path.delimiter}${env.PATH || ''}`;
}

const npmCmd = hasLocalNode ? path.join(localBinPath, 'npm') : 'npm';

const services = [
  {
    name: 'backend',
    color: colors.cyan,
    cwd: path.join(__dirname, 'backend'),
    cmd: npmCmd,
    args: ['run', 'dev'],
  },
  {
    name: 'worker',
    color: colors.magenta,
    cwd: path.join(__dirname, 'worker'),
    cmd: npmCmd,
    args: ['run', 'dev'],
  },
  {
    name: 'frontend',
    color: colors.green,
    cwd: path.join(__dirname, 'frontend'),
    cmd: npmCmd,
    args: ['run', 'dev'],
  },
];

const children = [];
let isCleaningUp = false;

function prefixLog(serviceName, color, streamName, data) {
  const prefix = `${color}[${serviceName}]${colors.reset}`;
  const text = data.toString();
  const lines = text.split('\n');
  
  if (lines.length > 1 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  
  for (const line of lines) {
    if (streamName === 'stderr') {
      console.error(`${prefix} ${colors.red}${line}${colors.reset}`);
    } else {
      console.log(`${prefix} ${line}`);
    }
  }
}

console.log(`${colors.yellow}Iniciando serviços do MandacaruZap sem Docker...${colors.reset}\n`);

for (const svc of services) {
  console.log(`${colors.yellow}Iniciando ${svc.name}...${colors.reset}`);
  
  const child = spawn(svc.cmd, svc.args, {
    cwd: svc.cwd,
    shell: true,
    env,
  });
  
  children.push(child);
  
  child.stdout.on('data', (data) => {
    prefixLog(svc.name, svc.color, 'stdout', data);
  });
  
  child.stderr.on('data', (data) => {
    prefixLog(svc.name, svc.color, 'stderr', data);
  });
  
  child.on('close', (code) => {
    if (!isCleaningUp) {
      console.log(`\n${svc.color}[${svc.name}]${colors.reset} Processo encerrado com código ${code}`);
      cleanup();
    }
  });
}

function cleanup() {
  if (isCleaningUp) return;
  isCleaningUp = true;
  console.log(`\n${colors.yellow}Finalizando todos os serviços...${colors.reset}`);
  for (const child of children) {
    if (child && !child.killed) {
      try {
        child.kill('SIGINT');
      } catch (err) {
        // Ignorar se já estiver finalizado
      }
    }
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
