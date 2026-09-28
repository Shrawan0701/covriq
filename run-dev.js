import { spawn } from 'child_process';
import path from 'path';

console.log('==================================================');
console.log('🚀 Launching CovrIQ Full-Stack Platform...');
console.log('==================================================');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

// 1. Start Backend Server
const serverProcess = spawn(npmCmd, ['--prefix', 'server', 'run', 'dev'], {
  stdio: 'inherit',
  shell: true
});

// 2. Start Frontend Client
const clientProcess = spawn(npmCmd, ['--prefix', 'client', 'run', 'dev'], {
  stdio: 'inherit',
  shell: true
});

const cleanup = () => {
  console.log('\nShutting down CovrIQ services...');
  serverProcess.kill();
  clientProcess.kill();
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
