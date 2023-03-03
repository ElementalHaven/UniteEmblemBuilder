//#region classes

class Pokemon {
	name: string;
	posStat: string;
	negStat: string;
	colors: string[] = [];
	id?: number;
	sameStats?: string[];
}

class Effect {
	stat: string;
	amount: number;
}

class ResultingEffect extends Effect {
	good: boolean;
	percent: boolean;
}

class ComboEffect extends Effect {
	color: string;
	startCount: number;
}

class Emblem {
	pokemonName: string;
	grade: number;
	count: number;
}

class Filter {
	value: string;
	compare: number;
	isColor: boolean;
}

const MIN_MON_BITS = 7;
const BITS_PER_CHAR = 6;
const BIT_CHAR_MASK = (1 << BITS_PER_CHAR) - 1;

class B64Convert {
	static parseChar(char: string): number {
		let cp = char.charCodeAt(0);
		// + and -
		if(cp == 43) return 63;
		if(cp == 45) return 62;
		// uppercase
		if(cp > 64 && cp < 91) return cp - 39;
		// lowercase
		if(cp > 96 && cp < 123) return cp - 97;
		// numbers
		if(cp > 47 && cp < 58) return cp + 4;
		return 0;
	}

	static toChar(val: number): string {
		let cp = 97;
		if(val < 26) cp = val + 97;
		else if(val < 52) cp = 39 + val;
		else if(val < 62) cp = val - 4;
		else if(val == 62) cp = 45;
		else if(val == 63) cp = 43;
		return String.fromCharCode(cp);
	}

	private strValue: string;
	// number of bits currently in bitValue
	private bitCount: number = 0;
	private bitValue: number = 0;

	constructor(value?: string) {
		this.strValue = value || "";
	}

	readBits(count: number): number {
		while(this.bitCount < count) {
			if(this.strValue.length) {
				let newBits = B64Convert.parseChar(this.strValue[0]);
				this.strValue = this.strValue.substring(1);
				this.bitValue |= newBits << this.bitCount;
				this.bitCount += BITS_PER_CHAR;
			} else {
				// just use 0s for remaining
				this.bitCount = count;
			}
		}
		const mask = (1 << count) - 1;
		let out = this.bitValue & mask;
		this.bitValue >>>= count;
		this.bitCount -= count;
		return out;
	}

	private encodeBits(pad: boolean = false) {
		while(true) {
			let hasEnough = this.bitCount >= BITS_PER_CHAR;
			let shouldPad = pad && this.bitValue;
			if(!hasEnough && !shouldPad) break;

			if(!hasEnough) {
				this.bitCount = BITS_PER_CHAR;
			}
			this.strValue += B64Convert.toChar(this.bitValue & BIT_CHAR_MASK);
			this.bitValue >>>= BITS_PER_CHAR;
			this.bitCount -= BITS_PER_CHAR;
		}
	}

	writeBits(value: number, count: number): void {
		this.bitValue |= value << this.bitCount;
		this.bitCount += count;
		if(value) this.encodeBits();
	}

	endWrite(): string {
		if(this.bitValue) {
			this.encodeBits(true);
		}
		return this.strValue;
	}
}

//#endregion

//#region global variables

