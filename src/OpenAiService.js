import OpenAI from "openai";
import {getConfigVariable} from "./util.js";

export default class OpenAiService {
    #openAi;
    #model;

    constructor() {
        const apiKey = getConfigVariable("OPENAI_API_KEY");
        // Default to gpt-4o-mini (modern, cheaper, faster) but allow configuration
        this.#model = getConfigVariable("OPENAI_MODEL", "gpt-4o-mini");

        this.#openAi = new OpenAI({
            apiKey
        });
    }

    async classify(categories, destinationName, description) {
        try {
            const userPrompt = this.#generatePrompt(categories, destinationName, description);

            const response = await this.#openAi.chat.completions.create({
                model: this.#model,
                messages: [
                    {
                        role: "system",
                        content: "You are a financial transaction categorization assistant. Your task is to categorize bank transactions into predefined categories. You must respond with ONLY the exact category name from the provided list, nothing else."
                    },
                    {
                        role: "user",
                        content: userPrompt
                    }
                ],
                temperature: 0.3, // Lower temperature for more consistent categorization
                max_tokens: 50 // Keep responses short
            });

            // Validate response structure
            if (!response.choices || !response.choices[0] || !response.choices[0].message || !response.choices[0].message.content) {
                console.error('Invalid response structure from OpenAI:', JSON.stringify(response));
                return null;
            }

            const messageContent = response.choices[0].message.content;
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

    #generatePrompt(categories, destinationName, description) {
        return `Given I want to categorize transactions on my bank account into these categories: ${categories.join(", ")}
In which category would a transaction from "${destinationName}" with the subject "${description}" fall into?
Just output the category name.`;
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