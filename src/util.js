import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MissingEnvironmentVariableException extends Error {
    variableName;

    constructor(variableName) {
        super(`The required environment variable '${variableName}' is missing`);

        this.variableName = variableName;
    }
}

// Load configuration from config.yaml if it exists
let configFileData = null;
const configPath = process.env.CONFIG_FILE_PATH || path.join(__dirname, '..', 'config.yaml');

try {
    if (fs.existsSync(configPath)) {
        const fileContents = fs.readFileSync(configPath, 'utf8');
        configFileData = yaml.load(fileContents);
        console.log('Configuration loaded from config.yaml');
    }
} catch (e) {
    console.warn('Failed to load config.yaml:', e.message);
}

// Mapping of environment variable names to config file paths
const CONFIG_MAPPINGS = {
    'FIREFLY_URL': ['firefly', 'url'],
    'FIREFLY_PERSONAL_TOKEN': ['firefly', 'personal_token'],
    'FIREFLY_TAG': ['firefly', 'tag'],
    'OPENAI_API_KEY': ['openai', 'api_key'],
    'OPENAI_MODEL': ['openai', 'model'],
    'PORT': ['app', 'port'],
    'ENABLE_UI': ['app', 'enable_ui']
};

function getFromConfigFile(name) {
    if (!configFileData) {
        return null;
    }

    const path = CONFIG_MAPPINGS[name];
    if (!path) {
        return null;
    }

    let value = configFileData;
    for (const key of path) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return null;
        }
    }

    // Convert to string for consistency with environment variables
    return value !== null && value !== undefined ? String(value) : null;
}

export function getConfigVariable(name, defaultValue = null) {
    // Priority: 1. Environment variable, 2. Config file, 3. Default value
    
    // Check environment variable first
    if (process.env.hasOwnProperty(name) && process.env[name] != null) {
        return process.env[name];
    }

    // Check config file
    const configValue = getFromConfigFile(name);
    if (configValue !== null) {
        return configValue;
    }

    // Use default value or throw error
    if (defaultValue == null) {
        throw new MissingEnvironmentVariableException(name)
    }

    return defaultValue;
}