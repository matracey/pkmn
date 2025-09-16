import { useState, useEffect, useCallback, useMemo } from "react";

import _ from "lodash";
import { Pokedex, type Pokemon, type PokemonSpecies } from "pokeapi-js-wrapper";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSun,
  faMoon,
  faChevronUp,
  faChevronDown,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";

interface PokeData {
  id: number;
  name: string;
  flavor: string;
  sprite?: string;
  revealed: boolean;
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
  "X",
];

const gameGenerations = [
  { shortGame: "R & B", game: "Red and Blue", maxDex: 151 }, // 001-151
  { shortGame: "G & S", game: "Gold and Silver", maxDex: 251 }, // 152-251
  { shortGame: "R & S", game: "Ruby and Sapphire", maxDex: 386 }, // 252-386
  { shortGame: "D & P", game: "Diamond and Pearl", maxDex: 493 }, // 387-493
  { shortGame: "B & W", game: "Black and White", maxDex: 649 }, // 494-649
  { shortGame: "X & Y", game: "X and Y", maxDex: 721 }, // 650-721
  { shortGame: "S & M", game: "Sun and Moon", maxDex: 809 }, // 722-809
  { shortGame: "S & S", game: "Sword and Shield", maxDex: 905 }, // 810-905
  { shortGame: "S & V", game: "Scarlet and Violet", maxDex: 1025 }, // 906-1025
];

/**
 * Determine if the user prefers dark mode based on their system settings.
 *
 * @returns true if the user prefers dark mode, false otherwise
 */
const getDarkModeStateFromColorScheme = () => {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
};

