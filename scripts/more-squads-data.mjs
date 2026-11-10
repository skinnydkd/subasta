// Hand-made data for build-more-seeds.mjs: position overrides, name fixes,
// exclusions, hand-curated squads, market values, composite themes.
// Everything here is judgement on top of the scraped Wikipedia tables.

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

/** {value_m: [names]} -> {normName: value_m}; later tiers never override earlier ones. */
function tiers(spec) {
	const out = {};
	for (const [v, names] of Object.entries(spec).sort((a, b) => b[0] - a[0])) {
		for (const n of names) if (!(norm(n) in out)) out[norm(n)] = Number(v);
	}
	return out;
}

// ---- name fixes: Wikipedia link title or display name -> canonical name -------------
// Canonical = the spelling already used in seeds 04..13 so start_room de-dupes a
// person who shows up in several squads of one theme.
export const NAME_FIXES = {
	'Danilo Luiz': 'Danilo', // Brazil 2026 = Madrid's right-back (seed 'Danilo')
	'Danilo Pereira (Portuguese footballer)': 'Danilo Pereira', // Portugal 2016 midfielder: a different "Danilo"
	'Éderson Silva': 'Éderson', // Brazil 2026 = Atalanta's midfielder
	Ronaldo: 'Ronaldo Nazário' // Brazil 2002 / Milan 06-07 = seed 'Ronaldo Nazário'
};

// ---- exclusions per squad key (players who are not in that season's squad) ---------
// The season-page tables also list academy / U21 players: keep first-team-ish squads.
export const EXCLUDE = {
	mun2526: ['Diego León', 'Tyler Fredricson', 'Godwill Kukonki', 'Jack Fletcher', 'Tyler Fletcher', 'Toby Collyer', 'Jack Moorhouse', 'Jim Thwaites', 'Shea Lacey', 'Chido Obi', 'Bendito Mantato'],
	chel2526: ['Reggie Walsh', 'Jesse Derry', 'Ryan Kavuma-McQueen', 'Shim Mheuka'],
	tot2526: ['Souza', 'Dane Scarlett', 'Alfie Devine', 'Ashley Phillips', 'Alejo Véliz'],
	new2526: ['Max Thompson', 'Mark Gillespie', 'Leo Shahar', 'Harrison Ashby', 'Sam Alabi', 'Travis Hernes', 'Joe White', 'Park Seung-soo', 'Trevan Sanusi', 'Antonio Cordero', 'Sean Neave'],
	avl2526: [
		'James Wright', 'Triston Rowe', 'Travis Patterson', 'Lino Sousa', 'Yeimar Mosquera', 'Sil Swinkels', 'Yasin Özcan', 'Josh Feeney',
		'George Hemmings', 'Fletcher Boyd', 'Bradley Burrowes', 'Aidan Borland', "Tommi O'Reilly", 'Ben Broggio', 'Omar Khedr', 'Kadan Young',
		'Zépiqueno Redmond', 'Brian Madjo', 'Mason Cotcher', 'Rory Wilson', 'Louie Barry', 'Jamaldeen Jimoh-Aloba', 'Oliwier Zych'
	],
	juv2526: ['Jonas Rouhi'],
	rom2526: ['Antonio Arena'],
	laz2526: ['Romano Floriani Mussolini', 'Filipe Bordon', 'Gabriele Artistico', 'Adrian Przyborek', 'Saná Fernandes'],
	fio2526: ['Eddy Kouadio', 'Luis Balbo', 'Niccolò Fortini', 'Eman Košpo', 'Riccardo Braschi'],
	bvb2526: ['Almugera Kabar', 'Luca Reggiani', 'Mathis Albert', 'Samuele Inacio'],
	b042526: ['Axel Tape', 'Issa Traoré', 'Jeremiah Mensah', 'Montrell Culbreath'],
	ben2526: ['Diogo Ferreira', 'Joshua Wynder', 'Nuno Félix', 'João Veloso', 'João Rego', 'Diogo Prioste'],
	por2526: ['Diogo Fernandes', 'Tiago Silva', 'Bernardo Lima'],
	spo2526: ['Francisco Silva', 'Diego Callai'],
	rbl2526: ['Viggo Gebel', 'Andrija Maksimović', 'Ayodele Thomas', 'Suleman Sani', 'Tidiam Gomis', 'Samba Konaté', 'Kosta Nedeljković', 'Assan Ouédraogo']
};