var pkmnList: Pokemon[];
const pkmnByName: Map<string, Pokemon> = new Map();
const pkmnById: Map<number, Pokemon> = new Map();
const combos: ComboEffect[] = [
	{
		color: "Green",
		startCount: 2,
		stat: "Sp. Attack",
		amount: 1
	},
	{
		color: "Yellow",
		startCount: 3,
		stat: "Movement Speed",
		amount: 3 
	},
	{
		color: "Red",
		startCount: 3,
		stat: "Basic Attack Speed",
		amount: 2
	},
	{
		color: "Blue",
		startCount: 2,
		stat: "Defense",
		amount: 2
	},
	{
		color: "White",
		startCount: 2,
		stat: "HP",
		amount: 1
	},
	{
		color: "Black",
		startCount: 3,
		stat: "Move Cooldown Reduction",
		amount: 2
	},
	{
		color: "Brown",
		startCount: 2,
		stat: "Attack",
		amount: 1
	},
	{
		color: "Purple",
		startCount: 2,
		stat: "Sp. Defense",
		amount: 2
	},
	{
		color: "Pink",
		startCount: 3,
		stat: "Hindrance Effect Duration",
		amount: 4
	},
	{
		color: "Navy",
		startCount: 3,
		stat: "Unite Move Cooldown Reduction",
		amount: 1
	},
	{
		color: "Gray",
		startCount: 3,
		stat: "Damage Reduction",
		amount: 3
	}
]
var activeEmblems: Emblem[];
var userEmblems: Emblem[];
var defaultTier = 0;
const tierNames = ["Bronze", "Silver", "Gold"];
const maxEmblems = 10;
const statNames = [
	"HP", "Attack", "Defense", "Sp. Attack", "Sp. Defense",
	"Speed", "Critical-Hit Rate", "Cooldown Reduction"
];
const statRates = [
	[30, 40, 50],
	[1.2, 1.6, 2],
	[3, 4, 5],
	[1.8, 2.4, 3],
	[3, 4, 5],
	[21, 28, 35],
	[0.6, 0.8, 1],
	// guessed values. 1st is from an image. spreadsheet I used said 0.6, 0.8, 1
	[0.3, 0.4, 0.5]
];
const ownershipFlags = 0b11000;
// I knew Java had this syntax, but was unaware of Javascript having it.
// Apparently it was added in ES6
var filterFlags = 0b11111;
var filters = [new Filter(), new Filter()];
var shareCode: string = null;
/*const likelyPopular = [
	"Arcanine", "Fearow", "Machamp", "Alakazam", "Venusaur",
	"Rattata", "Pidgey", "Victreebel", "Gengar", "Beedrill",
	"Rapidash", "Vileplume", "Venomoth" // saving last spot as a special case
];*/
const likelyPopularIds = [
	59, 22, 68, 65, 3, 19, 16, 71, 94, 15, 78, 45, 49
];

//#endregion

function getComboEffect(color: string, count: number): ResultingEffect {
	for(const combo of combos) {
		if(combo.color !== color) continue;
		let minCount = combo.startCount;
		if(count < minCount) return null;
		let effect: ResultingEffect = {
			stat: combo.stat,
			amount: combo.amount,
			good: true,
			// maybe gray is a percent. I'd have to see it in game or a picture
			percent: color != "Gray"
		}
		if(count >= minCount + 2) effect.amount *= 2;
		if(count >= minCount + 4) effect.amount *= 2;
		if(color === "yellow" && count < 5) effect.amount = 4;
		return effect;
	}
}

function applyFlatEffect(
	statName: string,
	grade: number,
	effects: Map<string, number>,
	multiplier: number = 1
): void {
	let val = effects.get(statName) ?? 0;
	let change = statRates[statNames.indexOf(statName)][grade] * multiplier;
	// increase values so it ends up as integer math temporarily(hopefully)
	val = (val * 10 + change * 10) / 10;
	effects.set(statName, val);
}

function calculateResults(): ResultingEffect[] {
	let colorCounts: Map<string, number> = new Map();
	let effects: Map<string, number> = new Map();
	for(let i = 0; i < activeEmblems.length; i++) {
		let emblem = activeEmblems[i];
		let pokemon = pkmnByName.get(emblem.pokemonName);

		applyFlatEffect(pokemon.posStat, emblem.grade, effects, emblem.count);
		applyFlatEffect(pokemon.negStat, emblem.grade, effects, -emblem.count);

		let applyColors = true;
		for(let j = 0; j < i; j++) {
			if(activeEmblems[j].pokemonName == emblem.pokemonName) {
				applyColors = false;
				break;
			}
		}

		if(applyColors) {
			for(let color of pokemon.colors) {
				let count = colorCounts.get(color) ?? 0;
				colorCounts.set(color, ++count);
			}
		}
	}

	let fxArray: ResultingEffect[] = [];
	// only add non-zero values
	for(let [stat, val] of effects) {
		if(val < -0.01 || val > 0.01) {
			fxArray.push({
				stat: stat,
				amount: val,
				good: val > 0,
				percent: false
			});
		}
	}
	// combos
	for(let [color, count] of colorCounts) {
		let effect = getComboEffect(color, count);
		if(effect) fxArray.push(effect);
	}
	return fxArray;
}

function nidoranCheck(line: string) {
	if(!line.includes("nidoran")) return null;
	// rudimentary gender checking
	if(line.includes('f') || line.includes('♀')) {
		return "Nidoran♀";
	}
	return "Nidoran♂";
}

