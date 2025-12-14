const rpc = require("discord-rpc");

const clientId = process.env.YTMP_DISCORD_CLIENT_ID;
let client = null;
let isConnected = false;
let presenceUpdateInterval;
let mainWindowRef = null;

if (clientId) {
  rpc.register(clientId);
}

function setDiscordActivity(songTitle = "Loading Song", artist = "Loading Artist", songUrl = "", albumArtUrl = "") {
  if (!client || !isConnected) return;

  const Title = songTitle && songTitle.toString().trim().length > 0 ? songTitle.toString().trim() : "Loading Song";
  const Artist = artist && artist.toString().trim().length > 0 ? artist.toString().trim() : "Loading Artist";

  client
    .setActivity({
      details: Title,
      state: `by ${Artist}`,
      largeImageKey: albumArtUrl || "icon",
      largeImageText: "YouTube Music",
      instance: false,
      buttons: [
        {
          label: "Listen on YouTube Music",
          url: songUrl || "https://music.youtube.com",
        },
        {
          label: "Get App",
          url: "https://github.com/nubsuki/YouTube-Music-Player",
        },
      ],
    })
    .catch((error) => {
      console.error("Error setting Discord activity:", error);
    });
}

async function getCurrentSongInfo() {
  try {
    if (!mainWindowRef || mainWindowRef.isDestroyed()) {
      return { songTitle: "Loading Song", artist: "Loading Artist", songUrl: "", albumArtUrl: "" };
    }

    const { songTitle, artist, qartist, albumArtUrl } = await mainWindowRef.webContents.executeJavaScript(`
      (() => {
        const titleElement = document.querySelector('.title.ytmusic-player-bar');
        const bylineElement = document.querySelector('.byline.ytmusic-player-bar');
        const imgElement = document.querySelector('.image.style-scope.ytmusic-player-bar');

        const rawTitle = titleElement ? titleElement.textContent.trim() : '';
        const rawArtist = bylineElement ? bylineElement.textContent.trim() : '';

        const songTitle = rawTitle || 'Loading Song';
        const artist = rawArtist || 'Loading Artist';

        let qartist = 'Loading Artist';
        if (bylineElement) {
          const byline = bylineElement.textContent.trim();
          if (byline) {
            const parts = byline.split('•');
            qartist = (parts[0] || '').trim() || 'Loading Artist';
          }
        }

        const albumArtUrl = imgElement ? imgElement.src : '';

        return { songTitle, artist, qartist, albumArtUrl };
      })();
    `);
    const SongTitle = songTitle && songTitle.toString().trim().length > 0 ? songTitle.toString().trim() : "Loading Song";
    const Artist = artist && artist.toString().trim().length > 0 ? artist.toString().trim() : "Loading Artist";
    const QArtist = qartist && qartist.toString().trim().length > 0 ? qartist.toString().trim() : Artist;

    const query = encodeURIComponent(`${SongTitle} by ${QArtist}`);
    const songUrl = `https://music.youtube.com/search?q=${query}`;

    return { songTitle: SongTitle, artist: Artist, songUrl, albumArtUrl };
  } catch (error) {
    console.error("Error fetching song info:", error);
    return { songTitle: "Loading Song", artist: "Loading Artist", songUrl: "", albumArtUrl: "" };
  }
}

async function connectToDiscord() {
  try {
    if (client) {
      try {
        await client.destroy();
        console.log("Destroyed old Discord client session.");
      } catch (error) {
        console.warn("Error destroying old client (might already be destroyed):", error.message);
      }
    }

    client = new rpc.Client({ transport: "ipc" });

    client.on("ready", () => {
      console.log("Successfully connected to Discord!");
      isConnected = true;

      setDiscordActivity();

      presenceUpdateInterval = setInterval(async () => {
        const { songTitle, artist, songUrl, albumArtUrl } = await getCurrentSongInfo();
        setDiscordActivity(songTitle, artist, songUrl, albumArtUrl);
      }, 12000);
    });

    client.on("error", (error) => {
      console.error("Discord RPC Error:", error.message);
      handleDiscordDisconnect();
    });

    client.on("disconnected", () => {
      console.warn("Disconnected from Discord. Attempting to reconnect...");
      handleDiscordDisconnect();
    });

    await client.login({ clientId });
  } catch (error) {
    console.error("Failed to connect to Discord:", error.message);

    if (!isConnected) {
      setTimeout(connectToDiscord, 10000);
    }
  }
}

function handleDiscordDisconnect() {
  isConnected = false;

  if (presenceUpdateInterval) {
    clearInterval(presenceUpdateInterval);
    presenceUpdateInterval = null;
  }

  if (client) {
    client.clearActivity().catch((error) => console.error("Error clearing activity:", error.message));
    client.destroy().catch((error) => console.error("Error destroying client:", error.message));
  }

  client = null;
  setTimeout(connectToDiscord, 10000);
}


function initDiscordRpc(mainWindow) {
  if (!clientId) {
    console.warn("Discord RPC disabled: YTMP_DISCORD_CLIENT_ID is not set.");
    return;
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    console.warn("Discord RPC initialization skipped: invalid BrowserWindow.");
    return;
  }

  mainWindowRef = mainWindow;
  connectToDiscord();
}

module.exports = {
  initDiscordRpc,
};
