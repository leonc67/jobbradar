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

  /** Ord som tyder på sommerjobb, winternship eller internship. */
  periodKeywords: {
    summer: ['sommer', 'summer', 'sommerstudent', 'sommerjobb', 'sommerkonsulent'],
    winter: ['winternship', 'winter intern', 'vinter'],
    internship: ['intern', 'internship', 'praktikant', 'praksis'],
  },

  /** Ord som gjør at en stilling droppes helt (faste stillinger, deltid osv.). */
  excludeKeywords: [
    'graduate', 'nyutdannet', 'trainee', 'fast stilling', 'deltid', 'part-time',
    'part time', 'studentmedarbeider', 'student worker', 'åpen søknad', 'open application',
  ],

  /** Ord som tyder på en IT-stilling. */
  itKeywords: [
    'it', 'ikt', 'tech', 'teknologi', 'technology', 'digital', 'data', 'software',
    'utvikl', 'develop', 'engineer', 'ingeniør', 'kode', 'code', 'programmer',
    'cyber', 'sikkerhet', 'security', 'nettverk', 'network', 'cloud', 'sky',
    'backend', 'fullstack', 'ai', 'ki', 'maskinlæring', 'machine learning', 'analyse',
    'analytics', 'infrastructure', 'infrastruktur', 'devops', 'platform', 'plattform',
  ],

  /** Tekst som tyder på at stillingen krever et høyere årstrinn. */
  seniorPatterns: [
    /\b4\.\s*(år|årstrinn|klasse|trinn)/i,
    /\bfjerde\s+(år|årstrinn|studieår)/i,
    /\b(4th|fourth)[-\s]year\b/i,
    /\bsiste\s+studieår\b/i,
    /\buteksaminer\w*\s+(i\s+)?2028\b/i,
  ],

  /** Hvor langt tilbake NAV-feeden leses første gang (dager). */
  navInitialLookbackDays: 120,
  /** Maks antall feed-sider per kjøring, så én kjøring ikke tar evig tid. */
  navMaxPagesPerRun: 400,
} as const;
