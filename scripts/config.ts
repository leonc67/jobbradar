/** Lager et regulært uttrykk som bare treffer hele ord (også med æøå). */
const word = (pattern: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, 'iu');

/**
 * Søkeprofil. Endre denne for å tilpasse hva som regnes som relevant.
 * Alt her er offentlig i repoet, så ikke legg inn personlige data.
 */
export const config = {
  /** Årstrinnet du går på når du søker (sommerjobben er etter dette året). */
  currentYear: 3,

  /** Steder du kan jobbe. Matches mot kildenes stedsfelt (små bokstaver, delstreng). */
  locations: [
    'oslo', 'bærum', 'baerum', 'sandvika', 'lysaker', 'fornebu', 'skøyen',
    'asker', 'kjeller', 'lillestrøm', 'lillestrom', 'trondheim', 'remote', 'hybrid',
  ],

  /**
   * Mønstre som tyder på sommerjobb, winternship eller internship. Hele ord, så
   * "intern" ikke treffer "internasjonal" og "sommer" ikke treffer "sommervikar".
   */
  periodPatterns: {
    summer: [
      word('summer'),
      word('sommer(jobb|jobber|student|studenter|konsulent|konsulenter|praktikant|intern|internship|forsker)'),
    ],
    winter: [word('winternships?'), word('winter\\s+interns?(hip)?')],
    internship: [word('interns?'), word('internships?'), word('praktikant(er)?')],
  },

  /**
   * Stillinger som er utløpt eller stengt, men som kilden fortsatt viser som løpende.
   * De fjernes fra siden for alle enheter. Nøkkelen er "key" i public/jobs.json.
   */
  removedKeys: [
    'pexip--software-engineers-internship-summer-2027', // utløpt, bare Reading (UK) igjen (nov 2026)
    'thales-norway-as--sommerjobb-oslo-2027', // utløpt (nov 2026)
    'thales-norway-as--sommerjobb-trondheim-2027', // utløpt (nov 2026)
  ] as string[],

  /** Ord som gjør at en stilling droppes helt (faste stillinger, deltid osv.). */
  excludeKeywords: [
    'graduate', 'nyutdannet', 'trainee', 'fast stilling', 'deltid', 'part-time',
    'part time', 'studentmedarbeider', 'student worker', 'åpen søknad', 'open application',
  ],

  /**
   * Mønstre som tyder på en IT-stilling. Sjekkes mot tittel og NAVs yrkeskategorier,
   * ikke hele beskrivelsen, fordi lange tekster nesten alltid nevner "data" et sted.
   */
  itPatterns: [
    word('it|ikt|ai|ki|tech|cyber|devops|backend|fullstack|software'),
    word('it-\\p{L}+|ikt-\\p{L}+'),
    word('teknologi\\p{L}*|technology|digital\\p{L}*|data\\p{L}*'),
    word('utvikl(er|ere|ing)\\p{L}*|develop(er|ment)?|programm\\p{L}*|kode|code'),
    word('(informasjons|data|nett|cyber)sikkerhet|(cyber|information|network)\\s+security|nettverk|network|cloud|skytjenester'),
    word('maskinlæring|machine\\s+learning|analytics|infrastruktur|infrastructure'),
  ],

  /** Tekst som tyder på at stillingen krever et høyere årstrinn. */
  seniorPatterns: [
    /\b4\.\s*(år|årstrinn|klasse|trinn)/i,
    /\bfjerde\s+(år|årstrinn|studieår)/i,
    /\b(4th|fourth)[-\s]year\b/i,
    /\bsiste\s+studieår\b/i,
    /\buteksaminer\w*\s+(i\s+)?2028\b/i,
  ],

  /**
   * Tekst som sier at ditt årstrinn også er velkomment, f.eks. "3. eller 4. året".
   * Treffer en av disse, flagges ikke stillingen for årstrinn selv om "4. år" også står der.
   */
  currentYearPatterns: [
    /\b3\.\s*(år|årstrinn|klasse|trinn)/i,
    /\b3\.\s*(eller|og|til|-|–)\s*[45]\./i,
    /\btredje\s+(år|årstrinn|studieår)/i,
    /\b(3rd|third)[-\s](year|or)\b/i,
  ],

  /** Hvor langt tilbake NAV-feeden leses første gang (dager). */
  navInitialLookbackDays: 120,
  /** Maks antall feed-sider per kjøring, så én kjøring ikke tar evig tid. */
  navMaxPagesPerRun: 400,
} as const;