// ---- position overrides by canonical name (applied to every squad) -----------------
// `Name` applies to every squad, `Name|key` only to that squad.
export const POSITION_OVERRIDES = {
	// --- wingers / full-backs the Wikipedia lead sentence ("forward", "defender") hides
	Neymar: 'LW',
	'Vinícius Júnior': 'LW',
	Raphinha: 'RW',
	'Gabriel Martinelli': 'LW',
	'Rafael Leão': 'LW',
	'Lionel Messi': 'RW',
	'Nicolás González': 'LW',
	'Morgan Rogers': 'LW',
	'Leroy Sané': 'RW',
	'Donyell Malen': 'RW',
	'Pedro Neto': 'RW',
	'Crysencio Summerville': 'RW',
	'Kenan Yıldız': 'LW',
	'Kamaldeen Sulemana': 'LW',
	'Nicola Zalewski': 'LW',
	Pepê: 'RW',
	'Amad Diallo': 'RW',
	'Nico Paz': 'CM',
	'Samú Costa': 'CM',
	'Mats Wieffer': 'CM',
	'Djed Spence': 'RB',
	'Diogo Dalot': 'RB',
	'Noussair Mazraoui': 'RB',
	'Patrick Dorgu': 'LB',
	'Robin Gosens': 'LB',
	'Andrea Cambiaso': 'RB',
	'Nicolò Zaniolo': 'RW',
	'Nicolò Cambiaghi': 'LW',
	Danilo: 'RB',
	'Marc Pubill': 'RB',
	'Lucas Hernandez': 'LB',
	'Nico O\'Reilly|engwc26': 'LB',
	'Joshua Kimmich|gerwc26': 'RB',
	'Cristiano Ronaldo|porwc26': 'ST',
	'Cristiano Ronaldo|poreuro16': 'ST',
	// --- historic national squads
	'David Silva': 'LW',
	'Jesús Navas': 'RW',
	'Sergio Ramos|espeuro08': 'RB',
	'Philipp Lahm': 'RB',
	'Benedikt Höwedes|gerwc14': 'LB',
	'Thomas Müller|gerwc14': 'RW',
	'Lukas Podolski': 'LW',
	'Julian Draxler': 'LW',
	'Vincent Candela': 'LB',
	'Lilian Thuram|frawc98': 'RB',
	'Robert Pires|frawc98': 'LW',
	'Thierry Henry|frawc98': 'LW',
	'Benjamin Pavard|frawc18': 'RB',
	'Djibril Sidibé': 'RB',
	'Lucas Hernandez|frawc18': 'LB',
	'Thomas Lemar': 'LW',
	'Ousmane Dembélé': 'RW',
	'Kylian Mbappé|frawc18': 'RW',
	Rivaldo: 'LW',
	Ronaldinho: 'LW',
	Cédric: 'RB',
	// Serie A / Ligue 1 wingers (keeps every league pool at >= 12 LW)
	'Christopher Nkunku': 'LW',
	'Matteo Cancellieri': 'LW',
	'Daniel Maldini': 'LW',
	'Mason Greenwood': 'RW',
	'Igor Paixão': 'LW'
};

