/** Preview-only live Discord role check. Bot token stays server-side. */
const GUILD = "1463804285681926373";
const ROLE = "1506624152541466685";
export async function checkDiscordCurrentRole(discordUserId, botToken, fetcher = fetch) {
  if (!/^\d{15,22}$/.test(discordUserId)) return false;
  if (typeof botToken !== "string" || !/^[a-zA-Z0-9._-]{20,}$/.test(botToken)) return false;
  try {
    const response = await fetcher("https://discord.com/api/v10/guilds/" + GUILD + "/members/" + discordUserId, {
      method:"GET",cache:"no-store",
      headers:{Authorization:"Bot " + botToken,Accept:"application/json"},
      signal:AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const member = await response.json();
    return member?.user?.id === discordUserId &&
      member?.pending !== true &&
      Array.isArray(member?.roles) &&
      member.roles.every(role => typeof role === "string") &&
      member.roles.includes(ROLE);
  } catch { return false; }
}
