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
    'OPENAI_MAX_COMPLETION_TOKENS': ['openai', 'max_completion_tokens'],
    'OPENAI_TEMPERATURE': ['openai', 'temperature'],
    'OPENAI_PASS_NOTE_TO_OPENAI': ['openai', 'pass_note_to_openai'],
    'OPENAI_WEB_SEARCH_OPTIONS': ['openai', 'web_search_options'],
    'PORT': ['app', 'port'],
    'ENABLE_UI': ['app', 'enable_ui'],
    'FILTER_MIN_AMOUNT': ['filters', 'min_amount'],
    'FILTER_MAX_AMOUNT': ['filters', 'max_amount'],
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
    if (envVarName in process.env && process.env[envVarName] != null) {
        const envValue = process.env[envVarName];
        
        // Try to parse JSON for arrays and objects (with additional validation)
        const trimmedValue = envValue.trim();
        if ((trimmedValue.startsWith('[') && trimmedValue.endsWith(']')) || 
            (trimmedValue.startsWith('{') && trimmedValue.endsWith('}'))) {
            try {
                return JSON.parse(trimmedValue);
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

/**
 * Get OpenAI configuration with support for environment variables and config file
 * This function returns the raw value without string conversion (useful for numbers and objects)
 * Priority: 1. Environment variable (if set), 2. Config file, 3. Default value
 */
export function getOpenAiConfig(configName, defaultValue = null) {
    // Check environment variable first
    const envVarName = `OPENAI_${configName.toUpperCase()}`;
    if (envVarName in process.env && process.env[envVarName] != null) {
        const envValue = process.env[envVarName];
        
        // Handle explicit "null" string value to allow omitting parameters
        const trimmedValue = envValue.trim();
        if (trimmedValue.toLowerCase() === 'null' || trimmedValue === '') {
            return null;
        }
        
        // Try to parse JSON for objects (with additional validation)
        // Note: Only objects are supported, not arrays, as OpenAI config parameters are objects
        if ((trimmedValue.startsWith('{') && trimmedValue.endsWith('}'))) {
            try {
                return JSON.parse(trimmedValue);
            } catch (e) {
                console.warn(`Failed to parse ${envVarName} as JSON, using as string:`, e.message);
                return envValue;
            }
        }
        
        // Try to parse as number (only if it's a valid numeric string)
        if (trimmedValue !== '' && !isNaN(trimmedValue)) {
            return parseFloat(trimmedValue);
        }
        
        // Return as string
        return envValue;
    }
    
    // Check config file
    if (configFileData && configFileData.openai) {
        const value = configFileData.openai[configName];
        if (value !== undefined) {
            return value;
        }
    }
    
    // Return default value
    return defaultValue;
}

/**
 * Validate web_search_options object
 * Ensures all required fields for the web_search_options parameter are provided
 * According to OpenAI API docs, the structure is:
 * {
 *   user_location: {
 *     type: "approximate",
 *     approximate: {
 *       country: "US",  // required
 *       city: "...",    // optional
 *       region: "..."   // optional
 *     }
 *   }
 * }
 * @param {object} webSearchOptions - The web search options object to validate
 * @returns {boolean} - Whether the object is valid
 * @throws {Error} - If validation fails
 */
export function validateWebSearchOptions(webSearchOptions) {
    if (!webSearchOptions) {
        return true; // null/undefined is valid (parameter is optional)
    }
    
    if (typeof webSearchOptions !== 'object') {
        throw new Error('web_search_options must be an object');
    }
    
    // Validate user_location if provided
    if (webSearchOptions.user_location) {
        if (typeof webSearchOptions.user_location !== 'object') {
            throw new Error('web_search_options.user_location must be an object');
        }
        
        // Validate required field: type
        if (!webSearchOptions.user_location.type) {
            throw new Error('web_search_options.user_location.type is required (must be "approximate")');
        }
        
        if (webSearchOptions.user_location.type !== 'approximate') {
            throw new Error('web_search_options.user_location.type must be "approximate"');
        }
        
        // Validate required field: approximate
        if (!webSearchOptions.user_location.approximate) {
            throw new Error('web_search_options.user_location.approximate is required');
        }
        
        if (typeof webSearchOptions.user_location.approximate !== 'object') {
            throw new Error('web_search_options.user_location.approximate must be an object');
        }
        
        // Validate required field: approximate.country
        if (!webSearchOptions.user_location.approximate.country) {
            throw new Error('web_search_options.user_location.approximate.country is required');
        }
        
        if (typeof webSearchOptions.user_location.approximate.country !== 'string') {
            throw new Error('web_search_options.user_location.approximate.country must be a string');
        }
    }
    
    return true;
}