// ---- hand-curated squads: key -> [{name, pos}] ------------------------------------
// The 7 "legend" seasons are curated by hand: their Wikipedia season pages have no
// first-team squad table (or list 45-55 players incl. reserves and leavers), so the
// winning squads are written from knowledge. Spelling follows seeds 04..13.
const P = (pos, ...names) => names.map((name) => ({ name, pos }));
export const INLINE_SQUADS = {
	// Treble winners (Premier League, FA Cup, Champions League)
	mun9899: [
		...P('GK', 'Peter Schmeichel', 'Raimond van der Gouw', 'Nick Culkin'),
		...P('RB', 'Gary Neville'),
		...P('LB', 'Denis Irwin', 'Phil Neville'),
		...P('CB', 'Jaap Stam', 'Ronny Johnsen', 'Henning Berg', 'David May', 'Wes Brown'),
		...P('CM', 'Roy Keane', 'Paul Scholes', 'Nicky Butt', 'Jonathan Greening', 'Jordi Cruyff'),
		...P('RW', 'David Beckham'),
		...P('LW', 'Ryan Giggs', 'Jesper Blomqvist'),
		...P('ST', 'Dwight Yorke', 'Andy Cole', 'Teddy Sheringham', 'Ole Gunnar Solskjær')
	],
	// Premier League + Champions League (Moscow)
	mun0708: [
		...P('GK', 'Edwin van der Sar', 'Tomasz Kuszczak', 'Ben Foster'),
		...P('RB', 'Wes Brown', 'Gary Neville', 'John O\'Shea'),
		...P('LB', 'Patrice Evra', 'Mikaël Silvestre'),
		...P('CB', 'Rio Ferdinand', 'Nemanja Vidić', 'Jonny Evans'),
		...P('CM', 'Michael Carrick', 'Paul Scholes', 'Owen Hargreaves', 'Darren Fletcher', 'Anderson'),
		...P('RW', 'Nani'),
		...P('LW', 'Cristiano Ronaldo', 'Ryan Giggs', 'Park Ji-sung'),
		...P('ST', 'Wayne Rooney', 'Carlos Tevez', 'Louis Saha', 'Dong Fangzhuo')
	],
	// Champions League winners (Old Trafford, v Juventus)
	mil0203: [
		...P('GK', 'Dida', 'Christian Abbiati', 'Valerio Fiori'),
		...P('RB', 'Thomas Helveg', 'Giuseppe Pancaro'),
		...P('LB', 'Paolo Maldini', 'Serginho', 'Kakha Kaladze'),
		...P('CB', 'Alessandro Nesta', 'Alessandro Costacurta', 'Roque Júnior', 'Martin Laursen', 'Dario Šimić'),
		...P('CM', 'Andrea Pirlo', 'Gennaro Gattuso', 'Clarence Seedorf', 'Rui Costa', 'Massimo Ambrosini', 'Fernando Redondo', 'Cristian Brocchi'),
		...P('RW', 'Ümit Davala', 'Ibrahim Ba'),
		...P('LW', 'Rivaldo'),
		...P('ST', 'Andriy Shevchenko', 'Filippo Inzaghi', 'Jon Dahl Tomasson', 'Javi Moreno')
	],
	// Champions League winners (Athens, v Liverpool)
	mil0607: [
		...P('GK', 'Dida', 'Zeljko Kalac', 'Christian Abbiati'),
		...P('RB', 'Cafu', 'Massimo Oddo'),
		...P('LB', 'Paolo Maldini', 'Marek Jankulovski', 'Serginho'),
		...P('CB', 'Alessandro Nesta', 'Kakha Kaladze', 'Alessandro Costacurta', 'Daniele Bonera', 'Giuseppe Favalli', 'Dario Šimić'),
		...P('CM', 'Andrea Pirlo', 'Gennaro Gattuso', 'Clarence Seedorf', 'Massimo Ambrosini', 'Kaká', 'Cristian Brocchi', 'Yoann Gourcuff'),
		...P('ST', 'Filippo Inzaghi', 'Alberto Gilardino', 'Ricardo Oliveira', 'Ronaldo Nazário', 'Marco Borriello')
	],
	// La Liga + Champions League winners (Paris, v Arsenal)
	bar0506: [
		...P('GK', 'Víctor Valdés', 'Albert Jorquera'),
		...P('RB', 'Oleguer', 'Juliano Belletti'),
		...P('LB', 'Giovanni van Bronckhorst', 'Sylvinho'),
		...P('CB', 'Carles Puyol', 'Rafael Márquez', 'Edmílson'),
		...P('CM', 'Xavi', 'Andrés Iniesta', 'Deco', 'Thiago Motta', 'Mark van Bommel', 'Gabri'),
		...P('RW', 'Lionel Messi', 'Ludovic Giuly'),
		...P('LW', 'Ronaldinho'),
		...P('ST', 'Samuel Eto\'o', 'Henrik Larsson', 'Javier Saviola', 'Maxi López')
	],
	// Serie A + Coppa Italia + Champions League final (Cardiff)
	juv1617: [
		...P('GK', 'Gianluigi Buffon', 'Neto', 'Marco Storari'),
		...P('RB', 'Dani Alves', 'Stephan Lichtsteiner'),
		...P('LB', 'Alex Sandro'),
		...P('CB', 'Giorgio Chiellini', 'Leonardo Bonucci', 'Andrea Barzagli', 'Medhi Benatia', 'Daniele Rugani'),
		...P('CM', 'Miralem Pjanić', 'Sami Khedira', 'Claudio Marchisio', 'Mario Lemina', 'Stefano Sturaro', 'Kwadwo Asamoah'),
		...P('RW', 'Juan Cuadrado', 'Paulo Dybala'),
		...P('LW', 'Mario Mandžukić', 'Marko Pjaca'),
		...P('ST', 'Gonzalo Higuaín')
	],
	// Champions League winners (Istanbul)
	liv0405: [
		...P('GK', 'Jerzy Dudek', 'Chris Kirkland', 'Scott Carson'),
		...P('RB', 'Steve Finnan', 'Josemi'),
		...P('LB', 'John Arne Riise', 'Djimi Traoré'),
		...P('CB', 'Sami Hyypiä', 'Jamie Carragher', 'Mauricio Pellegrino', 'Igor Bišćan'),
		...P('CM', 'Steven Gerrard', 'Xabi Alonso', 'Dietmar Hamann', 'Salif Diao'),
		...P('RW', 'Luis García', 'Vladimír Šmicer', 'Antonio Núñez'),
		...P('LW', 'Harry Kewell'),
		...P('ST', 'Milan Baroš', 'Djibril Cissé', 'Fernando Morientes', 'Florent Sinama Pongolle', 'Neil Mellor')
	]
};