function parseEmblem(line: string): Emblem {
	line = line.trim().toLowerCase();
	if(!line.length) return null;

	let parts = line.split(/[ \t]+/);

	let tier = defaultTier;
	// can't stick in the unicode code points \u14947-9
	// it doesn't match pasted emoji that way
	if(parts.includes("bronze") || parts.includes('🥉')) tier = 0;
	else if(parts.includes("silver") || parts.includes('🥈')) tier = 1;
	else if(parts.includes("gold") || parts.includes('🥇')) tier = 2;

	let name = nidoranCheck(line);
	if(!name) {
		for(let possibleName of pkmnByName.keys()) {
			let lowerName = possibleName.toLowerCase();
			if(parts.includes(lowerName)) {
				name = possibleName;
				break;
			}
		}
	}

	let count = 1;
	for(let part of parts) {
		let parseAttempt = NaN;
		if(part.startsWith('x')) {
			parseAttempt = parseInt(part.substring(1));
		} else if(part.endsWith('x')) {
			parseAttempt = parseInt(part.substring(0, part.length - 1));
		} else {
			parseAttempt = parseInt(part);
		}

		// already covers NaN
		if(parseAttempt > 0) {
			count = parseAttempt;
			break;
		}
	}

	let emblem = null;
	if(name) {
		emblem = {
			pokemonName: name,
			grade: tier,
			count: count
		};
	}
	return emblem;
}

function emblemsFromText(lines: string[], limit?: number): Emblem[] {
	limit ??= 7500; // 3 tiers * 250 pokemon * 10 slots
	let emblems: Emblem[] = [];
	let count = 0;
	for(let line of lines) {
		let emblem = parseEmblem(line);
		if(!emblem) continue;

		let toAdd = emblem.count;
		if(toAdd + count > limit) {
			toAdd = limit - count;
		}
		let updated = false;
		for(let existing of emblems) {
			if(existing.pokemonName == emblem.pokemonName
				&& existing.grade == emblem.grade)
			{
				updated = true;
				if(toAdd + existing.count > maxEmblems) {
					toAdd = maxEmblems - existing.count;
					existing.count = maxEmblems;
				} else {
					existing.count += toAdd;
				}
				break;
			}
		}
		if(!updated) {
			// only allow 10 emblems max regardless
			// its not useful to have more in any context
			if(toAdd > maxEmblems) {
				toAdd = maxEmblems;
			}
			emblem.count = toAdd;
			emblems.push(emblem);
		}
		count += toAdd;
		if(count >= limit) break;
	}
	return emblems;
}

function addTextareaEvents(
	input: HTMLTextAreaElement,
	func: (HTMLTextAreaElement) => void): void
{
	input.addEventListener("keydown", () => func(input));
	input.addEventListener("keyup", () => func(input));
	input.addEventListener("paste", () => func(input));
	func(input);
}

function getOwnedEmblem(firstCell: HTMLTableCellElement): Emblem {
	let name = firstCell.innerText;
	let tier = tierNames.indexOf(firstCell.className);
	for(let emblem of userEmblems) {
		if(emblem.pokemonName === name && emblem.grade == tier) return emblem;
	}
	return null;
}

function loadOwned(input: HTMLTextAreaElement): void {
	if(window.localStorage) {
		window.localStorage.setItem("ueb_owned", input.value);
	}
	let lines = input.value.split('\n');
	userEmblems = emblemsFromText(lines);

	let rows = document.querySelector<HTMLTableElement>(
		"[data-tab='info'] table").tBodies[0].rows;

	// last column needs to be semi-dynamic for newly added stats
	const idx = rows[0].cells.length - 1;
	for(let row of rows) {
		let count = getOwnedEmblem(row.cells[0])?.count ?? 0;
		row.cells[idx].innerText = count ? count.toString() : "";
	}

	let flags = filterFlags & ownershipFlags;
	if(flags && flags != ownershipFlags) {
		filterTable();
	}
}

