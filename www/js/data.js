// Static game data: species, habitats, buildings, genetics tables, goals and achievements.

// Habitat groups. Each species lives in exactly one habitat type.
export const GROUPS = {
  kennel:    { name: 'Kennel',     plural: 'Dogs',            colour: '#c9733a', unlock: 1,  cost: 400,   build: 20,  desc: 'Warm runs and comfy beds for dogs.' },
  aviary:    { name: 'Aviary',     plural: 'Birds',           colour: '#2f8fc4', unlock: 1,  cost: 350,   build: 20,  desc: 'Tall flight cages for parrots and other birds.' },
  hutch:     { name: 'Hutch',      plural: 'Small pets',      colour: '#b5894f', unlock: 1,  cost: 250,   build: 15,  desc: 'Burrows, wheels and hay for small mammals.' },
  terrarium: { name: 'Terrarium',  plural: 'Reptiles',        colour: '#5e9b3c', unlock: 1,  cost: 300,   build: 20,  desc: 'Heat lamps and basking rocks for turtles and lizards.' },
  cattery:   { name: 'Cattery',    plural: 'Cats',            colour: '#9a5fb5', unlock: 2,  cost: 450,   build: 25,  desc: 'Climbing towers and sunny windows for cats.' },
  pond:      { name: 'Pond',       plural: 'Aquatic',         colour: '#1e9e9e', unlock: 4,  cost: 700,   build: 40,  desc: 'Filtered water for fish and amphibians.' },
  paddock:   { name: 'Paddock',    plural: 'Farm animals',    colour: '#8aa13a', unlock: 3,  cost: 900,   build: 45,  desc: 'Open pasture for hoofed and grazing animals.' },
  sanctuary: { name: 'Sanctuary',  plural: 'Exotic wildlife', colour: '#c4482f', unlock: 15, cost: 12000, build: 180, desc: 'A licensed wildlife sanctuary for rare and exotic species.' },
};

// tier: 1 (common) to 5 (legendary). price null means breed-only (see RECIPES).
// breed / grow are in seconds. litter is [min, max].
const T = {
  1: { breed: 45,   grow: 60,   litter: [2, 4], feed: 1 },
  2: { breed: 120,  grow: 180,  litter: [2, 3], feed: 1 },
  3: { breed: 300,  grow: 480,  litter: [1, 3], feed: 2 },
  4: { breed: 720,  grow: 1200, litter: [1, 2], feed: 3 },
  5: { breed: 1800, grow: 2700, litter: [1, 2], feed: 4 },
};

const S = (id, name, group, tier, level, price, desc, extra = {}) => ({
  id, name, group, tier, level, price, desc,
  value: Math.round((price || [0, 200, 700, 2600, 8000, 26000][tier]) * 0.55),
  ...T[tier], ...extra,
});