// ---- market values (millions EUR) -----------------------------------------------------
// Values are "fame", not Transfermarkt: start_room weights picks by value^2, so
// stars must outweigh squad filler. Same scale as seeds 11/12 (Haaland 180).
export const VALUE_CURRENT = {
	byPos: { GK: 6, RB: 8, LB: 8, CB: 10, CM: 12, RW: 12, LW: 12, ST: 12 },
	names: tiers({
		200: ['Lamine Yamal', 'Vinícius Júnior'],
		180: ['Kylian Mbappé', 'Jude Bellingham', 'Erling Haaland'],
		120: ['Cole Palmer'],
		110: ['Pedri', 'Jamal Musiala', 'Phil Foden', 'Bukayo Saka'],
		100: ['Rodri', 'Federico Valverde', 'Declan Rice', 'Florian Wirtz', 'Harry Kane'],
		90: ['Vitinha', 'João Neves', 'Martin Ødegaard', 'Alexander Isak', 'Rodrygo', 'Lautaro Martínez', 'Julián Alvarez', 'Ousmane Dembélé',
			'Khvicha Kvaratskhelia', 'Moisés Caicedo', 'Enzo Fernández', 'Michael Olise'],
		85: ['Nico Williams', 'Morgan Rogers'],
		80: ['Aurélien Tchouaméni', 'Pau Cubarsí', 'Gavi', 'Raphinha', 'William Saliba', 'Désiré Doué', 'Nicolò Barella', 'Kenan Yıldız', 'Bruno Guimarães',
			'Gabriel Magalhães', 'Gabriel'],
		75: ['Mohamed Salah', 'Alessandro Bastoni'],
		70: ['Marcus Thuram', 'Achraf Hakimi', 'Eduardo Camavinga', 'Arda Güler', 'Viktor Gyökeres', 'Rúben Dias', 'Joško Gvardiol', 'Bernardo Silva',
			'Trent Alexander-Arnold', 'Rafael Leão', 'Cristian Romero', 'Estêvão', 'Anthony Gordon', 'Sandro Tonali', 'Bruno Fernandes', 'Benjamin Šeško'],
		65: ['Alexis Mac Allister', 'Bradley Barcola', 'Xavi Simons', 'Bryan Mbeumo', 'Matheus Cunha', 'Tijjani Reijnders'],
		60: ['Micky van de Ven', 'Nick Woltemade', 'Dani Olmo', 'Jules Koundé', 'Warren Zaïre-Emery', 'Ibrahima Konaté', 'Joshua Kimmich', 'João Pedro',
			'Eberechi Eze', 'Marcus Rashford', 'Harry Kane', 'Cristiano Ronaldo', 'Lionel Messi', 'Dayot Upamecano', 'Dušan Vlahović', 'Declan Rice'],
		55: ['Reece James', 'Levi Colwill', 'Nuno Mendes', 'Mohammed Kudus', 'Mikel Oyarzabal', 'Marquinhos', 'Martinelli', 'Gabriel Martinelli', 'Levi Colwill'],
		50: ['Pedro Neto', 'Mikel Merino', 'Martín Zubimendi', 'Rayan Cherki', 'Endrick', 'Lisandro Martínez', 'Leny Yoro', 'Gonçalo Ramos', 'Florian Wirtz',
			'Cody Gakpo', 'Christian Pulisic', 'Nico Paz', 'Dejan Kulusevski', 'Ollie Watkins', 'Nico O\'Reilly', 'Alphonso Davies', 'Neymar', 'Marc Cucurella',
			'Federico Dimarco', 'Fabián Ruiz', 'Raphaël Varane', 'Ryan Gravenberch'],
		45: ['Kobbie Mainoo', 'Amadou Onana', 'Boubacar Kamara', 'Rúben Neves', 'Éderson', 'Jonathan David', 'Jarrod Bowen', 'Jonathan Tah', 'Elliot Anderson',
			'Lucas Paquetá', 'Maghnes Akliouche', 'João Félix', 'Mathys Tel'],
		40: ['Alejandro Garnacho', 'Jamie Gittens', 'Jorrel Hato', 'Sven Botman', 'Joelinton', 'Tino Livramento', 'Pedro Porro', 'Amad Diallo', 'Youri Tielemans',
			'Ezri Konsa', 'Gleison Bremer', 'Bremer', 'Teun Koopmeiners', 'Lois Openda', 'Loïs Openda', 'Khéphren Thuram', 'Mike Maignan', 'Serhou Guirassy',
			'Nico Schlotterbeck', 'Álex Grimaldo', 'Patrik Schick', 'Diogo Costa', 'Kai Havertz', 'Leroy Sané', 'Frenkie de Jong', 'Moise Kean', 'Manu Koné',
			'Rasmus Højlund', 'Matthijs de Ligt', 'Lucas Digne', 'Ousmane Diomande', 'Morten Hjulmand', 'Samu Aghehowa', 'Théo Hernandez', 'Ferran Torres',
			'Dominic Solanke', 'João Palhinha', 'Maddison', 'James Maddison', 'Franco Mastantuono'],
		35: ['Marc Guéhi', 'Wesley Fofana', 'Malo Gusto', 'Lewis Hall', 'Harvey Barnes', 'Destiny Udogie', 'Lucas Bergvall', 'Archie Gray', 'Pape Matar Sarr',
			'Malick Thiaw', 'Andrea Cambiaso', 'Francisco Conceição', 'Christopher Nkunku', 'Santiago Giménez', 'Fikayo Tomori', 'Matías Soulé', 'Mile Svilar',
			'Alisson', 'Gonçalo Inácio', 'Geovany Quenda', 'António Silva', 'Marcos Llorente', 'Delap', 'Liam Delap', 'Nicolas Jackson', 'Jadon Sancho', 'Maxence Lacroix',
			'Felix Nmecha', 'Karim Adeyemi', 'Edmond Tapsoba', 'Calafiori', 'Riccardo Calafiori', 'Alessandro Buongiorno', 'Donnarumma', 'Gianluigi Donnarumma', 'Ederson Moraes',
			'Thiago Almada', 'Nahuel Molina', 'Diogo Dalot', 'Dayot', 'Hugo Ekitike', 'Giovanni Di Lorenzo', 'Anthony Elanga'],
		30: ['Casemiro', 'Manuel Ugarte', 'Patrick Dorgu', 'Mason Mount', 'Adrien Rabiot', 'Strahinja Pavlović', 'Yoane Wissa', 'Jacob Ramsey', 'Pau Torres', 'Ian Maatsen',
			'Manuel Locatelli', 'Edon Zhegrova', 'Donyell Malen', 'Conor Gallagher', 'Wilson Odobert', 'Trevoh Chalobah', 'Andrey Santos', 'Roméo Lavia',
			'Gianluca Mancini', 'Evan Ndicka', 'Neil El Aynaoui', 'Giorgio Scalvini', 'Raoul Bellanova', 'Gianluca Scamacca', 'Mattia Zaccagni', 'Malik Tillman',
			'Julian Brandt', 'Waldemar Anton', 'Michael Kayode', 'Leon Goretzka', 'Aleksandar Pavlović', 'Stanislav Lobotka', 'Jakub Kiwior', 'Mateo Kovačić',
			'Nicolás González', 'Raúl Asencio', 'David Raya', 'Unai Simón', 'Álex Baena', 'Joan Garcia', 'Gianluca Mancini', 'Leandro Paredes', 'Rodrigo De Paul', 'Exequiel Palacios'],
		25: ['Ángel Di María', 'Paulo Dybala', 'Lorenzo Pellegrini', 'Gregor Kobel', 'Emiliano Martínez', 'Jordan Pickford', 'Dean Henderson', 'Bart Verbruggen',
			'Marco Carnesecchi', 'Isak Hien', 'Charles De Ketelaere', 'Lazar Samardžić', 'Mario Pašalić', 'Odilon Kossounou', 'Giacomo Raspadori', 'Yunus Musah',
			'Nolan', 'Pietro Comuzzo', 'Albert Guðmundsson', 'Rolando Mandragora', 'Dodô', 'Marin Pongračić', 'Nicolò Fagioli', 'Cher Ndour', 'Sandro',
			'Niclas Füllkrug', 'Robin Gosens', 'Nikola Krstović', 'Vangelis Pavlidis', 'Heorhiy Sudakov', 'Trubin', 'Anatoliy Trubin', 'Pedro Gonçalves', 'Zeno Debast',
			'Alan Varela', 'Gabri Veiga', 'Rodrigo Mora', 'Lutsharel Geertruida', 'Mats Wieffer', 'Denzel Dumfries', 'Nathan Aké', 'Alexis Saelemaekers', 'Youssouf Fofana',
			'Samuele Ricci', 'Ardon Jashari', 'Gustav Isaksen', 'Nicolò Rovella', 'Mario Gila', 'Matteo Guendouzi', 'Yan Couto', 'Jarell Quansah', 'Ibrahim Maza',
			'Christian Kofane', 'Eliesse Ben Seghir', 'Martin Terrier', 'Exequiel Palacios', 'Eric García', 'Simeone', 'Giuliano Simeone', 'Víctor Muñoz', 'Yéremy Pino',
			'Brian Brobbey', 'Noa Lang', 'Quinten Timber', 'Kluivert', 'Justin Kluivert', 'Stefan de Vrij', 'Crysencio Summerville', 'Pierre Kalulu', 'Michele Di Gregorio',
			'Senne Lammens', 'Mazraoui', 'Noussair Mazraoui', 'Pascal Groß', 'Angelo Stiller', 'Antonio Rüdiger', 'Deniz Undav', 'Jean-Philippe Mateta', 'Ruben Dias']
	})
};
// RB Leipzig and Marseille 2025-26 (added later to fill the Bundesliga/Ligue 1 pool)
for (const [n, v] of Object.entries(
	tiers({
		50: ['Mason Greenwood'],
		40: ['Castello Lukeba', 'Yan Diomande'],
		35: ['Antonio Nusa'],
		30: ['Christoph Baumgartner', 'Ethan Nwaneri', 'Benjamin Pavard'],
		25: ['Brajan Gruda', 'Nicolas Seiwald', 'Johan Bakayoko', 'Maarten Vandevoordt', 'Leonardo Balerdi', 'Amine Gouiri'],
		20: ['Ezechiel Banzuzi', 'Gerónimo Rulli', 'Nayef Aguerd', 'Pierre-Emile Højbjerg', 'Igor Paixão', 'Arthur Vermeeren', 'Xaver Schlager'],
		15: ['David Raum', 'Ridle Baku', 'Timothy Weah', 'Himad Abdelli', 'El Chadaille Bitshiabu', 'Facundo Medina', 'Pierre-Emerick Aubameyang']
	})
))
	if (!(n in VALUE_CURRENT.names)) VALUE_CURRENT.names[n] = v;

