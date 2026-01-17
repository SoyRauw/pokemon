// --- DATA ---
let players = [];
let currentPlayerIndex = 0;
let imposterIndex = 0;
let secretPokemonName = "";
let secretPokemonImage = null;

const STORAGE_KEY = 'impostorPokemon.players';
const POKE_API_BASE = 'https://pokeapi.co/api/v2';
const POKE_LIST_STORAGE = 'impostorPokemon.pokelist.v1';
const POKE_LIST_TTL = 7 * 24 * 60 * 60 * 1000; // 7 días
let pokemonCatalog = []; // [{ name, url, id }]

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function parseIdFromUrl(url) {
  const m = url && url.match(/\/pokemon\/(\d+)\/?$/);
  return m ? parseInt(m[1], 10) : null;
}

async function ensurePokemonList() {
  try {
    const cachedRaw = localStorage.getItem(POKE_LIST_STORAGE);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (cached && Array.isArray(cached.results) && cached.time && (Date.now() - cached.time) < POKE_LIST_TTL) {
        pokemonCatalog = cached.results;
        return;
      }
    }
  } catch (e) {}

  try {
    const res = await fetch(`${POKE_API_BASE}/pokemon?limit=1025&offset=0`);
    if (!res.ok) throw new Error('Error al obtener lista de Pokémon');
    const data = await res.json();
    pokemonCatalog = (data.results || []).map(r => ({ name: r.name, url: r.url, id: parseIdFromUrl(r.url) })).filter(Boolean);
    try {
      localStorage.setItem(POKE_LIST_STORAGE, JSON.stringify({ time: Date.now(), results: pokemonCatalog }));
    } catch (e) {}
  } catch (e) {
    // Fallback mínimo con algunos nombres si offline
    pokemonCatalog = [
      { name: 'pikachu', url: '', id: 25 },
      { name: 'charizard', url: '', id: 6 },
      { name: 'bulbasaur', url: '', id: 1 },
      { name: 'squirtle', url: '', id: 7 },
      { name: 'jigglypuff', url: '', id: 39 }
    ];
  }
}

async function pickRandomPokemon() {
  await ensurePokemonList();
  if (!pokemonCatalog.length) throw new Error('No hay Pokémon disponibles');
  const chosen = pokemonCatalog[Math.floor(Math.random() * pokemonCatalog.length)];
  try {
    const res = await fetch(`${POKE_API_BASE}/pokemon/${chosen.name}`);
    if (!res.ok) throw new Error('Error detalle Pokémon');
    const detail = await res.json();
    const img = (detail.sprites?.other?.["official-artwork"]?.front_default)
      || detail.sprites?.front_default
      || null;
    return { name: capitalize(chosen.name), image: img };
  } catch (e) {
    return { name: capitalize(chosen.name), image: null };
  }
}

function savePlayers() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
  } catch (e) {}
}

function loadPlayers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      players = parsed
        .filter(v => typeof v === 'string')
        .map(v => v.trim())
        .filter(Boolean);
    }
  } catch (e) {}
}

// --- FUNCIONES SETUP ---
function addPlayer() {
  const input = document.getElementById('player-input');
  const name = input.value.trim();

  if (name) {
    players.push(name);
    renderList();
    input.value = '';
    input.focus();
    savePlayers();
  }
}

function removePlayer(index) {
  players.splice(index, 1);
  renderList();
  savePlayers();
}

function updateStartButton() {
  const startBtn = document.getElementById('start-btn');
  if (startBtn) startBtn.disabled = players.length < 3;
}

function renderList() {
  const list = document.getElementById('player-list');
  list.innerHTML = '';
  players.forEach((player, index) => {
    const li = document.createElement('li');

    const nameSpan = document.createElement('span');
    nameSpan.textContent = player;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-btn';
    removeBtn.setAttribute('aria-label', `Eliminar ${player}`);
    removeBtn.textContent = '✖';
    removeBtn.addEventListener('click', () => removePlayer(index));

    li.appendChild(nameSpan);
    li.appendChild(removeBtn);
    list.appendChild(li);
  });

  updateStartButton();
}

