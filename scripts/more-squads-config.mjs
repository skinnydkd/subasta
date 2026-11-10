// Shared config for fetch-more-squads.mjs and build-more-seeds.mjs.
// One entry per squad -> one tag, one dev_seed_id prefix (`key`).
//   group:   which seed file / category the squad belongs to
//   page:    Wikipedia page holding the squad table
//   teamSection: (tournament pages) the section title of the team
//   inline:  hand-curated squad (no usable Wikipedia table)

const club = (key, label, page, slug, group, extra = {}) => ({
	key,
	label,
	page,
	team: label,
	tagSlug: slug,
	tagCategory: 'club_season',
	group,
	...extra
});

const nat = (key, team, page, teamSection, slug, group, extra = {}) => ({
	key,
	label: team,
	page,
	teamSection,
	team,
	tagSlug: slug,
	tagCategory: 'national_team',
	group,
	...extra
});

export const SQUADS = [
	// ---- Premier League 2025-26 --------------------------------------------
	club('chel2526', 'Chelsea 2025-26', '2025–26 Chelsea F.C. season', 'chelsea-25-26', 'pl'),
	club('tot2526', 'Tottenham 2025-26', '2025–26 Tottenham Hotspur F.C. season', 'tottenham-25-26', 'pl'),
	club('mun2526', 'Manchester United 2025-26', '2025–26 Manchester United F.C. season', 'manutd-25-26', 'pl'),
	club('new2526', 'Newcastle United 2025-26', '2025–26 Newcastle United F.C. season', 'newcastle-25-26', 'pl'),
	club('avl2526', 'Aston Villa 2025-26', '2025–26 Aston Villa F.C. season', 'astonvilla-25-26', 'pl'),
	// ---- Serie A 2025-26 -----------------------------------------------------
	club('juv2526', 'Juventus 2025-26', '2025–26 Juventus FC season', 'juventus-25-26', 'seriea'),
	club('mil2526', 'AC Milan 2025-26', '2025–26 AC Milan season', 'milan-25-26', 'seriea'),
	club('rom2526', 'Roma 2025-26', '2025–26 AS Roma season', 'roma-25-26', 'seriea'),
	club('ata2526', 'Atalanta 2025-26', '2025–26 Atalanta BC season', 'atalanta-25-26', 'seriea'),
	club('laz2526', 'Lazio 2025-26', '2025–26 SS Lazio season', 'lazio-25-26', 'seriea'),
	club('fio2526', 'Fiorentina 2025-26', '2025–26 ACF Fiorentina season', 'fiorentina-25-26', 'seriea'),
	// ---- Bundesliga / Ligue 1 / Portugal 2025-26 -------------------------------
	club('bvb2526', 'Borussia Dortmund 2025-26', '2025–26 Borussia Dortmund season', 'dortmund-25-26', 'euro'),
	club('b042526', 'Bayer Leverkusen 2025-26', '2025–26 Bayer 04 Leverkusen season', 'leverkusen-25-26', 'euro'),
	club('ben2526', 'Benfica 2025-26', '2025–26 S.L. Benfica season', 'benfica-25-26', 'euro'),
	club('por2526', 'Porto 2025-26', '2025–26 FC Porto season', 'porto-25-26', 'euro'),
	club('spo2526', 'Sporting CP 2025-26', '2025–26 Sporting CP season', 'sporting-25-26', 'euro'),
	// two extra clubs so the Bundesliga/Ligue 1/Portugal pool reaches 25 goalkeepers and strikers
	club('rbl2526', 'RB Leipzig 2025-26', '2025–26 RB Leipzig season', 'leipzig-25-26', 'euro'),
	club('om2526', 'Marseille 2025-26', '2025–26 Olympique de Marseille season', 'marseille-25-26', 'euro'),
	// ---- National teams, current (2026 World Cup squads) ---------------------
	nat('espwc26', 'Espanya (selecció) Mundial 2026', '2026 FIFA World Cup squads', 'Spain', 'esp-wc-2026', 'natcur'),
	nat('argwc26', 'Argentina (selecció) Mundial 2026', '2026 FIFA World Cup squads', 'Argentina', 'arg-wc-2026', 'natcur'),
	nat('frawc26', 'França (selecció) Mundial 2026', '2026 FIFA World Cup squads', 'France', 'fra-wc-2026', 'natcur'),
	nat('brawc26', 'Brasil (selecció) Mundial 2026', '2026 FIFA World Cup squads', 'Brazil', 'bra-wc-2026', 'natcur'),
	nat('porwc26', 'Portugal (selecció) Mundial 2026', '2026 FIFA World Cup squads', 'Portugal', 'por-wc-2026', 'natcur'),
	nat('engwc26', 'Anglaterra (selecció) Mundial 2026', '2026 FIFA World Cup squads', 'England', 'eng-wc-2026', 'natcur'),
	nat('gerwc26', 'Alemanya (selecció) Mundial 2026', '2026 FIFA World Cup squads', 'Germany', 'ger-wc-2026', 'natcur'),
	nat('nedwc26', 'Països Baixos (selecció) Mundial 2026', '2026 FIFA World Cup squads', 'Netherlands', 'ned-wc-2026', 'natcur'),
	// Italy did not make the 2026 World Cup: use the latest squad on the team page.
	nat('itawc26', 'Itàlia (selecció) 2026', 'Italy national football team', undefined, 'ita-2026', 'natcur', {
		// the team page also lists ~50 recent call-ups: keep a hand-picked 30-man pool
		include: [
			'Gianluigi Donnarumma', 'Guglielmo Vicario', 'Marco Carnesecchi', 'Alex Meret',
			'Alessandro Bastoni', 'Federico Dimarco', 'Riccardo Calafiori', 'Giorgio Scalvini', 'Federico Gatti', 'Michael Kayode', 'Giovanni Di Lorenzo',
			'Gianluca Mancini', 'Alessandro Buongiorno', 'Andrea Cambiaso', 'Leonardo Spinazzola', 'Matteo Ruggeri', 'Pietro Comuzzo', 'Raoul Bellanova',
			'Nicolò Barella', 'Davide Frattesi', 'Sandro Tonali', 'Samuele Ricci', 'Nicolò Fagioli', 'Bryan Cristante', 'Manuel Locatelli', 'Rolando Mandragora',
			'Niccolò Pisilli', 'Gianluca Scamacca', 'Nicolò Zaniolo', 'Pio Esposito', 'Moise Kean', 'Giacomo Raspadori', 'Nicolò Cambiaghi'
		]
	}),
	// ---- National teams, historic -----------------------------------------------
	nat('espeuro08', 'Espanya (selecció) Eurocopa 2008', 'UEFA Euro 2008 squads', 'Spain', 'esp-euro-2008', 'nathist', { era: 'historic' }),
	nat('espwc10', 'Espanya (selecció) Mundial 2010', '2010 FIFA World Cup squads', 'Spain', 'esp-wc-2010', 'nathist', { era: 'historic' }),
	nat('espeuro12', 'Espanya (selecció) Eurocopa 2012', 'UEFA Euro 2012 squads', 'Spain', 'esp-euro-2012', 'nathist', { era: 'historic' }),
	nat('gerwc14', 'Alemanya (selecció) Mundial 2014', '2014 FIFA World Cup squads', 'Germany', 'ger-wc-2014', 'nathist', { era: 'historic' }),
	nat('argwc22', 'Argentina (selecció) Mundial 2022', '2022 FIFA World Cup squads', 'Argentina', 'arg-wc-2022', 'nathist', { era: 'historic' }),
	nat('frawc98', 'França (selecció) Mundial 1998', '1998 FIFA World Cup squads', 'France', 'fra-wc-1998', 'nathist', { era: 'historic' }),
	nat('frawc18', 'França (selecció) Mundial 2018', '2018 FIFA World Cup squads', 'France', 'fra-wc-2018', 'nathist', { era: 'historic' }),
	nat('itawc06', 'Itàlia (selecció) Mundial 2006', '2006 FIFA World Cup squads', 'Italy', 'ita-wc-2006', 'nathist', { era: 'historic' }),
	nat('brawc02', 'Brasil (selecció) Mundial 2002', '2002 FIFA World Cup squads', 'Brazil', 'bra-wc-2002', 'nathist', { era: 'historic' }),
	nat('poreuro16', 'Portugal (selecció) Eurocopa 2016', 'UEFA Euro 2016 squads', 'Portugal', 'por-euro-2016', 'nathist', { era: 'historic' }),
	// ---- Club legends ------------------------------------------------------------
	club('mun9899', 'Manchester United 1998-99', '1998–99 Manchester United F.C. season', 'manutd-1998-99', 'legend', { era: 'historic', inline: true }),
	club('mun0708', 'Manchester United 2007-08', '2007–08 Manchester United F.C. season', 'manutd-2007-08', 'legend', { era: 'historic', inline: true }),
	club('mil0203', 'AC Milan 2002-03', '2002–03 AC Milan season', 'milan-2002-03', 'legend', { era: 'historic', inline: true }),
	club('mil0607', 'AC Milan 2006-07', '2006–07 AC Milan season', 'milan-2006-07', 'legend', { era: 'historic', inline: true }),
	club('bar0506', 'FC Barcelona 2005-06', '2005–06 FC Barcelona season', 'barca-2005-06', 'legend', { era: 'historic', inline: true }),
	club('juv1617', 'Juventus 2016-17', '2016–17 Juventus FC season', 'juventus-2016-17', 'legend', { era: 'historic', inline: true }),
	club('liv0405', 'Liverpool 2004-05', '2004–05 Liverpool F.C. season', 'liverpool-2004-05', 'legend', { era: 'historic', inline: true })
];
