#!/usr/bin/env node
// Register the global /audiobirdle command for the Discord app.
//
// Usage:
//   DISCORD_CLIENT_ID=<app id> DISCORD_BOT_TOKEN=<bot token> \
//     node scripts/register-discord-command.mjs
//
// The bot token is only read from the environment; never commit it.

const appId = process.env.DISCORD_CLIENT_ID;
const token = process.env.DISCORD_BOT_TOKEN;

if (!appId || !token) {
  console.error(
    "Set DISCORD_CLIENT_ID and DISCORD_BOT_TOKEN in the environment before running.",
  );
  process.exit(1);
}

const command = {
  name: "audiobirdle",
  description: "Play Audio-Birdle with friends",
  type: 1,
  integration_types: [0],
  contexts: [0],
};

const response = await fetch(
  `https://discord.com/api/v10/applications/${appId}/commands`,
  {
    method: "PUT",
    headers: {
      authorization: `Bot ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify([command]),
  },
);

if (!response.ok) {
  console.error(`Command registration failed: ${response.status}`);
  console.error(await response.text());
  process.exit(1);
}

const registered = await response.json();
console.log(
  `Registered ${registered.length} command(s): ${registered
    .map((item) => `/${item.name}`)
    .join(", ")}`,
);
