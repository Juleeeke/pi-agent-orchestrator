const BASE_KEYS = [
  "HOME",
  "PATH",
  "TMPDIR",
  "LANG",
  "LC_ALL",
  "SHELL",
  "TERM",
  "COLORTERM",
  "PI_CODING_AGENT_DIR",
] as const;

const PROVIDER_KEYS = [
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_OAUTH_TOKEN",
  "OPENAI_API_KEY",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_BASE_URL",
  "AZURE_OPENAI_RESOURCE_NAME",
  "AZURE_OPENAI_API_VERSION",
  "AZURE_OPENAI_DEPLOYMENT_NAME_MAP",
  "DEEPSEEK_API_KEY",
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
  "CEREBRAS_API_KEY",
  "XAI_API_KEY",
  "FIREWORKS_API_KEY",
  "TOGETHER_API_KEY",
  "OPENROUTER_API_KEY",
  "ZAI_API_KEY",
  "ZAI_CODING_CN_API_KEY",
  "MISTRAL_API_KEY",
  "MINIMAX_API_KEY",
  "MOONSHOT_API_KEY",
  "OPENCODE_API_KEY",
  "KIMI_API_KEY",
  "QWEN_TOKEN_PLAN_API_KEY",
  "QWEN_TOKEN_PLAN_CN_API_KEY",
  "XIAOMI_API_KEY",
  "XIAOMI_TOKEN_PLAN_CN_API_KEY",
  "XIAOMI_TOKEN_PLAN_AMS_API_KEY",
  "XIAOMI_TOKEN_PLAN_SGP_API_KEY",
] as const;

export function sanitizeChildEnvironment(
  source: NodeJS.ProcessEnv,
  extraKeys: readonly string[] = [],
): NodeJS.ProcessEnv {
  const target: NodeJS.ProcessEnv = {
    PI_OFFLINE: "1",
    PI_TELEMETRY: "0",
  };

  for (const key of [...BASE_KEYS, ...PROVIDER_KEYS, ...extraKeys]) {
    const value = source[key];
    if (value !== undefined) target[key] = value;
  }

  return target;
}