export const SPECIES_LIST = [
  // Dogs
  S('pug', 'Pug', 'kennel', 1, 1, 150, 'Wrinkly, snorty and full of opinions. The perfect starter dog.'),
  S('dachshund', 'Dachshund', 'kennel', 1, 2, 180, 'Bred to chase badgers, now mostly chases snacks.'),
  S('frenchie', 'French Bulldog', 'kennel', 2, 3, 450, 'Bat ears and a big personality in a small, sturdy frame.'),
  S('corgi', 'Pembroke Welsh Corgi', 'kennel', 2, 4, 600, 'A herding dog with short legs and a long list of demands.'),
  S('pomeranian', 'Pomeranian', 'kennel', 2, 5, 550, 'A fluffy cloud that believes it is a guard dog.'),
  S('bordercollie', 'Border Collie', 'kennel', 2, 6, 700, 'Often called the smartest dog breed. Needs a job.'),
  S('kelpie', 'Australian Kelpie', 'kennel', 2, 7, 650, 'A tireless Aussie sheepdog that can run across the backs of sheep.'),
  S('shiba', 'Shiba Inu', 'kennel', 3, 8, 1600, 'An ancient Japanese breed, famously independent and catlike.'),
  S('golden', 'Golden Retriever', 'kennel', 3, 9, 1800, 'Gentle, loyal and never met a stranger.'),
  S('husky', 'Siberian Husky', 'kennel', 3, 11, 2200, 'A sled dog with striking eyes and a dramatic howl.'),
  S('dalmatian', 'Dalmatian', 'kennel', 4, 16, 5200, 'Born pure white, spots appear in the first few weeks.'),
  S('samoyed', 'Samoyed', 'kennel', 4, 12, null, 'The smiling snow dog. Only appears from a special spitz pairing.'),
  // Cats
  S('britishshorthair', 'British Shorthair', 'cattery', 1, 2, 200, 'Round-faced and plush, with a calm, dignified manner.'),
  S('siamese', 'Siamese', 'cattery', 1, 3, 220, 'Vocal, affectionate and colour-pointed with blue eyes.'),
  S('persian', 'Persian', 'cattery', 2, 5, 650, 'Long-haired royalty that requires daily grooming.'),
  S('ragdoll', 'Ragdoll', 'cattery', 2, 7, 700, 'Goes floppy when picked up, hence the name.'),
  S('scottishfold', 'Scottish Fold', 'cattery', 3, 10, 1900, 'Known for its folded ears and owl-like face.'),
  S('mainecoon', 'Maine Coon', 'cattery', 3, 12, 2400, 'A gentle giant and one of the largest domestic cats.'),
  S('bengal', 'Bengal', 'cattery', 4, 15, 5500, 'Wild-looking rosettes and a love of water.'),
  S('sphynx', 'Sphynx', 'cattery', 4, 9, null, 'Hairless, warm to the touch and very sociable. A rare pairing result.'),
  // Birds
  S('budgie', 'Budgerigar', 'aviary', 1, 1, 100, 'A native Australian parakeet that flies in huge flocks in the outback.'),
  S('cockatiel', 'Cockatiel', 'aviary', 1, 2, 160, 'A small Aussie cockatoo with rosy cheeks and a whistle for every song.'),
  S('lorikeet', 'Rainbow Lorikeet', 'aviary', 2, 4, 500, 'Loud, bright and a familiar sight in east coast gardens.'),
  S('bluegold', 'Blue-and-gold Macaw', 'aviary', 3, 6, 1800, 'A brilliant South American macaw that can live for over 60 years.'),
  S('cockatoo', 'Sulphur-crested Cockatoo', 'aviary', 2, 6, 750, 'Cheeky, clever and famous for opening wheelie bins.'),
  S('africangrey', 'African Grey Parrot', 'aviary', 3, 9, 2000, 'One of the best talkers in the bird world.'),
  S('scarlet', 'Scarlet Macaw', 'aviary', 3, 10, 2300, 'Fiery red, yellow and blue plumage from the rainforest canopy.'),
  S('greenwing', 'Green-winged Macaw', 'aviary', 4, 14, 5000, 'A large, gentle macaw with a powerful beak.'),
  S('peacock', 'Indian Peafowl', 'aviary', 4, 18, 6000, 'The male fans a train of over 200 shimmering feathers.'),
  S('toucan', 'Toco Toucan', 'aviary', 4, 12, null, 'That huge bill is surprisingly light. Hatches from a tropical pairing.'),
  S('hyacinth', 'Hyacinth Macaw', 'aviary', 5, 16, null, 'The largest flying parrot on Earth. Legendary breeders only.'),
  // Reptiles
  S('redeared', 'Red-eared Slider', 'terrarium', 1, 1, 130, 'A sun-loving turtle named for the red stripe behind its eye.'),
  S('leopardgecko', 'Leopard Gecko', 'terrarium', 1, 3, 200, 'A spotty gecko that stores fat in its tail.'),
  S('boxturtle', 'Eastern Box Turtle', 'terrarium', 2, 5, 550, 'Can close its hinged shell completely like a box.'),
  S('beardie', 'Bearded Dragon', 'terrarium', 2, 6, 600, 'A friendly Aussie lizard that waves and puffs its beard.'),
  S('bluetongue', 'Blue-tongued Skink', 'terrarium', 2, 8, 700, 'Flashes a bright blue tongue to startle predators.'),
  S('ballpython', 'Ball Python', 'terrarium', 3, 11, 2000, 'Curls into a ball when shy. Docile and slow-moving.'),
  S('chameleon', 'Veiled Chameleon', 'terrarium', 3, 13, 2600, 'Changes colour with mood and temperature.'),
  S('leopardtortoise', 'Leopard Tortoise', 'terrarium', 4, 17, 5500, 'A large tortoise with a beautifully patterned shell.'),
  S('galapagos', 'Galápagos Tortoise', 'terrarium', 5, 19, null, 'Can live for more than 100 years. Only the most patient breeders succeed.'),
  // Small pets
  S('hamster', 'Golden Hamster', 'hutch', 1, 1, 90, 'Can stuff its cheek pouches with food to twice the size of its head.'),
  S('guineapig', 'Guinea Pig', 'hutch', 1, 1, 120, 'Jumps straight up when happy. This is called popcorning.'),
  S('hollandlop', 'Holland Lop Rabbit', 'hutch', 1, 2, 180, 'A tiny rabbit breed with floppy ears.'),
  S('ferret', 'Ferret', 'hutch', 2, 5, 550, 'Does a happy war dance when excited.'),
  S('hedgehog', 'African Pygmy Hedgehog', 'hutch', 2, 7, 650, 'Rolls into a spiky ball when worried.'),
  S('chinchilla', 'Chinchilla', 'hutch', 3, 10, 1900, 'Has the densest fur of any land mammal.'),
  S('sugarglider', 'Sugar Glider', 'hutch', 3, 12, 2200, 'A tiny marsupial that glides between trees on furry membranes.'),
  // Aquatic
  S('goldfish', 'Goldfish', 'pond', 1, 4, 100, 'Can remember things for months, not three seconds.'),
  S('koi', 'Koi', 'pond', 2, 6, 700, 'Ornamental carp that can live for decades.'),
  S('clownfish', 'Ocellaris Clownfish', 'pond', 2, 9, 800, 'Lives safely among the stinging tentacles of anemones.'),
  S('axolotl', 'Axolotl', 'pond', 3, 12, 2400, 'A smiling salamander that can regrow its limbs.'),
  S('seaturtle', 'Green Sea Turtle', 'pond', 5, 22, 15000, 'Returns to the beach where it hatched to lay its own eggs.'),
  // Farm
  S('goat', 'Pygmy Goat', 'paddock', 1, 3, 250, 'Small, curious and an expert escape artist.'),
  S('minipig', 'Kunekune Pig', 'paddock', 2, 5, 600, 'A friendly grazing pig from New Zealand with tassels on its chin.'),
  S('alpaca', 'Alpaca', 'paddock', 2, 8, 900, 'Hums to communicate and has very soft fleece.'),
  S('pony', 'Shetland Pony', 'paddock', 3, 11, 2500, 'Small but strong. Can pull twice its own weight.'),
  S('capybara', 'Capybara', 'paddock', 3, 14, 2800, 'The largest rodent in the world and friends with everyone.'),
  S('kangaroo', 'Red Kangaroo', 'paddock', 4, 17, 6000, 'The largest marsupial. Can cover 8 metres in a single hop.'),
  // Exotic
  S('fennec', 'Fennec Fox', 'sanctuary', 3, 15, 3000, 'The smallest fox, with enormous ears for keeping cool.'),
  S('quokka', 'Quokka', 'sanctuary', 3, 15, 3200, 'The happiest-looking marsupial, found on Rottnest Island.'),
  S('wombat', 'Common Wombat', 'sanctuary', 3, 16, 3500, 'Produces cube-shaped droppings and has a backwards pouch.'),
  S('redpanda', 'Red Panda', 'sanctuary', 4, 16, 6500, 'Not a bear and not a raccoon. A family all of its own.'),
  S('koala', 'Koala', 'sanctuary', 4, 18, 7000, 'Sleeps up to 20 hours a day on a diet of eucalyptus.'),
  S('arcticfox', 'Arctic Fox', 'sanctuary', 4, 19, 7000, 'Its coat turns from brown in summer to white in winter.'),
  S('sloth', 'Brown-throated Sloth', 'sanctuary', 4, 20, 7500, 'Moves so slowly that algae grows in its fur.'),
  S('platypus', 'Platypus', 'sanctuary', 5, 21, null, 'An egg-laying mammal with a duck bill and venomous spurs.'),
  S('snowleopard', 'Snow Leopard', 'sanctuary', 5, 25, 22000, 'The ghost of the mountains, with a tail as long as its body.'),
  S('whitetiger', 'White Tiger', 'sanctuary', 5, 27, null, 'A legendary pale tiger. Only the finest sanctuary can raise one.'),
];