// --- FUNCIONES JUEGO ---
async function startGame() {
  if (players.length < 3) {
    alert("Se necesitan al menos 3 jugadores.");
    return;
  }

  const startBtn = document.getElementById('start-btn');
  if (startBtn) startBtn.disabled = true;
  try {
    // Seleccionar Impostor y Pokémon con imagen
    imposterIndex = Math.floor(Math.random() * players.length);
    const picked = await pickRandomPokemon();
    secretPokemonName = picked.name;
    secretPokemonImage = picked.image;
    currentPlayerIndex = 0;

    // Cambiar pantalla
    document.getElementById('setup-screen').classList.add('hidden');
    showPassScreen();
  } catch (e) {
    alert('No se pudo cargar el Pokémon. Revisa tu conexión e inténtalo de nuevo.');
  } finally {
    if (startBtn) startBtn.disabled = players.length < 3;
  }
}

function showPassScreen() {
  document.getElementById('pass-screen').classList.remove('hidden');
  document.getElementById('role-screen').classList.add('hidden');
  document.getElementById('current-player-name').textContent = players[currentPlayerIndex];
}

function showRole() {
  document.getElementById('pass-screen').classList.add('hidden');
  document.getElementById('role-screen').classList.remove('hidden');

  const roleDisplay = document.getElementById('role-display');
  const roleDesc = document.getElementById('role-desc');
  const roleImg = document.getElementById('role-image');

  if (currentPlayerIndex === imposterIndex) {
    roleDisplay.textContent = "TEAM ROCKET";
    roleDisplay.classList.remove('civilian', 'imposter');
    roleDisplay.classList.add('role-text', 'imposter');
    roleDesc.textContent = "Eres el Impostor. No sabes el Pokémon secreto. Intenta encajar y no ser descubierto.";
    if (roleImg) { roleImg.classList.add('hidden'); roleImg.removeAttribute('src'); roleImg.removeAttribute('alt'); }
  } else {
    roleDisplay.textContent = (secretPokemonName || '').toUpperCase();
    roleDisplay.classList.remove('civilian', 'imposter');
    roleDisplay.classList.add('role-text', 'civilian');
    roleDesc.textContent = "Este es el Pokémon secreto. Descríbelo con cuidado para que el Team Rocket no lo adivine.";
    if (roleImg) {
      if (secretPokemonImage) {
        roleImg.src = secretPokemonImage;
        roleImg.alt = `Imagen de ${secretPokemonName}`;
        roleImg.classList.remove('hidden');
      } else {
        roleImg.classList.add('hidden');
        roleImg.removeAttribute('src');
        roleImg.removeAttribute('alt');
      }
    }
  }

  if (navigator.vibrate) try { navigator.vibrate(20); } catch (e) {}
}

function nextTurn() {
  currentPlayerIndex++;
  if (currentPlayerIndex < players.length) {
    showPassScreen();
  } else {
    // Fin de la ronda de cartas
    document.getElementById('role-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    // Resetear estado del reveal
    document.getElementById('imposter-reveal').classList.add('hidden');
    document.getElementById('imposter-reveal').textContent = '';
    document.getElementById('btn-reveal-imp').style.display = 'block';
  }
}

function revealImposter() {
  const imposterName = players[imposterIndex];
  const revealText = document.getElementById('imposter-reveal');
  revealText.textContent = `El Team Rocket era: ${imposterName} (El Pokémon era ${secretPokemonName})`;
  revealText.classList.remove('hidden');
  document.getElementById('btn-reveal-imp').style.display = 'none';
}

function resetGame() {
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('setup-screen').classList.remove('hidden');
  // Mantenemos la lista de jugadores para no tener que escribirlos de nuevo
  updateStartButton();
}

// --- EVENT LISTENERS (sin inline handlers) ---
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('player-input');
  const addBtn = document.getElementById('add-btn');
  const startBtn = document.getElementById('start-btn');
  const revealBtn = document.getElementById('reveal-btn');
  const hideRoleBtn = document.getElementById('hide-role-btn');
  const revealImpBtn = document.getElementById('btn-reveal-imp');
  const resetBtn = document.getElementById('reset-btn');

  loadPlayers();
  renderList();

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addPlayer();
  });

  addBtn.addEventListener('click', addPlayer);
  startBtn.addEventListener('click', startGame);
  revealBtn.addEventListener('click', showRole);
  hideRoleBtn.addEventListener('click', nextTurn);
  revealImpBtn.addEventListener('click', revealImposter);
  resetBtn.addEventListener('click', resetGame);
});
