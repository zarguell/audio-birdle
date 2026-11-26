#!/usr/bin/env node
// Register the global Audio-Birdle commands for the Discord app.
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

const base = {
  type: 1,
  integration_types: [0],
  contexts: [0],
};

const commands = [
  {
    ...base,
    name: "audiobirdle",
    description: "Play Audio-Birdle with friends",
  },
  {
    ...base,
    name: "audiobirdle-setup",
    description: "Post daily Audio-Birdle summaries in a channel",
    default_member_permissions: "32",
    options: [
      {
        type: 7,
        name: "channel",
        description: "Channel where daily summaries are posted",
        required: true,
        channel_types: [0],
      },
    ],
  },
  {
    ...base,
    name: "audiobirdle-stats",
    description: "Show your Audio-Birdle record",
  },
  {
    ...base,
    name: "audiobirdle-forget",
    description: "Delete your stored Audio-Birdle data",
  },
];

const response = await fetch(
  `https://discord.com/api/v10/applications/${appId}/commands`,
  {
    method: "PUT",
    headers: {
      authorization: `Bot ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(commands),
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
