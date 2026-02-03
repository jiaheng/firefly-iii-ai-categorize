import OpenAI from "openai";
import {getConfigVariable, getOpenAiConfig, validateWebSearchOptions} from "./util.js";

export default class OpenAiService {
    #openAi;
    #model;
    #maxCompletionTokens;
    #temperature;
    #webSearchOptions;

    constructor() {
        const apiKey = getConfigVariable("OPENAI_API_KEY");
        // Default to gpt-4o-mini (modern, cheaper, faster) but allow configuration
        this.#model = getConfigVariable("OPENAI_MODEL", "gpt-4o-mini");
        
        // Get max_completion_tokens from config (default: 5000)
        this.#maxCompletionTokens = getOpenAiConfig("max_completion_tokens", 5000);
        
        // Get temperature from config (default: 0.3)
        this.#temperature = getOpenAiConfig("temperature", 0.3);
        
        // Get web_search_options from config (default: null)
        this.#webSearchOptions = getOpenAiConfig("web_search_options", null);
        
        // Validate web_search_options if provided
        try {
            validateWebSearchOptions(this.#webSearchOptions);
        } catch (error) {
            console.error('Invalid web_search_options configuration:', error.message);
            throw error;
        }

        this.#openAi = new OpenAI({
            apiKey
        });
    }

    async classify(categories, destinationName, description, note = null) {
        try {
            const userPrompt = this.#generatePrompt(categories, destinationName, description, note);

            const requestParams = {
                model: this.#model,
                instructions: "You are a financial transaction categorization assistant. Your task is to categorize bank transactions into predefined categories. You must respond with ONLY the exact category name from the provided list, nothing else.",
                input: userPrompt,
                max_output_tokens: this.#maxCompletionTokens
            };
            
            // Add temperature if configured (omit if null to support models that don't accept it)
            if (this.#temperature !== null && this.#temperature !== undefined) {
                requestParams.temperature = this.#temperature;
            }
            
            // Add web_search_options if configured
            if (this.#webSearchOptions) {
                requestParams.web_search_options = this.#webSearchOptions;
            }

            const response = await this.#openAi.responses.create(requestParams);

            // Validate response structure
            if (!response.output_text) {
                console.error('Invalid response structure from OpenAI:', JSON.stringify(response));
                return null;
            }

            const messageContent = response.output_text;
            let guess = messageContent.replace(/[\n\r]+/g, "").trim();

            if (categories.indexOf(guess) === -1) {
                console.warn(`OpenAI could not classify the transaction. Prompt: ${userPrompt}, OpenAI's guess: ${guess}`);
                return null;
            }

            return {
                prompt: userPrompt,
                response: messageContent,
                category: guess
            };

        } catch (error) {
            if (error.response) {
                console.error(error.response.status);
                console.error(error.response.data);
                throw new OpenAiException(error.response.status, error.response, error.response.data);
            } else {
                console.error(error.message);
                throw new OpenAiException(null, null, error.message);
            }
        }
    }

    #generatePrompt(categories, destinationName, description, note = null) {
        let prompt = `Given I want to categorize transactions on my bank account into these categories: ${categories.join(", ")}
In which category would a transaction from "${destinationName}" with the subject "${description}"`;
        
        if (note) {
            prompt += ` and note "${note}"`;
        }
        
        prompt += ` fall into?
Just output the category name.`;
        
        return prompt;
    }
}

class OpenAiException extends Error {
    code;
    response;
    body;

    constructor(statusCode, response, body) {
        super(`Error while communicating with OpenAI: ${statusCode} - ${body}`);

        this.code = statusCode;
        this.response = response;
        this.body = body;
    }
}