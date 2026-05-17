export function getPartyHost(): string {
  const env = import.meta.env.VITE_PARTYKIT_HOST as string | undefined;
  if (env && env.length > 0) return env;
  // Default to localhost partykit dev
  return "127.0.0.1:1999";
}