export const SPECIES = Object.fromEntries(SPECIES_LIST.map(s => [s.id, s]));

// Cross-species pairings within one habitat that can produce a breed-only species.
export const RECIPES = [
  { a: 'husky', b: 'pomeranian', result: 'samoyed', chance: 0.25, hint: 'Two fluffy spitz breeds of very different sizes.' },
  { a: 'siamese', b: 'britishshorthair', result: 'sphynx', chance: 0.25, hint: 'A pointed cat and a plush cat.' },
  { a: 'scarlet', b: 'lorikeet', result: 'toucan', chance: 0.22, hint: 'Two of the most colourful birds in the aviary.' },
  { a: 'bluegold', b: 'greenwing', result: 'hyacinth', chance: 0.15, hint: 'Two big macaws, one blue and gold, one red and green.' },
  { a: 'leopardtortoise', b: 'boxturtle', result: 'galapagos', chance: 0.15, hint: 'A spotted tortoise and a turtle that shuts like a box.' },
  { a: 'quokka', b: 'wombat', result: 'platypus', chance: 0.15, hint: 'Two Australian marsupials. The result is very odd.' },
  { a: 'snowleopard', b: 'arcticfox', result: 'whitetiger', chance: 0.12, hint: 'Two creatures of snow and ice.' },
];

