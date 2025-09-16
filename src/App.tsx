import { useState, useEffect, useCallback, useMemo } from "react";

import FontAwesome from "@fortawesome/fontawesome-svg-core";
import _ from "lodash";
import Pokedex from "pokeapi-js-wrapper";

// Add custom slider styles
const sliderStyles = `
  .slider {
    -webkit-appearance: none;
    appearance: none;
    background: #d1d5db;
    outline: none;
    border-radius: 15px;
  }
  
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #ef4444;
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  
  .slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #ef4444;
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  
  .dark-mode .slider::-webkit-slider-thumb {
    background: #eab308;
  }
  
  .dark-mode .slider::-moz-range-thumb {
    background: #eab308;
  }
`;

// Inject styles
if (typeof document !== "undefined") {
  const styleElement = document.createElement("style");
  styleElement.textContent = sliderStyles;
  document.head.appendChild(styleElement);
}

const numeralLookup = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X"
];

/**
 * Get a FontAwesome icon with optional transformations.
 *
 * @param {string} iconName - The name of the FontAwesome icon.
 * @param {number} [size] - The size of the icon, relative to the default size.
 * @param {number} [rotate] - The rotation angle of the icon.
 * @param {boolean} [flipX] - Whether to flip the icon horizontally.
 * @param {boolean} [flipY] - Whether to flip the icon vertically.
 * @param {boolean} [spin] - Whether to apply a spinning animation to the icon.
 * @returns {object} The FontAwesome icon object.
 */
const getFontAwesomeIcon = (
  iconName: FontAwesome.IconName,
  {
    size = undefined,
    rotate = undefined,
    flipX = undefined,
    flipY = undefined,
    spin = undefined
  }: { size?: number; rotate?: number; flipX?: boolean; flipY?: boolean; spin?: boolean } = {}
) => {
  const icon = FontAwesome.findIconDefinition({ prefix: "fas", iconName: iconName });
  const sizeStyles: FontAwesome.Styles = size ? { width: `${size}em`, height: `${size}em` } : {};
  const iconParams: FontAwesome.IconParams = {
    transform: {
      size: size ? size * 16 : undefined,
      x: size ? size : undefined,
      y: size ? size : undefined,
      rotate,
      flipX,
      flipY
    },
    styles: { ...sizeStyles },
    classes: [spin ? "animate-spin" : null].filter(_.isString)
  };

  if (_.isEmpty(iconParams.classes)) {
    delete iconParams.classes;
  }

  return FontAwesome.icon(icon, iconParams);
};

// Generate base64 encoded SVG icons from FontAwesome
const chevronUpIcon = getFontAwesomeIcon("chevron-up");
const chevronDownIcon = getFontAwesomeIcon("chevron-down");
const spinnerIcon = getFontAwesomeIcon("spinner", { size: 4, spin: true });
const sunIcon = getFontAwesomeIcon("sun");
const moonIcon = getFontAwesomeIcon("moon");

const chevronUpHtml = chevronUpIcon.html.join("");
const chevronDownHtml = chevronDownIcon.html.join("");
const spinnerHtml = spinnerIcon.html.join("");
const sunHtml = sunIcon.html.join("");
const moonHtml = moonIcon.html.join("");

const gameGenerations = [
  { shortGame: "R & B", game: "Red and Blue", maxDex: 151 }, // 001-151
  { shortGame: "G & S", game: "Gold and Silver", maxDex: 251 }, // 152-251
  { shortGame: "R & S", game: "Ruby and Sapphire", maxDex: 386 }, // 252-386
  { shortGame: "D & P", game: "Diamond and Pearl", maxDex: 493 }, // 387-493
  { shortGame: "B & W", game: "Black and White", maxDex: 649 }, // 494-649
  { shortGame: "X & Y", game: "X and Y", maxDex: 721 }, // 650-721
  { shortGame: "S & M", game: "Sun and Moon", maxDex: 809 }, // 722-809
  { shortGame: "S & S", game: "Sword and Shield", maxDex: 905 }, // 810-905
  { shortGame: "S & V", game: "Scarlet and Violet", maxDex: 1025 } // 906-1025
];

