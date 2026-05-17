export interface Category {
  name: string;
  words: string[];
}

export const CATEGORIES: Category[] = [
  {
    name: "Food & Drink",
    words: [
      "PIZZA", "SUSHI", "TACO", "BURGER", "PASTA", "RAMEN", "STEAK", "CURRY",
      "WAFFLE", "DONUT", "PRETZEL", "MUFFIN", "SALAD", "SOUP", "WINGS", "FRIES",
      "BAGEL", "CROISSANT", "OMELET", "PANCAKE", "CHILI", "GUMBO", "PAELLA", "GNOCCHI",
      "DUMPLING", "FALAFEL", "KEBAB", "GYRO", "BURRITO", "ENCHILADA", "LASAGNA", "RISOTTO",
      "CHOWDER", "BISQUE", "PUDDING", "TIRAMISU", "BROWNIE", "CUPCAKE", "CHEESECAKE", "SCONE",
      "MARTINI", "MOJITO", "WHISKEY", "TEQUILA", "BOURBON", "ESPRESSO", "LATTE", "CAPPUCCINO",
      "SMOOTHIE", "MARGARITA", "SANGRIA", "ABSINTHE",
    ],
  },
  {
    name: "Animals",
    words: [
      "EAGLE", "SHARK", "TIGER", "WHALE", "COBRA", "FALCON", "PANDA", "OTTER",
      "BISON", "GECKO", "RAVEN", "MOOSE", "SQUID", "CRANE", "FOX", "LYNX",
      "DOLPHIN", "OCTOPUS", "PENGUIN", "KOALA", "SLOTH", "CHEETAH", "JAGUAR", "LEOPARD",
      "RHINO", "HIPPO", "ZEBRA", "GIRAFFE", "GORILLA", "BABOON", "MONGOOSE", "MEERKAT",
      "BADGER", "BEAVER", "RACCOON", "OPOSSUM", "PORCUPINE", "ARMADILLO", "HEDGEHOG", "FERRET",
      "LLAMA", "ALPACA", "CAMEL", "WARTHOG", "JACKAL", "HYENA", "WOMBAT", "WALLABY",
      "PLATYPUS", "ECHIDNA", "PUFFIN", "PELICAN", "FLAMINGO", "TOUCAN", "PARROT", "OSTRICH",
    ],
  },
  {
    name: "Places",
    words: [
      "BEACH", "CASTLE", "CANYON", "ISLAND", "DESERT", "FOREST", "TUNDRA", "JUNGLE",
      "GLACIER", "VOLCANO", "LAGOON", "CAVERN", "REEF", "SWAMP", "SUMMIT", "VALLEY",
      "MEADOW", "PRAIRIE", "OASIS", "PLATEAU", "MARSH", "DELTA", "FJORD", "HARBOR",
      "PENINSULA", "ARCHIPELAGO", "STRAIT", "ESTUARY", "GORGE", "RAVINE", "CRATER", "MESA",
      "DUNE", "ATOLL", "CLIFF", "GROTTO", "VINEYARD", "ORCHARD", "PLAZA", "BAZAAR",
      "TEMPLE", "MONASTERY", "CATHEDRAL", "PALACE", "FORTRESS", "MUSEUM", "STADIUM", "MARINA",
      "PIER", "BOARDWALK", "ALLEY", "BOULEVARD",
    ],
  },
  {
    name: "Office Life",
    words: [
      "MEETING", "SLACK", "EMAIL", "STANDUP", "DEPLOY", "BACKLOG", "SPRINT", "RETRO",
      "JIRA", "MERGE", "REVIEW", "TICKET", "OUTAGE", "DEMO", "ONCALL", "RELEASE",
      "POSTMORTEM", "REFACTOR", "REGRESSION", "ROADMAP", "SYNC", "OFFSITE", "ALL-HANDS", "ONBOARDING",
      "PERFORMANCE", "FEEDBACK", "PROMOTION", "BUDGET", "FORECAST", "QUARTERLY", "KICKOFF", "CALENDAR",
      "TIMEOFF", "VACATION", "BENEFITS", "PAYROLL", "BONUS", "EQUITY", "VESTING", "STIPEND",
      "BREAKROOM", "WATERCOOLER", "BADGE", "LANYARD", "WHITEBOARD", "PROJECTOR", "PRINTER", "STAPLER",
      "INTERN", "MANAGER", "DIRECTOR", "VENDOR",
    ],
  },
  {
    name: "80s/90s",
    words: [
      "WALKMAN", "ARCADE", "PAGER", "DIALUP", "FLOPPY", "MULLET", "BOOMBOX", "TAMAGOTCHI",
      "BEEPER", "MIXTAPE", "BLOCKBUSTER", "SCRUNCHIE", "GRUNGE", "NEON", "GAMEBOY", "POGS",
      "PUNK", "ROLLERSKATE", "SNAPBRACELET", "HYPERCOLOR", "TROLL", "FURBY", "POKEMON", "DISCMAN",
      "NINTENDO", "SEGA", "ATARI", "PINBALL", "BREAKDANCE", "MOONWALK", "VCR", "BETAMAX",
      "PERM", "JELLIES", "FANNYPACK", "LEGWARMERS", "PARACHUTE", "WINDBREAKER", "OVERALLS", "FLANNEL",
      "TYPEWRITER", "POLAROID", "ROLODEX", "CHIA", "SLINKY", "TROLLS", "BARNEY", "RUGRATS",
      "DUNGAREES", "JAMS",
    ],
  },
  {
    name: "Movies",
    words: [
      "JAWS", "ALIEN", "TITANIC", "GLADIATOR", "ROCKY", "MATRIX", "AVATAR", "INCEPTION",
      "GOONIES", "GREASE", "SCARFACE", "GODFATHER", "PSYCHO", "VERTIGO", "CASABLANCA", "FARGO",
      "BATMAN", "SUPERMAN", "SPIDERMAN", "IRONMAN", "HULK", "THOR", "BLACKWIDOW", "CAPTAIN",
      "WIZARD", "FROZEN", "MOANA", "TANGLED", "BAMBI", "DUMBO", "TARZAN", "MULAN",
      "ZOMBIE", "WEREWOLF", "VAMPIRE", "GHOST", "EXORCIST", "POLTERGEIST", "SHINING", "CARRIE",
      "JURASSIC", "TERMINATOR", "PREDATOR", "ROBOCOP", "STARWARS", "STARTREK", "AVENGERS", "JUSTICE",
      "MAVERICK", "TOPGUN", "RAMBO", "BOURNE",
    ],
  },
];

export function pickCategory(): Category {
  return CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
}

export function generateGrid(category: Category): { words: string[]; target: string } {
  const pool = [...category.words];
  // Fisher-Yates partial shuffle: only need first 16
  for (let i = 0; i < 16; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const words = pool.slice(0, 16);
  const target = words[Math.floor(Math.random() * 16)];
  return { words, target };
}