// Colour mutations. filter is applied to the photo. mult multiplies sale value.
export const MUTATIONS = {
  golden:     { name: 'Golden',     weight: 32, mult: 3,  filter: 'sepia(.55) saturate(2.4) hue-rotate(-12deg) brightness(1.12)', colour: '#e8b923' },
  albino:     { name: 'Albino',     weight: 28, mult: 2.5, filter: 'grayscale(1) brightness(1.38) contrast(.88)', colour: '#f2eee6' },
  melanistic: { name: 'Melanistic', weight: 24, mult: 2.5, filter: 'brightness(.5) contrast(1.35) saturate(.5)', colour: '#3a3340' },
  frost:      { name: 'Frost',      weight: 10, mult: 4,  filter: 'hue-rotate(185deg) saturate(.8) brightness(1.18)', colour: '#8fd6ff' },
  cosmic:     { name: 'Cosmic',     weight: 5,  mult: 6,  filter: 'hue-rotate(255deg) saturate(1.8) contrast(1.15)', colour: '#8a4dff' },
  rainbow:    { name: 'Rainbow',    weight: 1,  mult: 10, filter: '', colour: '#ff5fa2', animated: true },
};
export const BASE_MUTATION_CHANCE = 0.035;

export const TRAITS = {
  fertile:  { name: 'Fertile',  good: true,  desc: 'Breeds 25% faster.' },
  prolific: { name: 'Prolific', good: true,  desc: 'Adds one extra baby to each litter.' },
  hearty:   { name: 'Hearty',   good: true,  desc: 'Gets hungry 30% slower.' },
  cheerful: { name: 'Cheerful', good: true,  desc: 'Happiness drops 40% slower.' },
  charmer:  { name: 'Charmer',  good: true,  desc: 'Scores +15 at shows.' },
  lucky:    { name: 'Lucky',    good: true,  desc: 'Doubles the mutation chance of offspring.' },
  hardy:    { name: 'Hardy',    good: true,  desc: 'Rarely gets sick.' },
  greedy:   { name: 'Greedy',   good: false, desc: 'Gets hungry 40% faster.' },
  grumpy:   { name: 'Grumpy',   good: false, desc: 'Happiness drops 50% faster.' },
  sickly:   { name: 'Sickly',   good: false, desc: 'Gets sick more often and is worth 15% less.' },
  lazy:     { name: 'Lazy',     good: false, desc: 'Takes 25% longer to breed.' },
};
export const TRAIT_IDS = Object.keys(TRAITS);

