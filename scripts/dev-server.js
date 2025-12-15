#!/usr/bin/env node
import { spawn } from 'node:child_process';

const devPort = process.env.VITE_PORT || '3000';
const relayPort = process.env.PORT || '8080';
const children = [];
let shuttingDown = false;

function spawnProcess(command, args, name) {
  console.log(`[dev-server] starting ${name}...`);
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_PORT: devPort,
      PORT: relayPort,
    },
  });

  child.on('exit', (code, signal) => {
    console.log(`[dev-server] ${name} exited with code ${code ?? 'null'}${signal ? ` (signal ${signal})` : ''}`);
    if (!shuttingDown) {
      shuttingDown = true;
      terminateChildren(child);
      process.exit(code ?? 0);
    }
  });

  child.on('error', (err) => {
    console.error(`[dev-server] ${name} failed:`, err);
  });

  children.push(child);
  return child;
}

function terminateChildren(skipChild) {
  for (const child of children) {
    if (child === skipChild) continue;
    if (child.exitCode === null && !child.killed) {
      child.kill(process.platform === 'win32' ? undefined : 'SIGTERM');
    }
  }
}

function handleSignal(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[dev-server] Received ${signal}. Shutting down...`);
  terminateChildren();
  process.exit(0);
}

process.on('SIGINT', handleSignal);
process.on('SIGTERM', handleSignal);

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

spawnProcess(npmCommand, ['run', 'dev:relay'], 'relay');
spawnProcess(npmCommand, ['run', 'dev:vite'], 'vite');
spawnProcess('node', ['scripts/table-editor-save-server.js'], 'table-editor-save-server');