function createFromTextarea(input: HTMLTextAreaElement): void {
	const tab = input.parentElement;
	let output = tab.querySelector(".output");
	// remove old results
	while(output.firstElementChild) {
		output.firstElementChild.remove()
	}

	let lines = input.value.split('\n');
	activeEmblems = emblemsFromText(lines, maxEmblems);

	shareCode = createShareCode();
	tab.querySelector("input").value = shareCode.length == 0 ? "" :
		"https://elementalhaven.github.io/UniteEmblemBuilder/?" + shareCode;

	const effects = calculateResults();

	// add new results
	for(let effect of effects) {
		let tag = document.createElement("div");
		tag.className = effect.good ? "good" : "bad";
		let sign = effect.amount > 0 ? '+' : "";
		let percent = effect.percent ? '%' : "";
		// not worth combining the logic between this and the table
		// decimals are better forced for the table for alignment
		// but here it looks worse because it's not being compared
		tag.innerText = `${sign}${effect.amount}${percent} ${effect.stat}`;
		output.append(tag);
	}
}

//#region share codes

// legacy share codes used a constant 7 bits for pokemon ids since there was
// only 99 emblems at the time and packed the remaining bits with 14 pokemon
// expected to be popular to cut out the tier bit for those 14.
// new codes use 7-10 bits per pokemon id dependent on a 2 bit variable
// giving 1023 possible values, hopefully enough to handle 9 gens if needed.
// emblem tiers are handled the same way for both
function convertLegactyShareCode(code: string): string {
	let values: number[] = [];
	let bits = MIN_MON_BITS;
	let convert = new B64Convert(code);
	for(let i = 0; i < 10; i++) {
		// compact tier into 1 bit of storage if bronze or special
		let tier = convert.readBits(1);
		if(tier) tier += (convert.readBits(1));

		let monId = convert.readBits(7);
		if(!monId) break;

		if(monId > 99) {
			monId -= 100;
			tier = (monId & 1) + 1;
			monId = likelyPopularIds[monId >> 1];
		}

		while(monId > (1 << bits) - 1) bits++;

		values.push(0x1000 | (tier << 10) | monId);
	}

	return createShareCodeImpl(values, bits);
}

function getPokemonId(name: string): number {
	let pkmn = pkmnByName.get(name);
	if(pkmn.id) return pkmn.id;
	return pkmnList.indexOf(pkmn) + 1;
}

function createShareCode(): string {
	let values: number[] = [];
	let bits = MIN_MON_BITS;
	for(let emblem of activeEmblems) {
		const monId = getPokemonId(emblem.pokemonName);
		while(monId > (1 << bits) - 1) bits++;
		values.push(monId | (emblem.grade << 10) | (emblem.count << 12));
	}

	return createShareCodeImpl(values, bits);
}

function createShareCodeImpl(values: number[], bits: number): string {
	let convert = new B64Convert();
	convert.writeBits(bits - MIN_MON_BITS, 2);
	for(let value of values) {
		// not bronze
		let b1 = value & 0xC00 ? 1 : 0;

		for(let i = value >> 12; i > 0; i--) {
			// tier bits
			convert.writeBits(b1, 1);
			if(b1) convert.writeBits((value >> 11) & 1, 1);

			convert.writeBits(value & 1023, bits);
		}
	}
	return convert.endWrite();
}

function parseShareCode(code: string): string {
	let rows = "";
	let convert = new B64Convert(code);
	const bitsPerMon = MIN_MON_BITS + convert.readBits(2);
	for(let i = 0; i < 10; i++) {
		// compact tier into 1 bit of storage if bronze
		let tier = convert.readBits(1);
		if(tier) tier += (convert.readBits(1));
		// how long do you think it'll be before
		// they add another tier and break all this?

		let monId = convert.readBits(bitsPerMon);
		if(!monId) break;

		let name = pkmnById.get(monId).name;
		if(rows) rows += '\n';
		rows += tierNames[tier] + ' ' + name;
	}
	return rows;
}

//#endregion

function setActiveTab(tab: string, updateHash: boolean): void {
	document.querySelector(".tab-list > .active")?.classList?.remove("active");
	document.querySelector(".tab-content > .active")?.classList?.remove("active");
	let sel = document.querySelectorAll(`[data-tab="${tab}"]`);
	if(!sel.length) {
		shareCode = convertLegactyShareCode(tab);
		sel = document.querySelectorAll('[data-tab="free"]');
	}
	sel.forEach(t => t.classList.add("active"));
	if(updateHash) document.location.hash = tab;
}