export const VALUE_HISTORIC = {
	byPos: { GK: 5, RB: 8, LB: 8, CB: 10, CM: 12, RW: 15, LW: 15, ST: 15 },
	names: tiers({
		120: ['Lionel Messi', 'Cristiano Ronaldo'],
		100: ['Ronaldinho', 'Ronaldo Nazário', 'Zinedine Zidane', 'Kaká', 'Kylian Mbappé'],
		90: ['Andriy Shevchenko', 'Steven Gerrard', 'Paulo Dybala'],
		80: ['Antoine Griezmann', 'Rivaldo', 'Wayne Rooney'],
		75: ['Andrés Iniesta'],
		70: ['Xavi', 'Fernando Torres', 'Toni Kroos', 'Thomas Müller', 'Paul Pogba', 'Andrea Pirlo', 'Francesco Totti', "Samuel Eto'o", 'Gonzalo Higuaín', 'Lautaro Martínez'],
		60: ['Iker Casillas', 'Cesc Fàbregas', 'David Villa', 'Manuel Neuer', 'Philipp Lahm', 'Bastian Schweinsteiger', 'Mesut Özil', 'Gianluigi Buffon',
			'Alessandro Del Piero', 'Roberto Carlos', 'Paul Scholes', 'Ryan Giggs', 'Paolo Maldini', 'Carlos Tevez', 'Julián Alvarez', 'Enzo Fernández',
			"N'Golo Kanté", 'Ousmane Dembélé'],
		55: ['Fabio Cannavaro', 'Rio Ferdinand', 'Roy Keane', 'Leonardo Bonucci', 'Miralem Pjanić', 'Raphaël Varane', 'Alessandro Nesta', 'Cristian Romero', 'Sergio Ramos'],
		50: ['Gerard Piqué', 'Sergio Busquets', 'David Silva', 'Mats Hummels', 'Mario Götze', 'Peter Schmeichel', 'Dwight Yorke', 'Deco', 'Cafu', 'Alex Sandro',
			'Alexis Mac Allister', 'Nemanja Vidić', 'Thierry Henry'],
		45: ['Xabi Alonso', 'Carles Puyol', 'Jaap Stam', 'Luca Toni', 'Dani Alves', 'Giorgio Chiellini', 'Lisandro Martínez', 'Jérôme Boateng', 'Marcel Desailly',
			'Lilian Thuram', 'Patrice Evra'],
		40: ['Juan Mata', 'Jordi Alba', 'Miroslav Klose', 'Sami Khedira', 'Michael Carrick', 'Nani', 'David Trezeguet', 'Ángel Di María', 'Rodrigo De Paul',
			'Claudio Marchisio', 'Daniele De Rossi', 'Andy Cole', 'Rui Costa', 'Clarence Seedorf', 'Filippo Inzaghi', 'Patrick Vieira', 'Mario Mandžukić'],
		35: ['Pedro', 'Renato Sanches', 'Samuel Umtiti', 'Hugo Lloris', 'Javi Martínez', 'Gianluca Zambrotta', 'Laurent Blanc', 'Thomas Lemar', 'Didier Deschamps',
			'Emmanuel Petit', 'Youri Djorkaeff', 'Anderson', 'Rafael Márquez', 'Ole Gunnar Solskjær', 'Edwin van der Sar'],
		30: ['Gennaro Gattuso', 'Fabien Barthez', 'Santi Cazorla', 'Lukas Podolski', 'André Schürrle', 'Julian Draxler', 'Teddy Sheringham', 'Juan Cuadrado',
			'Benjamin Pavard', 'Lucas Hernandez', 'Corentin Tolisso', 'Nabil Fekir', 'André Gomes', 'João Mário', 'João Moutinho', 'Raphaël Guerreiro', 'Fernando Llorente',
			'Henrik Larsson', 'Alberto Gilardino', 'Gilberto Silva', 'Lúcio', 'Robert Pires', 'Dida', 'Jesús Navas'],
		25: ['Emiliano Martínez', 'Víctor Valdés', 'Nahuel Molina', 'Ricardo Quaresma', 'Rui Patrício', 'William Carvalho', 'Leandro Paredes', 'Exequiel Palacios',
			'Denílson', 'Xherdan Shaqiri', 'Benjamin Mendy', 'Djibril Cissé', 'Milan Baroš', 'Luis García', 'Harry Kewell', 'Fernando Morientes', 'Gary Neville',
			'Owen Hargreaves', 'Nicolás Otamendi', 'Rúben Dias', 'Marcos', 'Kakha Kaladze', 'Daniele Rugani', 'Medhi Benatia', 'Juliano Belletti'],
		20: ['Jerzy Dudek', 'Sami Hyypiä', 'Jamie Carragher', 'John Arne Riise', 'Ricardo Carvalho', 'Pepe', 'Adrien Silva', 'Danilo Pereira', 'Rafa Silva', 'Marcos Acuña',
			'Ángel Correa', 'Guido Rodríguez', 'Kléberson', 'Juninho Paulista', 'Edmílson', 'Marco Materazzi', 'Mauro Camoranesi', 'Fabio Grosso', 'Simone Perrotta',
			'Bixente Lizarazu', 'Christian Karembeu', 'Denis Irwin', 'Nicky Butt', 'Jonny Evans', 'Ben Foster', 'Darren Fletcher', 'Park Ji-sung', 'Marko Pjaca',
			'Stephan Lichtsteiner', 'Marco Borriello', 'Yoann Gourcuff', 'Marek Jankulovski', 'Massimo Ambrosini', 'Jon Dahl Tomasson',
			'Thiago Motta', 'Mark van Bommel', 'Giovanni van Bronckhorst', 'Javier Saviola', 'Ludovic Giuly', 'Maxi López', 'Kwadwo Asamoah', 'Mario Lemina']
	})
};

