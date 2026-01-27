# Firefly III AI categorization

This project allows you to automatically categorize your expenses in [Firefly III](https://www.firefly-iii.org/) by
using OpenAI.

## Please fork me
Unfortunately i am not able to invest more time into maintaining this project. 

Feel free to fork it and create a PR that adds a link to your fork in the README file.

## How it works

It provides a webhook that you can set up to be called every time a new expense is added.

It will then generate a prompt for OpenAI, including your existing categories, the recipient and the description of the
transaction.

OpenAI will, based on that prompt, guess the category for the transaction.

If it is one of your existing categories, the tool will set the category on the transaction and also add a tag to the
transaction.

If it cannot detect the category, it will not update anything.

## Privacy

Please note that some details of the transactions will be sent to OpenAI as information to guess the category.

These are:

- Transaction description
- Name of transaction destination account
- Names of all categories

## Installation

### 1. Get a Firefly Personal Access Token

You can generate your own Personal Access Token on the Profile page. Login to your Firefly III instance, go to
"Options" > "Profile" > "OAuth" and find "Personal Access Tokens". Create a new Personal Access Token by clicking on
"Create New Token". Give it a recognizable name and press "Create". The Personal Access Token is pretty long. Use a tool
like Notepad++ or Visual Studio Code to copy-and-paste it.

![Step 1](docs/img/pat1.png)
![Step 2](docs/img/pat2.png)
![Step 3](docs/img/pat3.png)

### 2. Get an OpenAI API Key

The project needs to be configured with your OpenAI account's secret key.

- Sign up for an account by going to the OpenAI website (https://platform.openai.com)
- Once an account is created, visit the API keys page at https://platform.openai.com/account/api-keys.
- Create a new key by clicking the "Create new secret key" button.

When an API key is created you'll be able to copy the secret key and use it.

![OpenAI screenshot](docs/img/openai-key.png)

Note: OpenAI currently provides 5$ free credits for 3 months which is great since you won’t have to provide your
payment details to begin interacting with the API for the first time.

After that you have to enable billing in your account.

Tip: Make sure to set budget limits to prevent suprises at the end of the month.

### 3. Start the application via Docker

#### Configuration Methods

The application supports two ways of configuration:

**Option A: Configuration File (Recommended)**

1. Copy the example configuration file:
   ```bash
   cp config.example.yaml config.yaml
   ```

2. Edit `config.yaml` with your actual values:
   ```yaml
   firefly:
     url: "https://firefly.example.com"
     personal_token: "eyabc123..."
   
   openai:
     api_key: "sk-abc123..."
     model: "gpt-4o-mini"
   ```

3. Mount the config file when running the container (see examples below)

**Option B: Environment Variables**

You can also use environment variables for configuration. Environment variables will override values from the config file if both are present.

#### 3.1 Docker Compose (with config file)

Create a new file `docker-compose.yml` with this content (or add to existing docker-compose file):

```yaml
version: '3.3'

services:
  categorizer:
    image: ghcr.io/bahuma20/firefly-iii-ai-categorize:latest
    restart: always
    ports:
      - "3000:3000"
    volumes:
      - ./config.yaml:/app/config.yaml:ro
```

Alternatively, you can still use environment variables:

```yaml
version: '3.3'

services:
  categorizer:
    image: ghcr.io/bahuma20/firefly-iii-ai-categorize:latest
    restart: always
    ports:
      - "3000:3000"
    environment:
      FIREFLY_URL: "https://firefly.example.com"
      FIREFLY_PERSONAL_TOKEN: "eyabc123..."
      OPENAI_API_KEY: "sk-abc123..."
```

Run `docker-compose up -d`.

Now the application is running and accessible at port 3000.

#### 3.2 Manually via Docker (with config file)

First, create your `config.yaml` file in the current directory. Then run:

```shell
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/config.yaml:/app/config.yaml:ro \
  ghcr.io/bahuma20/firefly-iii-ai-categorize:latest
```

Alternatively, you can still use environment variables:

```shell
docker run -d \
  -p 3000:3000 \
  -e FIREFLY_URL=https://firefly.example.com \
  -e FIREFLY_PERSONAL_TOKEN=eyabc123... \
  -e OPENAI_API_KEY=sk-abc123... \
  ghcr.io/bahuma20/firefly-iii-ai-categorize:latest
```

### 4. Set up the webhook

After starting your container, you have to set up the webhook in Firefly that will automatically trigger the
categorization everytime a new transaction comes in.

- Login to your Firefly instance
- In the sidebar go to "Automation" > "Webhooks"
- Click "Create new webhook"
- Give the webhook a title. For example "AI Categorizer"
- Set "Trigger" to "After transaction creation" (should be the default)
- Set "Response" to "Transaction details" (should be the default)
- Set "Delivery" to "JSON" (should be the default)
- Set "URL" to the URL where the application is reachable + "/webhook". For example if you are using docker-compose your
  URL could look like this: `http://categorizer:3000/webhook`
- Click "Submit"

![Step 1](docs/img/webhook1.png)
![Step 2](docs/img/webhook2.png)
![Step 3](docs/img/webhook3.png)

Now you are ready and every new withdrawal transaction should be automatically categorized by OpenAI.

## User Interface

The application comes with a minimal UI that allows you to monitor the classification queue and see the OpenAI prompts
and responses. This UI is disabled by default.

To enable this UI set the environment variable `ENABLE_UI` to `true`.

After a restart of the application the UI can be accessed at `http://localhost:3000/` (or any other URL that allows you
to reach the container).

## Adjust Tag name

The application automatically sets the tag "AI categorized" on every transaction that was processed and a category could
be guessed.

You can configure the name of this tag by setting the environment variable `FIREFLY_TAG` accordingly.

## Running on a different port

If you have to run the application on a different port than the default port `3000` set the environment variable `PORT`.

## Configuration

### Configuration File (Recommended)

The application can be configured using a `config.yaml` file. Copy the `config.example.yaml` to `config.yaml` and update it with your values:

```yaml
firefly:
  url: "https://firefly.example.com"
  personal_token: "your-token-here"
  tag: "AI categorized"

openai:
  api_key: "your-api-key-here"
  model: "gpt-4o-mini"

app:
  port: 3000
  enable_ui: false
```

Mount this file to `/app/config.yaml` in your Docker container.

You can also customize the config file location using the `CONFIG_FILE_PATH` environment variable:

```shell
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/my-config.yaml:/app/my-config.yaml:ro \
  -e CONFIG_FILE_PATH=/app/my-config.yaml \
  ghcr.io/bahuma20/firefly-iii-ai-categorize:latest
```

### Environment Variables (Alternative)

You can also use environment variables for configuration. Environment variables will **override** values from the config file if both are present.

## Full list of configuration options

- `CONFIG_FILE_PATH`: Path to the configuration file. (Default: `/app/config.yaml`)
- `FIREFLY_URL` / `firefly.url`: The URL to your Firefly III instance. Example: `https://firefly.example.com`. (required)
- `FIREFLY_PERSONAL_TOKEN` / `firefly.personal_token`: A Firefly III Personal Access Token. (required)
- `OPENAI_API_KEY` / `openai.api_key`: The OpenAI API Key to authenticate against OpenAI. (required)
- `OPENAI_MODEL` / `openai.model`: The OpenAI model to use for categorization. (Default: `gpt-4o-mini`) See [Model Selection](#model-selection) for details.
- `ENABLE_UI` / `app.enable_ui`: If the user interface should be enabled. (Default: `false`)
- `FIREFLY_TAG` / `firefly.tag`: The tag to assign to the processed transactions. (Default: `AI categorized`)
- `PORT` / `app.port`: The port where the application listens. (Default: `3000`)

**Note:** For each option, you can use either the environment variable format (e.g., `FIREFLY_URL`) or the config file path (e.g., `firefly.url`).

## Model Selection

The application now uses modern OpenAI chat models for better performance and cost-efficiency. The default model is `gpt-4o-mini`, which provides excellent accuracy at a lower cost compared to legacy models.

### Recommended Models

- **gpt-4o-mini** (default): Best balance of cost and performance for most users. Cheaper and faster than the legacy model.
- **gpt-4o**: Most capable model, recommended if you need higher accuracy or have complex categorization needs.
- **gpt-3.5-turbo**: A more economical alternative to gpt-4o-mini, still more modern than the legacy model.

You can configure the model by setting the `OPENAI_MODEL` environment variable:

```yaml
environment:
  OPENAI_MODEL: "gpt-4o-mini"  # or "gpt-4o", "gpt-3.5-turbo"
```

### Migration from Legacy Model

If you were previously using this application, it has been upgraded from the legacy `gpt-3.5-turbo-instruct` model to modern chat completion models. The new default model (`gpt-4o-mini`) is:
- More accurate and capable
- Faster response times
- More cost-effective (lower pricing per token)
- Better maintained and future-proof

No configuration changes are required - the application will automatically use the new model. However, if you prefer a different model, you can set the `OPENAI_MODEL` environment variable as described above.
