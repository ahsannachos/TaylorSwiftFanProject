let deviceId = null;
let player = null;
let currentTrackUri = null;

// Wait for the Spotify SDK to be ready
window.onSpotifyWebPlaybackSDKReady = () => {
  const token = localStorage.getItem("spotifyAccessToken");
  if (!token) {
    alert("Please authenticate with Spotify first!");
    return;
  }

  player = new Spotify.Player({
    name: "SwiftEffect Web Player",
    getOAuthToken: (cb) => {
      cb(token);
    },
    volume: 0.5,
  });

  player.addListener("ready", ({ device_id }) => {
    console.log("SDK Ready with Device ID", device_id);
    deviceId = device_id;
  });

  // Listen for player state changes to update the UI
  player.addListener("player_state_changed", (state) => {
    if (!state) {
      return;
    }

    const playPauseBtn = document
      .getElementById("player-toggle-play")
      .querySelector("ion-icon");
    playPauseBtn.name = state.paused ? "play-circle" : "pause-circle";

    const currentTrack = state.track_window.current_track;
    if (currentTrack.uri !== currentTrackUri) {
      currentTrackUri = currentTrack.uri;
      updatePlayerBar(currentTrack);
    }
  });

  player.addListener("initialization_error", ({ message }) =>
    console.error(message)
  );
  player.addListener("authentication_error", ({ message }) =>
    console.error(message)
  );

  player.connect();
};

document.addEventListener("DOMContentLoaded", () => {
  const albumGridView = document.getElementById("album-grid-view");
  const tracklistView = document.getElementById("tracklist-view");
  const backToAlbumsBtn = document.getElementById("back-to-albums");
  const albumGrid = document.getElementById("album-grid");

  // --- View Switching ---
  function showTracklist() {
    albumGridView.classList.add("hidden");
    tracklistView.classList.remove("hidden");
  }

  function showAlbumGrid() {
    tracklistView.classList.add("hidden");
    albumGridView.classList.remove("hidden");
  }

  backToAlbumsBtn.addEventListener("click", showAlbumGrid);

  // --- Event Delegation for Album Clicks ---
  albumGrid.addEventListener("click", (event) => {
    const albumCard = event.target.closest(".album-card");
    if (albumCard && albumCard.dataset.albumId) {
      const albumId = albumCard.dataset.albumId;
      fetchAndDisplayTracks(albumId);
    }
  });

  const playerToggleBtn = document.getElementById("player-toggle-play");
  playerToggleBtn.addEventListener("click", () => {
    if (player) {
      player
        .togglePlay()
        .catch((err) => console.error("Could not toggle play", err));
    }
  });
});

async function fetchAndDisplayTracks(albumId) {
  const token = localStorage.getItem("spotifyAccessToken");
  if (!token) return;

  const tracksContainer = document.getElementById("tracksContainer");
  const albumTitleEl = document.getElementById("albumTitle");
  const albumArtistEl = document.getElementById("albumArtist");

  albumTitleEl.textContent = "Loading...";
  albumArtistEl.textContent = "";
  tracksContainer.innerHTML = ""; // Clear old tracks

  document.getElementById("album-grid-view").classList.add("hidden");
  document.getElementById("tracklist-view").classList.remove("hidden");

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/albums/${albumId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const albumData = await response.json();

    albumTitleEl.textContent = albumData.name;
    albumArtistEl.textContent = albumData.artists.map((a) => a.name).join(", ");

    albumData.tracks.items.forEach((track, index) => {
      const trackHTML = `
                <div class="track-item group flex items-center p-3 rounded-lg hover:bg-gray-200/60 cursor-pointer" data-uri="${
                  track.uri
                }" data-album-art="${albumData.images[0].url}">
                    <div class="w-8 text-gray-500 group-hover:text-gray-900 flex items-center justify-center">
                        <span class="track-number group-hover:hidden">${
                          index + 1
                        }</span>
                        <ion-icon name="play-circle" class="play-icon hidden group-hover:block text-2xl"></ion-icon>
                    </div>
                    <div class="flex-grow">
                        <p class="font-semibold text-gray-800">${track.name}</p>
                        <p class="text-sm text-gray-600">${track.artists
                          .map((a) => a.name)
                          .join(", ")}</p>
                    </div>
                    <div class="text-sm text-gray-600">${formattime(
                      track.duration_ms
                    )}</div>
                </div>`;
      tracksContainer.insertAdjacentHTML("beforeend", trackHTML);
    });

    // Add click listeners to the new track items
    tracksContainer.querySelectorAll(".track-item").forEach((item) => {
      item.addEventListener("click", () => {
        const uri = item.dataset.uri;
        playTrack(uri);
      });
    });
  } catch (err) {
    console.error("Error fetching album tracks:", err);
    albumTitleEl.textContent = "Failed to load album.";
  }
}

function playTrack(uri) {
  const token = localStorage.getItem("spotifyAccessToken");
  if (!deviceId) {
    alert("Spotify player is not ready yet. Please wait a moment.");
    return;
  }

  fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ uris: [uri] }),
  }).catch((err) => console.error("Play command failed", err));
}

function updatePlayerBar(track) {
  document.getElementById("player-album-art").src = track.album.images[0].url;
  document.getElementById("player-track-name").textContent = track.name;
  document.getElementById("player-artist-name").textContent = track.artists
    .map((a) => a.name)
    .join(", ");
  document.getElementById("player-bar").classList.remove("hidden");
}

function formattime(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

function handleLocation() {
  const hash = window.location.hash;
  if (hash.startsWith("#album=")) {
    const albumId = hash.substring(7);
    fetchAndDisplayTracks(albumId);
  } else {
    showAlbumGrid();
  }
}