// Non-habitat buildings.
export const BUILDINGS = {
  feedmill:  { name: 'Feed Mill',    unlock: 2,  cost: 600,  build: 30,  max: 2, desc: 'Produces feed over time. Tap it to collect.' },
  vet:       { name: 'Vet Clinic',   unlock: 5,  cost: 2500, build: 90,  max: 1, desc: 'Halves treatment costs and slowly heals sick animals.' },
  showring:  { name: 'Show Ring',    unlock: 6,  cost: 3000, build: 120, max: 1, desc: 'Enter your best animals in competitions for ribbons and gems.' },
  fountain:  { name: 'Fountain',     unlock: 4,  cost: 1500, build: 30,  max: 3, desc: 'Decoration. All animals lose happiness 10% slower.' },
  gazebo:    { name: 'Gazebo',       unlock: 9,  cost: 5000, build: 60,  max: 2, desc: 'Decoration. Breeding success +6% and happiness 10% slower.' },
  lab:       { name: 'Genetics Lab', unlock: 13, cost: 9000, build: 240, max: 1, desc: 'Raises the mutation chance of every litter by half.' },
};

// Staff hired with a one-off fee then a running wage per minute.
export const STAFF = {
  cleaner: { name: 'Groundskeeper', unlock: 7,  fee: 1500, wage: 4,  desc: 'Cleans any habitat that drops below 40% cleanliness.' },
  feeder:  { name: 'Animal Keeper', unlock: 10, fee: 3000, wage: 6,  desc: 'Feeds hungry animals from your feed store.' },
  nurse:   { name: 'Vet Nurse',     unlock: 14, fee: 6000, wage: 10, desc: 'Treats sick animals automatically at the normal treatment cost.' },
};

export const HABITAT_UPGRADES = [
  { cap: 4,  cost: 0 },
  { cap: 6,  cost: 1.2 },
  { cap: 8,  cost: 3 },
  { cap: 10, cost: 7 },
  { cap: 12, cost: 15 },
];

export const LAND = { startPlots: 6, maxPlots: 18, perRow: 3, rowCost: [0, 0, 1500, 6000, 18000, 45000] };

export const FEED_PRICE = 4; // coins per unit
export const MILL = { rate: 12, cap: 80, perLevel: [1, 1.6, 2.4] }; // seconds per unit, stock cap

export const xpForLevel = lvl => Math.round(60 * Math.pow(lvl, 1.65));
export const MAX_LEVEL = 40;