function App() {
  const DEFAULT_ROUNDS = 6;
  const DEFAULT_POKES_PER_ROUND = 3;
  const P = useMemo(() => new Pokedex(), []);

  const [data, setData] = useState<PokeData[]>([]);
  const [pkmnLoading, setPkmnLoading] = useState(true);
  const [gameLoading, setGameLoading] = useState(true);

  const [darkMode, setDarkMode] = useState(getDarkModeStateFromColorScheme);

  const [expandedRounds, setExpandedRounds] = useState(
    _.times(DEFAULT_ROUNDS, (i) => i === 0)
  );
  const [expandedSettings, setExpandedSettings] = useState(true);
  const [settings, setSettings] = useState({
    rounds: DEFAULT_ROUNDS,
    pokemonPerRound: DEFAULT_POKES_PER_ROUND,
    includedGenerations: [0, 1, 2, 3, 4, 5, 6, 7, 8], // All generations by default
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
          availableIds: _.range(startId, endId + 1),
        };
      }),
    [settings]
  );

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
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

      const pokemonData: (Pokemon & PokemonSpecies)[] = await Promise.all(
        ids.map(async (id) => {
          const [species, pokemon] = await Promise.all([
            P.getPokemonSpeciesByName(id),
            P.getPokemonByName(id),
          ]);
          return { ...species, ...pokemon };
        })
      );

      const cleaned = pokemonData.map<PokeData>((s) => {
        // split flavor text into words and replace banned words
        const flavorTextEntry = _.find(s.flavor_text_entries, {
          language: { name: "en" },
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
          sprite: s.sprites.front_default ?? undefined,
          revealed: false,
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
    setSettings((prev) => ({
      ...prev,
      includedGenerations: _(newGens).sort().value(),
    }));
  };

  if (gameLoading) {
    // Show skeleton loading states for rounds and cards
    const skeletonRounds = new Array(settings.rounds).fill(null);

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-yellow-50 to-red-100 dark:from-gray-900 dark:via-purple-900 dark:to-gray-800 py-8 px-4">
        <main
          className="mx-auto w-full max-w-4xl space-y-8 p-6 rounded-2xl shadow-xl border-4 bg-gradient-to-br from-yellow-200 to-red-200 border-red-600 dark:from-gray-800 dark:to-black dark:border-gray-600"
          role="main"
          aria-label="Who's That POKéMON game"
        >
          {/* Header */}
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-extrabold text-center drop-shadow-lg text-red-700 dark:text-yellow-400">
              Who's That POKéMON?
            </h1>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="bg-gray-600 hover:bg-gray-700 focus:bg-gray-700 text-white font-semibold px-4 py-2 rounded-full transition focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              aria-label={darkMode ? "Toggle Light Mode" : "Toggle Dark Mode"}
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              <div className="w-5 h-5" aria-hidden="true">
                {darkMode ? (
                  <FontAwesomeIcon icon={faSun} />
                ) : (
                  <FontAwesomeIcon icon={faMoon} />
                )}
              </div>
              <span className="sr-only">
                {darkMode ? "Toggle Light Mode" : "Toggle Dark Mode"}
              </span>
            </button>
          </div>

          {/* Settings Panel */}
          <div className="bg-white border-red-500 border-2 rounded-xl shadow-lg p-6 dark:bg-gray-700 dark:border-gray-500">
            <h3
              className={`text-xl font-bold ${
                expandedSettings ? "mb-4" : null
              } text-red-700 dark:text-yellow-400`}
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
                <div aria-hidden="true" className="w-6 h-6">
                  <FontAwesomeIcon
                    icon={expandedSettings ? faChevronUp : faChevronDown}
                  />
                </div>
              </button>
            </h3>

            {expandedSettings && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Rounds Setting */}
                <div>
                  <label
                    htmlFor="rounds-slider"
                    className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
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
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-red-500 dark:accent-yellow-400"
                  />
                </div>

                {/* Pokemon Per Round Setting */}
                <div>
                  <label
                    htmlFor="pokemon-slider"
                    className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
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
                        pokemonPerRound: parseInt(e.target.value),
                      }));
                      setGameLoading(true);
                    }}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-red-500 dark:accent-yellow-400"
                  />
                </div>

                {/* Generation Selector */}
                <div className="col-span-full">
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
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
                          className="truncate mx-1 text-gray-600 dark:text-gray-300"
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
              className="bg-opacity-90 border-2 rounded-xl shadow-2xl p-6 bg-white border-red-500 dark:bg-gray-700 dark:border-gray-500"
            >
              <h2
                className={`text-2xl font-bold cursor-pointer flex justify-between items-center ${
                  expandedRounds[i] ? "mb-4" : null
                } text-red-600 dark:text-yellow-400`}
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
                  <div aria-hidden="true" className="w-6 h-6">
                    <FontAwesomeIcon
                      icon={expandedRounds[i] ? faChevronUp : faChevronDown}
                    />
                  </div>
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
                        className={`relative overflow-hidden border-2 rounded-xl border-red-500 dark:border-gray-500`}
                        role="article"
                        aria-label={`Loading POKéMON ${idx + 1} in round ${
                          i + 1
                        }`}
                      >
                        <div
                          className="absolute inset-0 bg-gradient-to-b opacity-20 pointer-events-none from-red-500 to-white dark:from-gray-500 dark:to-black"
                          aria-hidden="true"
                        ></div>
                        <div className="relative p-4 flex flex-col justify-between h-full min-h-[250px]">
                          <div className="mb-4 flex-1">
                            {/* Skeleton Title */}
                            <div className="h-6 w-24 rounded mb-4 animate-pulse bg-gray-300 dark:bg-gray-600"></div>

                            {/* Skeleton Image with spinner */}
                            <div className="flex justify-center items-center h-24 mb-4">
                              <div
                                aria-hidden="true"
                                className="w-8 h-8 text-red-500 dark:text-yellow-500"
                              >
                                <FontAwesomeIcon icon={faSpinner} />
                              </div>
                            </div>

                            {/* Skeleton Text */}
                            <div className="space-y-2">
                              <div className="h-4 rounded animate-pulse bg-gray-300 dark:bg-gray-600"></div>
                              <div className="h-4 w-3/4 rounded animate-pulse bg-gray-300 dark:bg-gray-600"></div>
                              <div className="h-4 w-1/2 rounded animate-pulse bg-gray-300 dark:bg-gray-600"></div>
                            </div>
                          </div>

                          {/* Skeleton Button */}
                          <div className="self-center h-10 w-32 rounded-full animate-pulse bg-gray-300 dark:bg-gray-600"></div>
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
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-yellow-50 to-red-100 dark:from-gray-900 dark:via-purple-900 dark:to-gray-800 py-8 px-4">
      <main
        className="mx-auto w-full max-w-4xl space-y-8 p-6 rounded-2xl shadow-xl border-4 bg-gradient-to-br from-yellow-200 to-red-200 border-red-600 dark:from-gray-800 dark:to-black dark:border-gray-600"
        role="main"
        aria-label="Who's That POKéMON game"
      >
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-extrabold text-center drop-shadow-lg text-red-700 dark:text-yellow-400">
            Who's That POKéMON?
          </h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="bg-gray-600 hover:bg-gray-700 focus:bg-gray-700 text-white font-semibold px-4 py-2 rounded-full transition focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            aria-label={darkMode ? "Toggle Light Mode" : "Toggle Dark Mode"}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            <div aria-hidden="true" className="w-5 h-5">
              <FontAwesomeIcon icon={darkMode ? faSun : faMoon} />
            </div>
            <span className="sr-only">
              {darkMode ? "Toggle Light Mode" : "Toggle Dark Mode"}
            </span>
          </button>
        </div>

        {/* Settings Panel */}
        <div className="bg-white border-red-500 border-2 rounded-xl shadow-lg p-6 dark:bg-gray-700 dark:border-gray-500">
          <h3
            className={`text-xl font-bold ${
              expandedSettings ? "mb-4" : null
            } text-red-700 dark:text-yellow-400`}
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
              <div aria-hidden="true" className="w-6 h-6">
                <FontAwesomeIcon
                  icon={expandedSettings ? faChevronUp : faChevronDown}
                />
              </div>
            </button>
          </h3>

          {expandedSettings && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Rounds Setting */}
              <div>
                <label
                  htmlFor="rounds-slider"
                  className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
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
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-red-500 dark:accent-yellow-400"
                />
              </div>

              {/* Pokemon Per Round Setting */}
              <div>
                <label
                  htmlFor="pokemon-slider"
                  className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
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
                      pokemonPerRound: parseInt(e.target.value),
                    }));
                    setGameLoading(true);
                  }}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-red-500 dark:accent-yellow-400"
                />
              </div>

              {/* Generation Selector */}
              <div className="col-span-full">
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
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
                        className="truncate mx-1 text-gray-600 dark:text-gray-300"
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
            className="bg-opacity-90 border-2 rounded-xl shadow-2xl p-6 bg-white border-red-500 dark:bg-gray-700 dark:border-gray-500"
          >
            <h2
              className={`text-2xl font-bold cursor-pointer flex justify-between items-center ${
                expandedRounds[i] ? "mb-4" : null
              } text-red-600 dark:text-yellow-400`}
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
                <div aria-hidden="true" className="w-6 h-6">
                  <FontAwesomeIcon
                    icon={expandedRounds[i] ? faChevronUp : faChevronDown}
                  />
                </div>
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
                    className="relative overflow-hidden border-2 rounded-xl group hover:shadow-2xl border-red-500 dark:border-gray-500"
                    role="article"
                    aria-label={`POKéMON ${idx + 1} in round ${i + 1}${
                      p.revealed ? `: ${p.name}` : ", mystery POKéMON"
                    }`}
                  >
                    <div
                      className="absolute inset-0 bg-gradient-to-b opacity-20 pointer-events-none from-red-500 to-white dark:from-gray-500 dark:to-black"
                      aria-hidden="true"
                    ></div>
                    <div className="relative p-4 flex flex-col justify-between h-full min-h-[250px]">
                      <div className="mb-4 flex-1">
                        <p className="text-lg font-bold uppercase text-red-700 dark:text-yellow-400">
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
                          className="mt-2 text-gray-800 dark:text-gray-300"
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
                          className={`self-center bg-red-600 hover:bg-red-700 focus:bg-red-700 focus:ring-red-400 text-white font-semibold px-4 py-2 rounded-full transition focus:outline-none focus:ring-2 focus:ring-offset-2 dark:bg-yellow-600 dark:hover:bg-yellow-700 dark:focus:bg-yellow-700 dark:focus:ring-yellow-400`}
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