// ---- composite themes ---------------------------------------------------------------------
const byGroup = (g) => (squads) => squads.filter((s) => s.group === g && s.players.length).map((s) => s.tagSlug);

const PL_EXISTING = ['mancity-25-26', 'arsenal-25-26', 'liverpool-25-26'];
const SERIEA_EXISTING = ['inter-25-26', 'napoli-25-26'];
const EURO_EXISTING = ['bayern-25-26', 'psg-25-26'];
const LEGEND_EXISTING = [
	'barca-2008-09', 'barca-2010-11', 'barca-2014-15',
	'madrid-2002-03', 'madrid-2013-14', 'madrid-2015-16', 'madrid-2016-17', 'madrid-2017-18',
	'inter-2009-10', 'chelsea-2011-12', 'bayern-2012-13', 'liverpool-2018-19', 'bayern-2019-20'
];
const LALIGA = ['laliga-25-26'];

const uniq = (a) => [...new Set(a)];

export const THEMES = [
	{
		slug: 'premier-league-25-26',
		name: 'Premier League 2025-26',
		desc: 'Vuit clubs de la Premier: City, Arsenal, Liverpool, Chelsea, Tottenham, United, Newcastle i Aston Villa.',
		tags: (s) => uniq([...PL_EXISTING, ...byGroup('pl')(s)])
	},
	{
		slug: 'serie-a-25-26',
		name: 'Serie A 2025-26',
		desc: 'Vuit clubs de la Serie A: Inter, Nàpols, Juventus, Milan, Roma, Atalanta, Lazio i Fiorentina.',
		tags: (s) => uniq([...SERIEA_EXISTING, ...byGroup('seriea')(s)])
	},
	{
		slug: 'bundesliga-ligue1-portugal-25-26',
		name: 'Bundesliga, Ligue 1 i Portugal 25-26',
		desc: 'Bayern, Dortmund, Leverkusen, Leipzig, PSG, Marseille, Benfica, Porto i Sporting: els grans d\'Alemanya, França i Portugal.',
		tags: (s) => uniq([...EURO_EXISTING, ...byGroup('euro')(s)])
	},
	{
		slug: 'seleccions-actuals',
		name: 'Seleccions actuals',
		desc: 'Les llistes del Mundial 2026 d\'Espanya, Argentina, França, Brasil, Portugal, Anglaterra, Alemanya i Països Baixos, més l\'última convocatòria d\'Itàlia.',
		tags: byGroup('natcur')
	},
	{
		slug: 'seleccions-historiques',
		name: 'Seleccions històriques',
		desc: 'Seleccions campiones: Espanya 2008, 2010 i 2012, Alemanya 2014, Argentina 2022, França 1998 i 2018, Itàlia 2006, Brasil 2002 i Portugal 2016.',
		tags: byGroup('nathist')
	},
	{
		slug: 'llegendes-futbol-europeu',
		name: 'Llegendes del futbol europeu',
		desc: 'United 98-99 i 07-08, Milan 02-03 i 06-07, Barça 05-06, Juventus 16-17, Liverpool 04-05 i els campions d\'Europa dels 2010.',
		tags: (s) => uniq([...byGroup('legend')(s), ...LEGEND_EXISTING])
	},
	{
		slug: 'top-lligues-25-26',
		name: 'Top lligues 2025-26',
		desc: 'LaLiga, Premier, Serie A, Bundesliga, Ligue 1 i Portugal: 30 clubs de la temporada 25-26 en una sola subhasta.',
		tags: (s) => uniq([...LALIGA, ...PL_EXISTING, ...SERIEA_EXISTING, ...EURO_EXISTING, ...byGroup('pl')(s), ...byGroup('seriea')(s), ...byGroup('euro')(s)])
	},
	{
		slug: 'tot-el-futbol',
		name: 'Tot el futbol',
		desc: 'Tots els clubs, seleccions i èpoques de la base de dades barrejats: de Zidane a Lamine Yamal.',
		tags: (s) => uniq([
			...LALIGA, ...PL_EXISTING, ...SERIEA_EXISTING, ...EURO_EXISTING, ...LEGEND_EXISTING,
			'villarreal-2005-06', 'villarreal-2007-08', 'villarreal-2010-11',
			...s.filter((x) => x.players.length).map((x) => x.tagSlug)
		])
	}
];