export const NAMES = ['Biscuit','Mango','Pepper','Nugget','Waffles','Pickle','Daisy','Bluey','Bingo','Kiwi','Vegemite','Lamington','Banjo','Matilda','Ziggy','Pip','Juniper','Echo','Maple','Olive','Sunny','Rusty','Coco','Pebble','Tilly','Marlo','Fig','Pavlova','Scout','Willow','Clover','Basil','Hazel','Toffee','Taco','Noodle','Indie','Ruby','Stella','Milo','Archie','Frankie','Ollie','Luna','Bella','Teddy','Rosie','Winnie','Harley','Koda','Tango','Opal','Jasper','Wren','Poppy','Bramble','Saffron','Comet','Nova','Pumpkin','Bonnie','Dusty','Ned','Sheila','Bazza','Dougal','Gumnut','Wattle','Banksia','Cooper','Skipper','Arlo','Sprocket','Mochi','Sushi','Dumpling','Jellybean','Pretzel','Crumpet','Chai'];

// Guided goal chain. Each check receives the state and returns progress [have, need].
export const GOALS = [
  { id: 'g1',  text: 'Build a Hutch on an empty plot', reward: { coins: 150, xp: 20 }, check: s => [hab(s, 'hutch'), 1] },
  { id: 'g2',  text: 'Buy a male and a female Guinea Pig', reward: { coins: 120, xp: 20 }, check: s => [Math.min(sex(s, 'guineapig', 'm'), 1) + Math.min(sex(s, 'guineapig', 'f'), 1), 2] },
  { id: 'g3',  text: 'Feed your animals', reward: { feed: 30, xp: 15 }, check: s => [s.stats.feeds, 3] },
  { id: 'g4',  text: 'Breed your first litter', reward: { coins: 200, gems: 3, xp: 30 }, check: s => [s.stats.litters, 1] },
  { id: 'g5',  text: 'Sell an animal at the market', reward: { coins: 150, xp: 25 }, check: s => [s.stats.sold, 1] },
  { id: 'g6',  text: 'Fill a customer order', reward: { coins: 300, xp: 40 }, check: s => [s.stats.orders, 1] },
  { id: 'g7',  text: 'Build a Kennel and buy two Pugs', reward: { coins: 300, xp: 40 }, check: s => [Math.min(count(s, 'pug'), 2), 2] },
  { id: 'g8',  text: 'Build a Feed Mill', reward: { coins: 300, xp: 40 }, check: s => [bld(s, 'feedmill'), 1] },
  { id: 'g9',  text: 'Raise an animal with 4 stars or more', reward: { gems: 5, xp: 60 }, check: s => [s.stats.best4 ? 1 : 0, 1] },
  { id: 'g10', text: 'Own a Blue-and-gold Macaw', reward: { coins: 800, xp: 80 }, check: s => [count(s, 'bluegold') ? 1 : 0, 1] },
  { id: 'g11', text: 'Discover 15 species', reward: { gems: 8, xp: 120 }, check: s => [Object.keys(s.discovered).length, 15] },
  { id: 'g12', text: 'Win a ribbon at the Show Ring', reward: { gems: 6, xp: 120 }, check: s => [s.stats.ribbons, 1] },
  { id: 'g13', text: 'Breed a colour mutation', reward: { gems: 10, xp: 150 }, check: s => [s.stats.mutations, 1] },
  { id: 'g14', text: 'Discover a secret pairing', reward: { gems: 12, xp: 200 }, check: s => [s.stats.recipes, 1] },
  { id: 'g15', text: 'Fill 25 customer orders', reward: { coins: 6000, gems: 10, xp: 400 }, check: s => [s.stats.orders, 25] },
  { id: 'g16', text: 'Build the Wildlife Sanctuary', reward: { gems: 15, xp: 500 }, check: s => [hab(s, 'sanctuary'), 1] },
  { id: 'g17', text: 'Discover all 68 species', reward: { gems: 100, xp: 3000 }, check: s => [Object.keys(s.discovered).length, SPECIES_LIST.length] },
];

function hab(s, g) { return s.plots.filter(p => p && p.kind === 'habitat' && p.group === g && !p.building).length; }
function bld(s, b) { return s.plots.filter(p => p && p.kind === 'building' && p.type === b && !p.building).length; }
function count(s, sp) { return Object.values(s.animals).filter(a => a.species === sp).length; }
function sex(s, sp, x) { return Object.values(s.animals).filter(a => a.species === sp && a.sex === x).length; }

