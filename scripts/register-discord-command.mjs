#!/usr/bin/env node
// Register the Audio-Birdle commands for the Discord app.
//
// `/audiobirdle` is the PRIMARY_ENTRY_POINT command with APP_HANDLER (1), which
// is the only command type allowed to answer with LAUNCH_ACTIVITY (type 12).
// The admin commands stay ordinary CHAT_INPUT commands.
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

const BASE = `https://discord.com/api/v10/applications/${appId}/commands`;
const HEADERS = {
  authorization: `Bot ${token}`,
  "content-type": "application/json",
};

async function api(path = "", init = {}) {
  const response = await fetch(`${BASE}${path}`, { headers: HEADERS, ...init });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${init.method ?? "GET"} ${path || "/"} failed: ${response.status} ${body}`);
  }
  return response.status === 204 ? null : response.json();
}

const existing = await api();

// An Activity can only have one PRIMARY_ENTRY_POINT command. The portal creates
// one named "Launch" when Activities are enabled.
const entryPoint = existing.find((command) => command.type === 4);

// A CHAT_INPUT command cannot share the entry point's name.
const oldChatCommand = existing.find(
  (command) => command.type === 1 && command.name === "audiobirdle",
);
if (oldChatCommand) {
  await api(`/${oldChatCommand.id}`, { method: "DELETE" });
}

const entryPayload = {
  name: "audiobirdle",
  description: "Play Audio-Birdle with friends",
  handler: 1,
};

if (entryPoint) {
  await api(`/${entryPoint.id}`, {
    method: "PATCH",
    body: JSON.stringify(entryPayload),
  });
} else {
  // If the default entry point was deleted, recreate it.
  await api("", {
    method: "POST",
    body: JSON.stringify({
      ...entryPayload,
      type: 4,
      integration_types: [0],
      contexts: [0],
    }),
  });
}

const base = {
  type: 1,
  integration_types: [0],
  contexts: [0],
};

const adminCommands = [
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

for (const command of adminCommands) {
  const found = existing.find(
    (item) => item.type === 1 && item.name === command.name,
  );
  if (found) {
    await api(`/${found.id}`, {
      method: "PATCH",
      body: JSON.stringify(command),
    });
  } else {
    await api("", { method: "POST", body: JSON.stringify(command) });
  }
}

console.log(
  "Registered entry point /audiobirdle and admin commands: " +
    adminCommands.map((command) => `/${command.name}`).join(", "),
);
