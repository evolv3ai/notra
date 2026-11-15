import { ONBOARD_MD_URL } from "@/constants/connect-agent";

export function getConnectAgentPrompt(
  organization: { name: string; slug: string } | null
) {
  const prompt = `Set up Notra for me: read ${ONBOARD_MD_URL} and follow the steps.`;
  if (!organization) {
    return prompt;
  }
  // JSON.stringify keeps quotes and line breaks in the name from reading as
  // extra instructions to the agent.
  return `${prompt} Connect it to my Notra organization ${JSON.stringify(organization.name)} (${organization.slug}).`;
}