function App() {
  const DEFAULT_ROUNDS = 6;
  const DEFAULT_POKES_PER_ROUND = 3;
  const P = useMemo(() => new Pokedex.Pokedex(), []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any[]>([]);
  const [pkmnLoading, setPkmnLoading] = useState(true);
  const [gameLoading, setGameLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    // Initialize dark mode based on system preference
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });
  const [expandedRounds, setExpandedRounds] = useState(
    _.times(DEFAULT_ROUNDS, (i) => i === 0)
  );
  const [expandedSettings, setExpandedSettings] = useState(true);
  const [settings, setSettings] = useState({
    rounds: DEFAULT_ROUNDS,
    pokemonPerRound: DEFAULT_POKES_PER_ROUND,
    includedGenerations: _.range(0, 8), // All generations by default
  });
  const [allPokemon, setAllPokemon] = useState(new Set());

  const generations = useCallback(
    () =>
      settings.includedGenerations.map((genIdx) => {
        const prev = gameGenerations?.[genIdx - 1];
        const curr = gameGenerations[genIdx];
        const [startId, endId] = [(prev?.maxDex ?? 0) + 1, curr.maxDex];

        return {
          generation: numeralLookup[genIdx],
          ...curr,
          startId,
          endId,
          availableIds: _.range(startId, endId + 1)
        };
      }),
    [settings]
  );

  // Listen for system theme changes
  useEffect(() => {
    if (window?.matchMedia) {
      const mediaQuery = window?.matchMedia?.("(prefers-color-scheme: dark)");
      const handleChange = (e: MediaQueryListEvent) => setDarkMode(e.matches);

      // Use addEventListener if available, otherwise use addListener for older browsers
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      }
    }
  }, []);

  // Update body class for dark mode styling any time darkMode changes
  useEffect(() => {
    if (typeof document !== "undefined") {
      if (darkMode) {
        document.body.classList.add("dark");
      } else {
        document.body.classList.remove("dark");
      }
    }
  }, [darkMode]);

  useEffect(() => {
    async function fetchAllPokemon() {
      const fetchedPokemons = await P.getPokemonsList();
      setAllPokemon(new Set(fetchedPokemons.results.map((p) => p.name)));
      setPkmnLoading(false);
    }
    fetchAllPokemon();
  }, [P]);

  useEffect(() => {
    async function fetchGame() {
      const bannedWordSet = allPokemon;
      const gens = generations();
      const total = settings.rounds * settings.pokemonPerRound;
      const ids = _(gens).flatMap("availableIds").sampleSize(total).value();

      // force include slowbro #80 for testing
      // ids[0] = 80;
      // ids[1] = 332;

      const pokemonData = await Promise.all(
        ids.map(async (id) => {
          const [species, pokemon] = await Promise.all([
            P.getPokemonSpeciesByName(id),
            P.getPokemonByName(id)
          ]);
          return { ...species, ...pokemon };
        })
      );

      const cleaned = pokemonData.map((s) => {
        // split flavor text into words and replace banned words
        const flavorTextEntry = _.find(s.flavor_text_entries, {
          language: { name: "en" }
        });

        const flavor = _.split(
          _.get(flavorTextEntry, "flavor_text", ""),
          /(?=\W+)/g
        )
          .map((c) => {
            const clean = c.replace(/\W+/g, "").toLowerCase();
            if (bannedWordSet.has(clean)) {
              return c.toLowerCase().replace(clean, _.repeat("_", 4));
            }
            return c;
          })
          .join("")
          .replace(/[\s\n]/g, " ");

        return {
          id: s.id,
          name: s.name,
          flavor: flavor,
          sprite: s.sprites.front_default
        };
      });
      setData(cleaned);
      setGameLoading(false);
    }
    if (!pkmnLoading) {
      fetchGame();
    }
  }, [P, generations, allPokemon, settings, pkmnLoading]);

  const toggleRound = (index: number) => {
    setExpandedRounds((prev) =>
      new Array(settings.rounds)
        .fill(false)
        .map((_, i) => (i === index ? !prev[i] : prev[i]))
    );
  };

  /**
   * Toggle the inclusion of a generation index in the game settings.
   * @param {number} index - The generation index to toggle.
   */
  const toggleGeneration = (index: number) => {
    let newGens = [...settings.includedGenerations];
    if (newGens.includes(index)) {
      newGens = newGens.filter((i) => i !== index);
    } else {
      newGens.push(index);
    }
    setSettings((prev) => ({ ...prev, includedGenerations: newGens.sort() }));
  };

  if (gameLoading) {
    // Show skeleton loading states for rounds and cards
    const skeletonRounds = new Array(settings.rounds).fill(null);

    return (
      <div
        className={`min-h-screen ${
          darkMode
            ? "bg-gradient-to-br from-gray-900 via-purple-900 to-gray-800"
            : "bg-gradient-to-br from-blue-100 via-yellow-50 to-red-100"
        } py-8 px-4`}
      >
        <main
          className={`mx-auto w-full max-w-4xl space-y-8 p-6 rounded-2xl shadow-xl border-4 ${
            darkMode
              ? "bg-gradient-to-br from-gray-800 to-black border-gray-600"
              : "bg-gradient-to-br from-yellow-200 to-red-200 border-red-600"
          }`}
          role="main"
          aria-label="Who's That POKéMON game"
        >
          {/* Header */}
          <div className="flex justify-between items-center">
            <h1
              className={`text-4xl font-extrabold text-center drop-shadow-lg ${
                darkMode ? "text-yellow-400" : "text-red-700"
              }`}
            >
              Who's That POKéMON?
            </h1>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="bg-gray-600 hover:bg-gray-700 focus:bg-gray-700 text-white font-semibold px-4 py-2 rounded-full transition focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              aria-label={darkMode ? "Toggle Light Mode" : "Toggle Dark Mode"}
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              <div
                className="w-5 h-5"
                dangerouslySetInnerHTML={{
                  __html: darkMode ? sunHtml : moonHtml
                }}
                aria-hidden="true"
              />
              <span className="sr-only">
                {darkMode ? "Toggle Light Mode" : "Toggle Dark Mode"}
              </span>
            </button>
          </div>

          {/* Settings Panel */}
          <div
            className={`${
              darkMode
                ? "bg-gray-700 border-gray-500"
                : "bg-white border-red-500"
            } border-2 rounded-xl shadow-lg p-6`}
          >
            <h3
              className={`text-xl font-bold ${
                expandedSettings ? "mb-4" : null
              } ${darkMode ? "text-yellow-400" : "text-red-700"}`}
            >
              <button
                onClick={() => setExpandedSettings(!expandedSettings)}
                className="flex justify-between items-center w-full text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 rounded-md px-2 py-1"
                aria-expanded={expandedSettings}
                aria-controls="game-settings-content"
                aria-label={`Game Settings, ${
                  expandedSettings ? "collapse" : "expand"
                } to ${expandedSettings ? "hide" : "show"}`}
              >
                <span>Game Settings</span>
                <div
                  dangerouslySetInnerHTML={{
                    __html: expandedSettings ? chevronUpHtml : chevronDownHtml
                  }}
                  aria-hidden="true"
                  className="w-6 h-6"
                />
              </button>
            </h3>

            {expandedSettings && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Rounds Setting */}
                <div>
                  <label
                    htmlFor="rounds-slider"
                    className={`block text-sm font-medium mb-2 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Rounds: {settings.rounds}
                  </label>
                  <input
                    id="rounds-slider"
                    type="range"
                    min="1"
                    max="10"
                    value={settings.rounds}
                    onChange={(e) => {
                      const newRounds = parseInt(e.target.value);
                      setSettings((prev) => ({ ...prev, rounds: newRounds }));
                      setExpandedRounds(
                        new Array(newRounds).fill(false).map((_, i) => i === 0)
                      );
                      setGameLoading(true);
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                {/* Pokemon Per Round Setting */}
                <div>
                  <label
                    htmlFor="pokemon-slider"
                    className={`block text-sm font-medium mb-2 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    POKéMON per Round: {settings.pokemonPerRound}
                  </label>
                  <input
                    id="pokemon-slider"
                    type="range"
                    min="1"
                    max="6"
                    value={settings.pokemonPerRound}
                    onChange={(e) => {
                      setSettings((prev) => ({
                        ...prev,
                        pokemonPerRound: parseInt(e.target.value)
                      }));
                      setGameLoading(true);
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                {/* Generation Selector */}
                <div className="col-span-full">
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Generations:
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-xs">
                    {generations().map((gen, index) => (
                      <label
                        key={index}
                        className="flex items-center cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={settings.includedGenerations.includes(index)}
                          onChange={() => {
                            toggleGeneration(index);
                            // Reset rounds and loading state when toggling generations
                            setGameLoading(true);
                          }}
                          className="mr-1"
                          disabled={
                            settings.includedGenerations.length === 1 &&
                            settings.includedGenerations.includes(index)
                          }
                        />
                        <span
                          className={`truncate mx-1 ${
                            darkMode ? "text-gray-300" : "text-gray-600"
                          }`}
                          title={gen.game}
                        >
                          {gen.generation} ({gen.shortGame})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Skeleton Loading Rounds */}
          {skeletonRounds.map((_, i) => (
            <div
              key={i}
              className={`bg-opacity-90 border-2 rounded-xl shadow-2xl p-6 ${
                darkMode
                  ? "bg-gray-700 border-gray-500"
                  : "bg-white border-red-500"
              }`}
            >
              <h2
                className={`text-2xl font-bold cursor-pointer flex justify-between items-center ${
                  expandedRounds[i] ? "mb-4" : null
                } ${darkMode ? "text-yellow-400" : "text-red-600"}`}
              >
                <button
                  onClick={() => toggleRound(i)}
                  className="flex justify-between items-center w-full text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 rounded-md px-2 py-1"
                  aria-expanded={expandedRounds[i]}
                  aria-controls={`round-${i}-content`}
                  aria-label={`Round ${i + 1}, ${
                    expandedRounds[i] ? "collapse" : "expand"
                  } to ${expandedRounds[i] ? "hide" : "show"} POKéMON cards`}
                >
                  <span>Round {i + 1}</span>
                  <div
                    dangerouslySetInnerHTML={{
                      __html: expandedRounds[i]
                        ? chevronUpHtml
                        : chevronDownHtml
                    }}
                    aria-hidden="true"
                    className="w-6 h-6"
                  />
                </button>
              </h2>
              {expandedRounds[i] && (
                <div
                  id={`round-${i}-content`}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  role="region"
                  aria-label={`Round ${i + 1} POKéMON cards`}
                >
                  {/* Skeleton Pokemon Cards */}
                  {new Array(settings.pokemonPerRound)
                    .fill(null)
                    .map((_, idx) => (
                      <div
                        key={idx}
                        className={`relative overflow-hidden border-2 rounded-xl ${
                          darkMode ? "border-gray-500" : "border-red-500"
                        }`}
                        role="article"
                        aria-label={`Loading POKéMON ${idx + 1} in round ${
                          i + 1
                        }`}
                      >
                        <div
                          className={`absolute inset-0 bg-gradient-to-b opacity-20 pointer-events-none ${
                            darkMode
                              ? "from-gray-500 to-black"
                              : "from-red-500 to-white"
                          }`}
                          aria-hidden="true"
                        ></div>
                        <div className="relative p-4 flex flex-col justify-between h-full min-h-[250px]">
                          <div className="mb-4 flex-1">
                            {/* Skeleton Title */}
                            <div
                              className={`h-6 w-24 rounded mb-4 animate-pulse ${
                                darkMode ? "bg-gray-600" : "bg-gray-300"
                              }`}
                            ></div>

                            {/* Skeleton Image with spinner */}
                            <div className="flex justify-center items-center h-24 mb-4">
                              <div
                                className={`w-8 h-8 ${
                                  darkMode ? "text-yellow-500" : "text-red-500"
                                }`}
                                dangerouslySetInnerHTML={{
                                  __html: spinnerHtml
                                }}
                                aria-hidden="true"
                              />
                            </div>

                            {/* Skeleton Text */}
                            <div className="space-y-2">
                              <div
                                className={`h-4 rounded animate-pulse ${
                                  darkMode ? "bg-gray-600" : "bg-gray-300"
                                }`}
                              ></div>
                              <div
                                className={`h-4 w-3/4 rounded animate-pulse ${
                                  darkMode ? "bg-gray-600" : "bg-gray-300"
                                }`}
                              ></div>
                              <div
                                className={`h-4 w-1/2 rounded animate-pulse ${
                                  darkMode ? "bg-gray-600" : "bg-gray-300"
                                }`}
                              ></div>
                            </div>
                          </div>

                          {/* Skeleton Button */}
                          <div
                            className={`self-center h-10 w-32 rounded-full animate-pulse ${
                              darkMode ? "bg-gray-600" : "bg-gray-300"
                            }`}
                          ></div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </main>
      </div>
    );
  }

  const rounds = _.chunk(data, settings.pokemonPerRound);

  return (
    <div
      className={`min-h-screen ${
        darkMode
          ? "bg-gradient-to-br from-gray-900 via-purple-900 to-gray-800"
          : "bg-gradient-to-br from-blue-100 via-yellow-50 to-red-100"
      } py-8 px-4`}
    >
      <main
        className={`mx-auto w-full max-w-4xl space-y-8 p-6 rounded-2xl shadow-xl border-4 ${
          darkMode
            ? "bg-gradient-to-br from-gray-800 to-black border-gray-600"
            : "bg-gradient-to-br from-yellow-200 to-red-200 border-red-600"
        }`}
        role="main"
        aria-label="Who's That POKéMON game"
      >
        <div className="flex justify-between items-center">
          <h1
            className={`text-4xl font-extrabold text-center drop-shadow-lg ${
              darkMode ? "text-yellow-400" : "text-red-700"
            }`}
          >
            Who's That POKéMON?
          </h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="bg-gray-600 hover:bg-gray-700 focus:bg-gray-700 text-white font-semibold px-4 py-2 rounded-full transition focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            aria-label={darkMode ? "Toggle Light Mode" : "Toggle Dark Mode"}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            <div
              className="w-5 h-5"
              dangerouslySetInnerHTML={{
                __html: darkMode ? sunHtml : moonHtml
              }}
              aria-hidden="true"
            />
            <span className="sr-only">
              {darkMode ? "Toggle Light Mode" : "Toggle Dark Mode"}
            </span>
          </button>
        </div>

        {/* Settings Panel */}
        <div
          className={`${
            darkMode ? "bg-gray-700 border-gray-500" : "bg-white border-red-500"
          } border-2 rounded-xl shadow-lg p-6`}
        >
          <h3
            className={`text-xl font-bold ${expandedSettings ? "mb-4" : null} ${
              darkMode ? "text-yellow-400" : "text-red-700"
            }`}
          >
            <button
              onClick={() => setExpandedSettings(!expandedSettings)}
              className="flex justify-between items-center w-full text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 rounded-md px-2 py-1"
              aria-expanded={expandedSettings}
              aria-controls="game-settings-content"
              aria-label={`Game Settings, ${
                expandedSettings ? "collapse" : "expand"
              } to ${expandedSettings ? "hide" : "show"}`}
            >
              <span>Game Settings</span>
              <div
                dangerouslySetInnerHTML={{
                  __html: expandedSettings ? chevronUpHtml : chevronDownHtml
                }}
                aria-hidden="true"
                className="w-6 h-6"
              />
            </button>
          </h3>

          {expandedSettings && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Rounds Setting */}
              <div>
                <label
                  htmlFor="rounds-slider"
                  className={`block text-sm font-medium mb-2 ${
                    darkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Rounds: {settings.rounds}
                </label>
                <input
                  id="rounds-slider"
                  type="range"
                  min="1"
                  max="10"
                  value={settings.rounds}
                  onChange={(e) => {
                    const newRounds = parseInt(e.target.value);
                    setSettings((prev) => ({ ...prev, rounds: newRounds }));
                    setExpandedRounds(
                      new Array(newRounds).fill(false).map((_, i) => i === 0)
                    );
                    setGameLoading(true);
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              {/* Pokemon Per Round Setting */}
              <div>
                <label
                  htmlFor="pokemon-slider"
                  className={`block text-sm font-medium mb-2 ${
                    darkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  POKéMON per Round: {settings.pokemonPerRound}
                </label>
                <input
                  id="pokemon-slider"
                  type="range"
                  min="1"
                  max="6"
                  value={settings.pokemonPerRound}
                  onChange={(e) => {
                    setSettings((prev) => ({
                      ...prev,
                      pokemonPerRound: parseInt(e.target.value)
                    }));
                    setGameLoading(true);
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              {/* Generation Selector */}
              <div className="col-span-full">
                <label
                  className={`block text-sm font-medium mb-2 ${
                    darkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Generations:
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-xs">
                  {generations().map((gen, index) => (
                    <label
                      key={index}
                      className="flex items-center cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={settings.includedGenerations.includes(index)}
                        onChange={() => {
                          toggleGeneration(index);
                          // Reset rounds and loading state when toggling generations
                          setGameLoading(true);
                        }}
                        className="mr-1"
                        disabled={
                          settings.includedGenerations.length === 1 &&
                          settings.includedGenerations.includes(index)
                        }
                      />
                      <span
                        className={`truncate mx-1 ${
                          darkMode ? "text-gray-300" : "text-gray-600"
                        }`}
                        title={gen.game}
                      >
                        {gen.generation} ({gen.shortGame})
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        {rounds.map((group, i) => (
          <div
            key={i}
            className={`bg-opacity-90 border-2 rounded-xl shadow-2xl p-6 ${
              darkMode
                ? "bg-gray-700 border-gray-500"
                : "bg-white border-red-500"
            }`}
          >
            <h2
              className={`text-2xl font-bold cursor-pointer flex justify-between items-center ${
                expandedRounds[i] ? "mb-4" : null
              } ${darkMode ? "text-yellow-400" : "text-red-600"}`}
            >
              <button
                onClick={() => toggleRound(i)}
                className="flex justify-between items-center w-full text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 rounded-md px-2 py-1"
                aria-expanded={expandedRounds[i]}
                aria-controls={`round-${i}-content`}
                aria-label={`Round ${i + 1}, ${
                  expandedRounds[i] ? "collapse" : "expand"
                } to ${expandedRounds[i] ? "hide" : "show"} POKéMON cards`}
              >
                <span>Round {i + 1}</span>
                <div
                  dangerouslySetInnerHTML={{
                    __html: expandedRounds[i] ? chevronUpHtml : chevronDownHtml
                  }}
                  aria-hidden="true"
                  className="w-6 h-6"
                />
              </button>
            </h2>
            {expandedRounds[i] && (
              <div
                id={`round-${i}-content`}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                role="region"
                aria-label={`Round ${i + 1} POKéMON cards`}
              >
                {group.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`relative overflow-hidden border-2 rounded-xl group hover:shadow-2xl ${
                      darkMode ? "border-gray-500" : "border-red-500"
                    }`}
                    role="article"
                    aria-label={`POKéMON ${idx + 1} in round ${i + 1}${
                      p.revealed ? `: ${p.name}` : ", mystery POKéMON"
                    }`}
                  >
                    <div
                      className={`absolute inset-0 bg-gradient-to-b opacity-20 pointer-events-none ${
                        darkMode
                          ? "from-gray-500 to-black"
                          : "from-red-500 to-white"
                      }`}
                      aria-hidden="true"
                    ></div>
                    <div className="relative p-4 flex flex-col justify-between h-full min-h-[250px]">
                      <div className="mb-4 flex-1">
                        <p
                          className={`text-lg font-bold uppercase ${
                            darkMode ? "text-yellow-400" : "text-red-700"
                          }`}
                        >
                          {idx + 1}.{" "}
                          {p.revealed ? `${p.name} (#${p.id})` : "???"}
                        </p>
                        {p.revealed ? (
                          <img
                            src={p.sprite}
                            alt={`${p.name} sprite`}
                            className="mt-2 mx-auto"
                            role="img"
                          />
                        ) : (
                          <img
                            src={p.sprite}
                            alt="Mystery POKéMON silhouette"
                            className="mt-2 mx-auto filter blur-sm brightness-0"
                            role="img"
                            aria-describedby={`pokemon-${p.id}-hint`}
                          />
                        )}
                        <p
                          id={`pokemon-${p.id}-hint`}
                          className={`mt-2 ${
                            darkMode ? "text-gray-300" : "text-gray-800"
                          }`}
                          aria-label={
                            p.revealed
                              ? `Description: ${p.flavor}`
                              : `Hint: ${p.flavor}`
                          }
                        >
                          {p.flavor}
                        </p>
                      </div>
                      {!p.revealed && (
                        <button
                          onClick={() => {
                            const updatedData = [...data];
                            const index = data.findIndex(
                              (item) => item.id === p.id
                            );
                            if (index !== -1) {
                              updatedData[index].revealed = true;
                              setData(updatedData);
                            }
                          }}
                          className={`self-center ${
                            darkMode
                              ? "bg-yellow-600 hover:bg-yellow-700 focus:bg-yellow-700 focus:ring-yellow-400"
                              : "bg-red-600 hover:bg-red-700 focus:bg-red-700 focus:ring-red-400"
                          } text-white font-semibold px-4 py-2 rounded-full transition focus:outline-none focus:ring-2 focus:ring-offset-2`}
                          aria-label={`Reveal answer for POKéMON ${
                            idx + 1
                          } in round ${i + 1}`}
                          aria-describedby={`pokemon-${p.id}-hint`}
                        >
                          Reveal Answer
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}

export default App;
