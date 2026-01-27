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
    'ENABLE_UI': ['app', 'enable_ui'],
    'FILTER_MIN_AMOUNT': ['filters', 'min_amount'],
    'FILTER_EXCLUDE_DESTINATIONS': ['filters', 'exclude_destinations']
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

/**
 * Get filter configuration with support for environment variables and config file
 * This function returns the raw value without string conversion (useful for arrays and numbers)
 * Priority: 1. Environment variable (if set), 2. Config file, 3. Default value
 */
export function getFilterConfig(filterName, defaultValue = null) {
    // Check environment variable first (for consistency with getConfigVariable)
    // Environment variables for filters use FILTER_ prefix
    const envVarName = `FILTER_${filterName.toUpperCase()}`;
    if (process.env.hasOwnProperty(envVarName) && process.env[envVarName] != null) {
        const envValue = process.env[envVarName];
        
        // Try to parse JSON for arrays and objects
        if (envValue.startsWith('[') || envValue.startsWith('{')) {
            try {
                return JSON.parse(envValue);
            } catch (e) {
                console.warn(`Failed to parse ${envVarName} as JSON, using as string:`, e.message);
                return envValue;
            }
        }
        
        // Try to parse as number (only if it's a valid numeric string)
        if (envValue.trim() !== '' && !isNaN(envValue)) {
            return parseFloat(envValue);
        }
        
        // Return as string
        return envValue;
    }
    
    // Check config file
    if (configFileData && configFileData.filters) {
        const value = configFileData.filters[filterName];
        if (value !== undefined) {
            return value;
        }
    }
    
    // Return default value
    return defaultValue;
}