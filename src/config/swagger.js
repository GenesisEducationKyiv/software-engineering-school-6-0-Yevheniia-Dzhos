import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadSwaggerDocument() {
    return yaml.load(
        fs.readFileSync(path.join(__dirname, '..', '..', 'swagger.yaml'), 'utf8')
    );
}