function getStatValue(stat: string, emblem: Pokemon, grade: number): number {
	if(emblem.negStat === stat) return -grade;
	if(emblem.posStat === stat) return grade;
	return 0;
}

function formatStat(stat: string, val: number) {
	let dec = (stat.includes("Attack") || stat.includes("Critical") || stat.includes("Cooldown")) ? 1 : 0;
	return (val > 0 ? '+' : "") + val.toFixed(dec);
}

function filterOut(row: HTMLTableRowElement): boolean {
	// instantly filter out if not showing either ownership state
	if((filterFlags & ownershipFlags) == 0) return true;

	// bronze, silver, gold check
	let tier = tierNames.indexOf(row.cells[0].className);
	if(!(filterFlags & (1 << tier))) return true;

	// ownership check
	if((filterFlags & ownershipFlags) != ownershipFlags) {
		// only need to check if user doesn't want to view both
		let owned = (row.cells[10].innerText || "0") !== "0";
		if(owned && !(filterFlags & 0b01000)) return true;
		if(!owned && !(filterFlags & 0b10000)) return true;
	}

	let pokemon = pkmnByName.get(row.cells[0].innerText);

	for(let filter of filters) {
		if(!filter.value) continue;
		if(filter.isColor) {
			let present = pokemon.colors.includes(filter.value);
			// treat + as present and - as absent
			if(present != ((filter.compare % 2) == 0)) return true;
		} else {
			let present = false;
			let pos = false;
			if(pokemon.posStat === filter.value) {
				present = true;
				pos = true;
			} else if(pokemon.negStat === filter.value) {
				present = true;
			}
			// we want it to be present for all cases other than absent case
			if(present == (filter.compare == 1)) return true;
			if(filter.compare == 2 && !pos) return true;
			if(filter.compare == 3 && pos) return true;
		}

	}

	return false;
}

function filterTable(): void {
	let tbl = document.querySelector<HTMLTableElement>("[data-tab='info'] table");
	for(let row of tbl.tBodies[0].rows) {
		row.classList.toggle("filtered", filterOut(row));
	}
}

// created for the whole minute the stat list was generated dynamically
// that code was removed to control the order of the stat list
function addUnique<T>(obj: T, array: T[]) {
	if(obj != null && !array.includes(obj)) array.push(obj);
}

function createTag(tagName: string, text: string, parent?: Element): Element {
	let tag = document.createElement(tagName);
	tag.innerText = text;
	parent?.append(tag);
	return tag;
}

function createColorCell(
	row: HTMLTableRowElement,
	idx: number,
	colors: string[]
): HTMLTableCellElement {
	let cell = row.insertCell();
	if(colors.length > idx) {
		cell.innerText = colors[idx];
		cell.classList.add(colors[idx]);
	}
	return cell;
}

function setupInfoTable(): void {
	let tab = document.querySelector(".tab-content [data-tab='info']");
	let tbl = tab.querySelector<HTMLTableElement>("table");

	let boxes = tab.querySelectorAll<HTMLInputElement>("input[type='checkbox']");
	// bit order matches checkbox order
	for(let i = 0; i < boxes.length; i++) {
		let func = () => {
			if(boxes[i].checked) {
				filterFlags |= 1 << i;
			} else {
				filterFlags &= ~(1 << i);
			}
		}
		boxes[i].addEventListener("change", ev => { func(); filterTable(); });
		func();
	}
	setupFilters(tab);

	let groups = tab.querySelectorAll("optgroup[label='Colors']");
	for(let combo of combos) {
		groups.forEach(group => createTag("option", combo.color, group));
	}

	groups = tab.querySelectorAll("optgroup[label='Stats']");

	// set up header
	{
		let row = tbl.tHead.rows[0];
		for(let stat of statNames) {
			// FIXME also need sorting buttons
			createTag("th", stat, row);
			groups.forEach(group => createTag("option", stat, group));
		}
		createTag("th", "Color 1", row);
		createTag("th", "Color 2", row);
		createTag("th", "Owned", row);
	}

	// rows for each pokemon
	for(let pokemon of pkmnList) {
		for(let tier = 0; tier < tierNames.length; tier++) {
			// MDN's documentation of HTMLTableElement.insertRow() is full of shit
			let row = tbl.tBodies[0].insertRow();

			// name & grade
			let cell = row.insertCell();
			cell.innerText = pokemon.name;
			cell.classList.add(tierNames[tier]);

			// stats
			for(let idx in statNames) {
				const stat = statNames[idx];
				cell = row.insertCell();
				let val = getStatValue(stat, pokemon, statRates[idx][tier]);
				if(val) {
					cell.innerText = formatStat(stat, val);
					cell.classList.add("number");
					cell.classList.add(val > 0 ? "good" : "bad");
				}
			}

			// colors
			createColorCell(row, 0, pokemon.colors);
			createColorCell(row, 1, pokemon.colors);

			// owned
			row.insertCell().className = "number";
		}
	}

	filterTable();
}

