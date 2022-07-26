//#region classes

class Pokemon {
	name: string;
	grades: Grade[] = [];
	colors: string[] = [];
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

class Grade {
	posEffect: Effect;
	negEffect: Effect;
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

//#endregion

//#region global variables

var pkmnList: Pokemon[];
const pkmnByName: Map<string, Pokemon> = new Map();
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
		color: "Orange",
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
	}
]
var activeEmblems: Emblem[];
var userEmblems: Emblem[];
var defaultTier = 0;
const tierNames = ["Bronze", "Silver", "Gold"];
const maxEmblems = 10;
const statNames = [
	"HP", "Attack", "Defense", "Sp. Attack", "Sp. Defense",
	"Speed", "Critical-Hit Rate"
];
const ownershipFlags = 0b11000;
// I knew Java had this syntax, but was unaware of Javascript having it.
// Apparently it was added in ES6
var filterFlags = 0b11111;
var filters = [new Filter(), new Filter()];

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
			percent: true
		}
		if(count >= minCount + 2) effect.amount *= 2;
		if(count >= minCount + 4) effect.amount *= 2;
		if(color === "yellow" && count < 5) effect.amount = 4;
		return effect;
	}
}

function applyFlatEffect(
	effect: Effect,
	effects: Map<string, number>,
	multiplier: number = 1
): void {
	let val = effects.get(effect.stat) ?? 0;
	// increase values so it ends up as integer math temporarily(hopefully)
	val = ((val * 10 + effect.amount * 10) * multiplier) / 10;
	effects.set(effect.stat, val);
}

function calculateResults(): ResultingEffect[] {
	let colorCounts: Map<string, number> = new Map();
	let effects: Map<string, number> = new Map();
	for(let i = 0; i < activeEmblems.length; i++) {
		let emblem = activeEmblems[i];
		let pokemon = pkmnByName.get(emblem.pokemonName);
		let grade = pokemon.grades[emblem.grade];

		applyFlatEffect(grade.posEffect, effects, emblem.count);
		applyFlatEffect(grade.negEffect, effects, emblem.count);

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
	limit ??= 2970; // 3 tiers * 99 pokemon * 10 slots
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
	let lines = input.value.split('\n');
	userEmblems = emblemsFromText(lines);

	let rows = document.querySelector<HTMLTableElement>(
		"[data-tab='info'] table").tBodies[0].rows;

	for(let row of rows) {
		let count = getOwnedEmblem(row.cells[0])?.count ?? 0;
		row.cells[10].innerText = count ? count.toString() : "";
	}

	let flags = filterFlags & ownershipFlags;
	if(flags && flags != ownershipFlags) {
		filterTable();
	}
}

function createFromTextarea(input: HTMLTextAreaElement): void {
	let output = document.querySelector("[data-tab='free'] .output");
	// remove old results
	while(output.firstElementChild) {
		output.firstElementChild.remove()
	}

	let lines = input.value.split('\n');
	activeEmblems = emblemsFromText(lines, maxEmblems);

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

function setActiveTab(tab: string, updateHash: boolean): void {
	document.querySelector(".tab-list > .active")?.classList?.remove("active");
	document.querySelector(".tab-content > .active")?.classList?.remove("active");
	document.querySelectorAll(`[data-tab="${tab}"]`).forEach(
		t => t.classList.add("active")
	);
	if(updateHash) document.location.hash = tab;
}

function getStatValue(stat: string, grade: Grade): number {
	if(grade.negEffect?.stat === stat) return grade.negEffect.amount;
	if(grade.posEffect?.stat === stat) return grade.posEffect.amount;
	return 0;
}

function formatStat(stat: string, val: number) {
	let dec = (stat.includes("Attack") || stat.includes("Critical")) ? 1 : 0;
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
			if(pokemon.grades[0].posEffect.stat === filter.value) {
				present = true;
				pos = true;
			} else if(pokemon.grades[0].negEffect.stat === filter.value) {
				present = true;
			}
			// we want it to be present for all casese other than absent case
			if(present == (filter.compare == 1)) return true;
			if(filter.compare == 2 && !pos) return true;
			if(filter.compare == 3 && pos) return true;
		}

	}
	// FIXME still need to check requirements if they're enabled

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
		for(let tier in pokemon.grades) {
			let grade = pokemon.grades[tier];
			// MDN's documentation of HTMLTableElement.insertRow() is full of shit
			let row = tbl.tBodies[0].insertRow();

			// name & grade
			let cell = row.insertCell();
			cell.innerText = pokemon.name;
			cell.classList.add(tierNames[tier]);

			// stats
			for(let stat of statNames) {
				cell = row.insertCell();
				let val = getStatValue(stat, grade);
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

function effectMatches(a: Effect, b: Effect) {
	return a.amount == b.amount && a.stat === b.stat;
}

function calcIdenticalStats(): void {
	const count = pkmnList.length;
	// have to start at 0 so first item's list gets initialized
	for(let i = 0; i < count; i++) {
		let pokemon = pkmnList[i];
		pokemon.sameStats = [];
		let a = pokemon.grades[0];
		for(let j = 0; j < i; j++) {
			let other = pkmnList[j];
			let b = other.grades[0];
			if(effectMatches(a.posEffect, b.posEffect)
				&& effectMatches(a.negEffect, b.negEffect)
			) {
				pokemon.sameStats.push(other.name);
				other.sameStats.push(pokemon.name);
			}
		}
	}
}

function setup(): void {
	// need falsy rather than nullsy
	setActiveTab((document.location.hash || "#free").substring(1), false);

	document.querySelectorAll<HTMLElement>(".tab-list > *").forEach(
		t => t.addEventListener("click", ev => setActiveTab(t.dataset.tab, true))
	);

	fetch("emblems.json").then(r => r.json()).then(json => {
		pkmnList = json;
		for(let pkmn of pkmnList) {
			pkmnByName.set(pkmn.name, pkmn);
		}

		calcIdenticalStats();
		setupInfoTable();

		addTextareaEvents(document.querySelector<HTMLTextAreaElement>(
			"[data-tab='free'] textarea"), createFromTextarea);
		addTextareaEvents(document.querySelector<HTMLTextAreaElement>(
			"[data-tab='mine'] textarea"), loadOwned);
	});
}