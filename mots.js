// Listes de mots par thème et par difficulté.
// Pour ajouter des mots : ajoutez-les simplement entre guillemets, séparés par des virgules.
module.exports = {
  "Maison & Bricolage": {
    facile: ["marteau", "clou", "lampe", "porte", "fenêtre", "chaise", "table", "lit", "clé", "échelle", "pinceau", "scie", "vis", "prise"],
    moyen: ["perceuse", "tournevis", "ampoule", "robinet", "escalier", "interrupteur", "radiateur", "étagère", "cheminée", "boîte à outils", "rallonge", "niveau à bulle"],
    difficile: ["disjoncteur", "court-circuit", "parquet flottant", "papier peint", "plinthe", "faux plafond", "tableau électrique", "mètre ruban", "dressing", "plan de travail"]
  },
  "Animaux": {
    facile: ["chat", "chien", "poisson", "oiseau", "vache", "cochon", "lapin", "serpent", "escargot", "souris", "canard", "abeille"],
    moyen: ["girafe", "éléphant", "pingouin", "tortue", "kangourou", "papillon", "requin", "hérisson", "araignée", "crocodile", "chauve-souris"],
    difficile: ["caméléon", "hippocampe", "ornithorynque", "paresseux", "méduse", "flamant rose", "fourmilier", "poulpe", "castor"]
  },
  "Cuisine": {
    facile: ["pomme", "banane", "gâteau", "pizza", "œuf", "pain", "fromage", "glace", "carotte", "frites", "tomate"],
    moyen: ["croissant", "hamburger", "spaghetti", "crêpe", "baguette", "sushi", "ananas", "brochette", "sandwich", "pastèque"],
    difficile: ["raclette", "fondue", "bouillabaisse", "macaron", "couscous", "tartiflette", "omelette norvégienne", "barbe à papa"]
  },
  "Métiers": {
    facile: ["pompier", "docteur", "cuisinier", "policier", "pilote", "peintre", "facteur", "boulanger"],
    moyen: ["électricien", "plombier", "jardinier", "coiffeur", "dentiste", "astronaute", "pêcheur", "menuisier"],
    difficile: ["archéologue", "cascadeur", "apiculteur", "serrurier", "carreleur", "chef d'orchestre", "météorologue", "plaquiste"]
  },
  "Loisirs & Sports": {
    facile: ["ballon", "vélo", "piscine", "guitare", "tennis", "ski", "cerf-volant", "plage", "tente"],
    moyen: ["skateboard", "trampoline", "bowling", "karaoké", "parachute", "piano", "camping", "pêche", "surf"],
    difficile: ["saut à l'élastique", "escalade", "plongée sous-marine", "montgolfière", "accrobranche", "patinage artistique", "jeu de fléchettes"]
  }
};
