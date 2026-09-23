export interface AgentProfile {
  name: "scout";
  description: string;
  allowedTools: readonly string[];
  systemPromptUrl: URL;
}

const SCOUT_PROFILE: AgentProfile = {
  name: "scout",
  description: "Read-only repository reconnaissance and evidence collection",
  allowedTools: ["read", "grep", "find", "ls"],
  systemPromptUrl: new URL("../../prompts/scout.system.md", import.meta.url),
};

export function getAgentProfile(name: string): AgentProfile {
  if (name !== "scout") {
    throw new Error(`unknown agent profile: ${name}`);
  }
  return SCOUT_PROFILE;
}
