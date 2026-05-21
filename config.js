module.exports = {
  // Connection string to MongoDB Atlas
  MONGO_URI: process.env.MONGO_URI ||
    'mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/tripplanner?retryWrites=true&w=majority',

  PORT: process.env.PORT || 3000,

  // Secret used to sign JWT tokens
  JWT_SECRET:  process.env.JWT_SECRET || 'tp-secret-change-me-in-prod',
  JWT_EXPIRES: '7d',

  // A palette of colors — one is picked randomly when a user registers and used as their avatar color throughout the app
  COLORS: ['#E8572A','#4A90A4','#6BAB5E','#9B59B6','#E67E22','#E91E63','#00BCD4','#3498DB','#1ABC9C','#F39C12'],

  // Pre-defined activity suggestions shown when a user asks for AI ideas.
  // Keyed by city name so we can do a quick lookup by the approved destination.
  ACTIVITY_SUGGESTIONS: {
    Paris:      ['🗼 Eiffel Tower','🎨 Louvre Museum','🥐 Croissant tour in Montmartre','🚢 Seine river cruise','🛍️ Champs-Élysées shopping','🍷 Wine bar in Le Marais'],
    Berlin:     ['🏛️ Berlin Wall','🎭 Pergamon Museum','🍺 Beer garden in Tiergarten','🎶 Techno night at Berghain','🚲 Bike tour of the city centre','🌊 Müggelsee lake'],
    Copenhagen: ['🧜 The Little Mermaid','🏰 Christiansborg Palace','🌿 Tivoli Gardens','🍣 Torvehallerne food market','🚲 Nørrebro neighbourhood ride','🌉 Nyhavn harbour'],
    Barcelona:  ['🏖️ Barceloneta beach','🏗️ Sagrada Família','🥘 Tapas tour in El Born','⚽ FC Barcelona match','🌺 Park Güell','🍹 Evening on Las Ramblas'],
    Amsterdam:  ['🚲 Bike tour along the canals','🖼️ Rijksmuseum','🌷 Keukenhof flower gardens','🧀 Cheese tasting','🛶 Canal cruise','🌿 Vondelpark picnic'],
    Vienna:     ['☕ Viennese coffee house','🎻 Classical music concert','🏰 Schönbrunn Palace','🎡 Prater funfair','🍰 Sachertorte at Hotel Sacher','🎨 Kunsthistorisches Museum'],
    Prague:     ['🏰 Prague Castle','🍺 Czech beer tasting','🌉 Charles Bridge','🎶 Jazz club evening','🥩 Svíčková dinner','🌃 Wenceslas Square'],
    Budapest:   ['♨️ Széchenyi thermal baths','🏰 Buda Castle','🌉 Chain Bridge walk','🍷 Wine tasting','🛶 Danube river cruise','🌆 Ruin bars in the Jewish quarter'],
    Bratislava: ['🏰 Bratislava Castle','🍷 Wine cellars in the Small Carpathians','🚶 Old Town walk','🎭 Slovak National Theatre','☕ Café tour','🌳 Sad Janka Krala park'],
    Lisbon:     ['🟡 Tram 28 ride','🏰 São Jorge Castle','🐟 Pastel de nata tasting','🌊 Cabo da Roca cliffs','🎵 Fado evening','🏖️ Day trip to Cascais'],
  }
};