function changeFilterType(
	filter: Filter,
	selects: NodeListOf<HTMLSelectElement>
): void {
	let item = selects[0].selectedIndex;
	// not just copying selectedValue as idk how
	// chrome's autotranslate might mess with it
	selects[1].disabled = item == 0;
	if(item == 0) {
		filter.value = null;
	} else if(item <= statNames.length) {
		filter.value = statNames[item - 1];
		filter.isColor = false;
	} else {
		filter.value = combos[item - (statNames.length + 1)].color;
		filter.isColor = true;
	}
}

function setupFilters(tab: Element) {
	let htmlFilters = tab.querySelectorAll(".filter-req");
	let idx = 0;
	for(let htmlFilter of htmlFilters) {
		const selects = htmlFilter.querySelectorAll("select");
		if(!selects.length) continue;

		const filter = filters[idx++];
		selects[0].addEventListener("change", () => {
			changeFilterType(filter, selects);
			filterTable();
		});
		changeFilterType(filter, selects);
		selects[1].addEventListener("change", ev => {
			filter.compare = selects[1].selectedIndex;
			filterTable();
		});
		filter.compare = selects[1].selectedIndex;
	}
}

function calcIdenticalStats(): void {
	const count = pkmnList.length;
	// have to start at 0 so first item's list gets initialized
	for(let i = 0; i < count; i++) {
		let pokemon = pkmnList[i];
		pokemon.sameStats = [];
		for(let j = 0; j < i; j++) {
			let other = pkmnList[j];
			if(pokemon.posStat == other.posStat 
				&& pokemon.negStat == other.negStat
			) {
				pokemon.sameStats.push(other.name);
				other.sameStats.push(pokemon.name);
			}
		}
	}
}

function setup(): void {
	// need falsy rather than nullsy
	setActiveTab((window.location.hash || "#free").substring(1), false);
	if(window.location.search) shareCode = window.location.search.substring(1);

	document.querySelectorAll<HTMLElement>(".tab-list > *").forEach(
		t => t.addEventListener("click", ev => setActiveTab(t.dataset.tab, true))
	);

	const freeTab = document.querySelector(".tab-content [data-tab='free']");
	const freeArea = freeTab.querySelector<HTMLTextAreaElement>("textarea");
	const freeInp = freeTab.querySelector("input");
	freeInp.addEventListener("keypress", ev => {
		if(ev.key == "Enter") {
			let txt = freeInp.value;
			let idx = txt.indexOf('?') + 1;
			if(idx < txt.length) {
				shareCode = txt.substring(idx);
				freeArea.value = parseShareCode(shareCode);
				createFromTextarea(freeArea);
			}

		}
	});
	freeTab.querySelector("button").addEventListener("click", ev => {
		navigator.clipboard.writeText(freeInp.value);
	});

	fetch("emblems.json").then(r => r.json()).then(json => {
		pkmnList = json;
		for(let i = 0; i < pkmnList.length; i++) {
			let pkmn = pkmnList[i];
			pkmnById.set(pkmn.id ?? i + 1, pkmn);
			pkmnByName.set(pkmn.name, pkmn);
		}

		calcIdenticalStats();
		setupInfoTable();

		if(shareCode) {
			freeArea.value = parseShareCode(shareCode);
		}
		addTextareaEvents(freeArea, createFromTextarea);
		const myArea = document.querySelector<HTMLTextAreaElement>(
			"[data-tab='mine'] textarea");
		if(!myArea.value && window.localStorage) {
			let txt = window.localStorage.getItem("ueb_owned");
			if(txt) {
				myArea.value = txt;
			}
		}
		addTextareaEvents(myArea, loadOwned);
	});
}