export const ACHIEVEMENTS = [
  { id: 'litters10',  name: 'Proud Parent',      desc: 'Breed 10 litters',            gems: 5,  check: s => s.stats.litters >= 10 },
  { id: 'litters100', name: 'Baby Boom',         desc: 'Breed 100 litters',           gems: 20, check: s => s.stats.litters >= 100 },
  { id: 'babies50',   name: 'Full House',        desc: 'Raise 50 babies',             gems: 8,  check: s => s.stats.babies >= 50 },
  { id: 'sold50',     name: 'Market Regular',    desc: 'Sell 50 animals',             gems: 8,  check: s => s.stats.sold >= 50 },
  { id: 'orders10',   name: 'Trusted Breeder',   desc: 'Fill 10 orders',              gems: 6,  check: s => s.stats.orders >= 10 },
  { id: 'orders50',   name: 'Household Name',    desc: 'Fill 50 orders',              gems: 20, check: s => s.stats.orders >= 50 },
  { id: 'five',       name: 'Five Star Bloodline', desc: 'Raise a 5 star animal',     gems: 10, check: s => s.stats.best5 },
  { id: 'mut5',       name: 'Colour Collector',  desc: 'Breed 5 mutations',           gems: 10, check: s => s.stats.mutations >= 5 },
  { id: 'rainbow',    name: 'Over the Rainbow',  desc: 'Breed a Rainbow mutation',    gems: 50, check: s => s.stats.rainbow },
  { id: 'ribbons5',   name: 'Best in Show',      desc: 'Win 5 first-place ribbons',   gems: 15, check: s => s.stats.firsts >= 5 },
  { id: 'recipes3',   name: 'Mad Scientist',     desc: 'Discover 3 secret pairings',  gems: 15, check: s => s.stats.recipes >= 3 },
  { id: 'recipesAll', name: 'Master Geneticist', desc: 'Discover every secret pairing', gems: 40, check: s => s.stats.recipes >= RECIPES.length },
  { id: 'species30',  name: 'Menagerie',         desc: 'Discover 30 species',         gems: 15, check: s => Object.keys(s.discovered).length >= 30 },
  { id: 'rich',       name: 'Cashed Up',         desc: 'Hold 50,000 coins at once',   gems: 10, check: s => s.coins >= 50000 },
  { id: 'rep',        name: 'Beloved Farm',      desc: 'Reach 90 reputation',         gems: 12, check: s => s.rep >= 90 },
  { id: 'macaw',      name: 'Macaw Mania',       desc: 'Own all four macaw species',  gems: 20, check: s => ['bluegold','scarlet','greenwing','hyacinth'].every(sp => Object.values(s.animals).some(a => a.species === sp)) },
  { id: 'bully',      name: 'Snort Squad',       desc: 'Own 3 Pugs and 3 French Bulldogs', gems: 8, check: s => ['pug','frenchie'].every(sp => Object.values(s.animals).filter(a => a.species === sp).length >= 3) },
  { id: 'shellshock', name: 'Shell Shocked',     desc: 'Own 4 different turtle and tortoise species', gems: 10, check: s => ['redeared','boxturtle','leopardtortoise','galapagos','seaturtle'].filter(sp => Object.values(s.animals).some(a => a.species === sp)).length >= 4 },
  { id: 'aussie',     name: 'True Blue',         desc: 'Own a Quokka, Koala, Wombat and Kangaroo', gems: 20, check: s => ['quokka','koala','wombat','kangaroo'].every(sp => Object.values(s.animals).some(a => a.species === sp)) },
  { id: 'level20',    name: 'Seasoned Farmer',   desc: 'Reach level 20',              gems: 20, check: s => s.level >= 20 },
];
