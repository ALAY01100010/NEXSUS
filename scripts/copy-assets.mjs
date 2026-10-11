// Made by Alay
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist/renderer', { recursive: true });
await copyFile('index.html', 'dist/index.html');
await copyFile('src/renderer/style.css', 'dist/renderer/style.css');

await mkdir('dist/assets', { recursive: true });
await copyFile('src/assets/nexsus-logo.png', 'dist/assets/nexsus-logo.png');
