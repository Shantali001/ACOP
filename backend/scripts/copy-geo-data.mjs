import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(scriptDir, '..', 'src', 'geo', 'nigeria-states-lgas.json');
const destinationPath = join(scriptDir, '..', 'dist', 'geo', 'nigeria-states-lgas.json');

mkdirSync(dirname(destinationPath), { recursive: true });
copyFileSync(sourcePath, destinationPath);
