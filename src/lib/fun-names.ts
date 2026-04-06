const adjectives = [
  "Veseli",
  "Tihi",
  "Divlji",
  "Funky",
  "Groovy",
  "Brzi",
  "Spori",
  "Mocni",
  "Ludi",
  "Sramezljivi",
  "Tajni",
  "Neonski",
  "Retro",
  "Elektricni",
  "Akusticni",
  "Legendarni",
  "Vatreni",
  "Hladni",
  "Zvucni",
  "Rebel",
];

const nouns = [
  "DJ",
  "Bubnjar",
  "Gitarist",
  "Pjevac",
  "Basist",
  "Harmonikas",
  "Tamburas",
  "Trubac",
  "Klavijaturist",
  "Dancer",
  "Roker",
  "Reper",
  "Vocalist",
  "Producent",
  "Maestro",
  "Slusalac",
  "Frontmen",
  "Solista",
  "Beatboxer",
  "Violinist",
];

export function generateFunName(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj} ${noun}`;
}
