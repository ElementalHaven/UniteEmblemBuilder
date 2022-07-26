class Pokemon {
    constructor() {
        this.grades = [];
        this.colors = [];
    }
}
class Effect {
}
class ResultingEffect extends Effect {
}
class ComboEffect extends Effect {
}
class Grade {
}
class Emblem {
}
class Filter {
}
var pkmnList;
const pkmnByName = new Map();
const combos = [
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
];
var activeEmblems;
var userEmblems;
var defaultTier = 0;
const tierNames = ["Bronze", "Silver", "Gold"];
const maxEmblems = 10;
const statNames = [
    "HP", "Attack", "Defense", "Sp. Attack", "Sp. Defense",
    "Speed", "Critical-Hit Rate"
];
const ownershipFlags = 0b11000;
var filterFlags = 0b11111;
var filters = [new Filter(), new Filter()];
function getComboEffect(color, count) {
    for (const combo of combos) {
        if (combo.color !== color)
            continue;
        let minCount = combo.startCount;
        if (count < minCount)
            return null;
        let effect = {
            stat: combo.stat,
            amount: combo.amount,
            good: true,
            percent: true
        };
        if (count >= minCount + 2)
            effect.amount *= 2;
        if (count >= minCount + 4)
            effect.amount *= 2;
        if (color === "yellow" && count < 5)
            effect.amount = 4;
        return effect;
    }
}
function applyFlatEffect(effect, effects, multiplier = 1) {
    var _a;
    let val = (_a = effects.get(effect.stat)) !== null && _a !== void 0 ? _a : 0;
    val = ((val * 10 + effect.amount * 10) * multiplier) / 10;
    effects.set(effect.stat, val);
}
function calculateResults() {
    var _a;
    let colorCounts = new Map();
    let effects = new Map();
    for (let i = 0; i < activeEmblems.length; i++) {
        let emblem = activeEmblems[i];
        let pokemon = pkmnByName.get(emblem.pokemonName);
        let grade = pokemon.grades[emblem.grade];
        applyFlatEffect(grade.posEffect, effects, emblem.count);
        applyFlatEffect(grade.negEffect, effects, emblem.count);
        let applyColors = true;
        for (let j = 0; j < i; j++) {
            if (activeEmblems[j].pokemonName == emblem.pokemonName) {
                applyColors = false;
                break;
            }
        }
        if (applyColors) {
            for (let color of pokemon.colors) {
                let count = (_a = colorCounts.get(color)) !== null && _a !== void 0 ? _a : 0;
                colorCounts.set(color, ++count);
            }
        }
    }
    let fxArray = [];
    for (let [stat, val] of effects) {
        if (val < -0.01 || val > 0.01) {
            fxArray.push({
                stat: stat,
                amount: val,
                good: val > 0,
                percent: false
            });
        }
    }
    for (let [color, count] of colorCounts) {
        let effect = getComboEffect(color, count);
        if (effect)
            fxArray.push(effect);
    }
    return fxArray;
}
function nidoranCheck(line) {
    if (!line.includes("nidoran"))
        return null;
    if (line.includes('f') || line.includes('♀')) {
        return "Nidoran♀";
    }
    return "Nidoran♂";
}
function parseEmblem(line) {
    line = line.trim().toLowerCase();
    if (!line.length)
        return null;
    let parts = line.split(/[ \t]+/);
    let tier = defaultTier;
    if (parts.includes("bronze") || parts.includes('🥉'))
        tier = 0;
    else if (parts.includes("silver") || parts.includes('🥈'))
        tier = 1;
    else if (parts.includes("gold") || parts.includes('🥇'))
        tier = 2;
    let name = nidoranCheck(line);
    if (!name) {
        for (let possibleName of pkmnByName.keys()) {
            let lowerName = possibleName.toLowerCase();
            if (parts.includes(lowerName)) {
                name = possibleName;
                break;
            }
        }
    }
    let count = 1;
    for (let part of parts) {
        let parseAttempt = NaN;
        if (part.startsWith('x')) {
            parseAttempt = parseInt(part.substring(1));
        }
        else if (part.endsWith('x')) {
            parseAttempt = parseInt(part.substring(0, part.length - 1));
        }
        else {
            parseAttempt = parseInt(part);
        }
        if (parseAttempt > 0) {
            count = parseAttempt;
            break;
        }
    }
    let emblem = null;
    if (name) {
        emblem = {
            pokemonName: name,
            grade: tier,
            count: count
        };
    }
    return emblem;
}
function emblemsFromText(lines, limit) {
    limit !== null && limit !== void 0 ? limit : (limit = 2970);
    let emblems = [];
    let count = 0;
    for (let line of lines) {
        let emblem = parseEmblem(line);
        if (!emblem)
            continue;
        let toAdd = emblem.count;
        if (toAdd + count > limit) {
            toAdd = limit - count;
        }
        let updated = false;
        for (let existing of emblems) {
            if (existing.pokemonName == emblem.pokemonName
                && existing.grade == emblem.grade) {
                updated = true;
                if (toAdd + existing.count > maxEmblems) {
                    toAdd = maxEmblems - existing.count;
                    existing.count = maxEmblems;
                }
                else {
                    existing.count += toAdd;
                }
                break;
            }
        }
        if (!updated) {
            if (toAdd > maxEmblems) {
                toAdd = maxEmblems;
            }
            emblem.count = toAdd;
            emblems.push(emblem);
        }
        count += toAdd;
        if (count >= limit)
            break;
    }
    return emblems;
}
function addTextareaEvents(input, func) {
    input.addEventListener("keydown", () => func(input));
    input.addEventListener("keyup", () => func(input));
    input.addEventListener("paste", () => func(input));
    func(input);
}
function getOwnedEmblem(firstCell) {
    let name = firstCell.innerText;
    let tier = tierNames.indexOf(firstCell.className);
    for (let emblem of userEmblems) {
        if (emblem.pokemonName === name && emblem.grade == tier)
            return emblem;
    }
    return null;
}
function loadOwned(input) {
    var _a, _b;
    let lines = input.value.split('\n');
    userEmblems = emblemsFromText(lines);
    let rows = document.querySelector("[data-tab='info'] table").tBodies[0].rows;
    for (let row of rows) {
        let count = (_b = (_a = getOwnedEmblem(row.cells[0])) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0;
        row.cells[10].innerText = count ? count.toString() : "";
    }
    let flags = filterFlags & ownershipFlags;
    if (flags && flags != ownershipFlags) {
        filterTable();
    }
}
function createFromTextarea(input) {
    let output = document.querySelector("[data-tab='free'] .output");
    while (output.firstElementChild) {
        output.firstElementChild.remove();
    }
    let lines = input.value.split('\n');
    activeEmblems = emblemsFromText(lines, maxEmblems);
    const effects = calculateResults();
    for (let effect of effects) {
        let tag = document.createElement("div");
        tag.className = effect.good ? "good" : "bad";
        let sign = effect.amount > 0 ? '+' : "";
        let percent = effect.percent ? '%' : "";
        tag.innerText = `${sign}${effect.amount}${percent} ${effect.stat}`;
        output.append(tag);
    }
}
function setActiveTab(tab, updateHash) {
    var _a, _b, _c, _d;
    (_b = (_a = document.querySelector(".tab-list > .active")) === null || _a === void 0 ? void 0 : _a.classList) === null || _b === void 0 ? void 0 : _b.remove("active");
    (_d = (_c = document.querySelector(".tab-content > .active")) === null || _c === void 0 ? void 0 : _c.classList) === null || _d === void 0 ? void 0 : _d.remove("active");
    document.querySelectorAll(`[data-tab="${tab}"]`).forEach(t => t.classList.add("active"));
    if (updateHash)
        document.location.hash = tab;
}
function getStatValue(stat, grade) {
    var _a, _b;
    if (((_a = grade.negEffect) === null || _a === void 0 ? void 0 : _a.stat) === stat)
        return grade.negEffect.amount;
    if (((_b = grade.posEffect) === null || _b === void 0 ? void 0 : _b.stat) === stat)
        return grade.posEffect.amount;
    return 0;
}
function formatStat(stat, val) {
    let dec = (stat.includes("Attack") || stat.includes("Critical")) ? 1 : 0;
    return (val > 0 ? '+' : "") + val.toFixed(dec);
}
function filterOut(row) {
    if ((filterFlags & ownershipFlags) == 0)
        return true;
    let tier = tierNames.indexOf(row.cells[0].className);
    if (!(filterFlags & (1 << tier)))
        return true;
    if ((filterFlags & ownershipFlags) != ownershipFlags) {
        let owned = (row.cells[10].innerText || "0") !== "0";
        if (owned && !(filterFlags & 0b01000))
            return true;
        if (!owned && !(filterFlags & 0b10000))
            return true;
    }
    let pokemon = pkmnByName.get(row.cells[0].innerText);
    for (let filter of filters) {
        if (!filter.value)
            continue;
        if (filter.isColor) {
            let present = pokemon.colors.includes(filter.value);
            if (present != ((filter.compare % 2) == 0))
                return true;
        }
        else {
            let present = false;
            let pos = false;
            if (pokemon.grades[0].posEffect.stat === filter.value) {
                present = true;
                pos = true;
            }
            else if (pokemon.grades[0].negEffect.stat === filter.value) {
                present = true;
            }
            if (present == (filter.compare == 1))
                return true;
            if (filter.compare == 2 && !pos)
                return true;
            if (filter.compare == 3 && pos)
                return true;
        }
    }
    return false;
}
function filterTable() {
    let tbl = document.querySelector("[data-tab='info'] table");
    for (let row of tbl.tBodies[0].rows) {
        row.classList.toggle("filtered", filterOut(row));
    }
}
function addUnique(obj, array) {
    if (obj != null && !array.includes(obj))
        array.push(obj);
}
function createTag(tagName, text, parent) {
    let tag = document.createElement(tagName);
    tag.innerText = text;
    parent === null || parent === void 0 ? void 0 : parent.append(tag);
    return tag;
}
function createColorCell(row, idx, colors) {
    let cell = row.insertCell();
    if (colors.length > idx) {
        cell.innerText = colors[idx];
        cell.classList.add(colors[idx]);
    }
    return cell;
}
function setupInfoTable() {
    let tab = document.querySelector(".tab-content [data-tab='info']");
    let tbl = tab.querySelector("table");
    let boxes = tab.querySelectorAll("input[type='checkbox']");
    for (let i = 0; i < boxes.length; i++) {
        let func = () => {
            if (boxes[i].checked) {
                filterFlags |= 1 << i;
            }
            else {
                filterFlags &= ~(1 << i);
            }
        };
        boxes[i].addEventListener("change", ev => { func(); filterTable(); });
        func();
    }
    setupFilters(tab);
    let groups = tab.querySelectorAll("optgroup[label='Colors']");
    for (let combo of combos) {
        groups.forEach(group => createTag("option", combo.color, group));
    }
    groups = tab.querySelectorAll("optgroup[label='Stats']");
    {
        let row = tbl.tHead.rows[0];
        for (let stat of statNames) {
            createTag("th", stat, row);
            groups.forEach(group => createTag("option", stat, group));
        }
        createTag("th", "Color 1", row);
        createTag("th", "Color 2", row);
        createTag("th", "Owned", row);
    }
    for (let pokemon of pkmnList) {
        for (let tier in pokemon.grades) {
            let grade = pokemon.grades[tier];
            let row = tbl.tBodies[0].insertRow();
            let cell = row.insertCell();
            cell.innerText = pokemon.name;
            cell.classList.add(tierNames[tier]);
            for (let stat of statNames) {
                cell = row.insertCell();
                let val = getStatValue(stat, grade);
                if (val) {
                    cell.innerText = formatStat(stat, val);
                    cell.classList.add("number");
                    cell.classList.add(val > 0 ? "good" : "bad");
                }
            }
            createColorCell(row, 0, pokemon.colors);
            createColorCell(row, 1, pokemon.colors);
            row.insertCell().className = "number";
        }
    }
    filterTable();
}
function changeFilterType(filter, selects) {
    let item = selects[0].selectedIndex;
    selects[1].disabled = item == 0;
    if (item == 0) {
        filter.value = null;
    }
    else if (item <= statNames.length) {
        filter.value = statNames[item - 1];
        filter.isColor = false;
    }
    else {
        filter.value = combos[item - (statNames.length + 1)].color;
        filter.isColor = true;
    }
}
function setupFilters(tab) {
    let htmlFilters = tab.querySelectorAll(".filter-req");
    let idx = 0;
    for (let htmlFilter of htmlFilters) {
        const selects = htmlFilter.querySelectorAll("select");
        if (!selects.length)
            continue;
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
function effectMatches(a, b) {
    return a.amount == b.amount && a.stat === b.stat;
}
function calcIdenticalStats() {
    const count = pkmnList.length;
    for (let i = 0; i < count; i++) {
        let pokemon = pkmnList[i];
        pokemon.sameStats = [];
        let a = pokemon.grades[0];
        for (let j = 0; j < i; j++) {
            let other = pkmnList[j];
            let b = other.grades[0];
            if (effectMatches(a.posEffect, b.posEffect)
                && effectMatches(a.negEffect, b.negEffect)) {
                pokemon.sameStats.push(other.name);
                other.sameStats.push(pokemon.name);
            }
        }
    }
}
function setup() {
    setActiveTab((document.location.hash || "#free").substring(1), false);
    document.querySelectorAll(".tab-list > *").forEach(t => t.addEventListener("click", ev => setActiveTab(t.dataset.tab, true)));
    fetch("emblems.json").then(r => r.json()).then(json => {
        pkmnList = json;
        for (let pkmn of pkmnList) {
            pkmnByName.set(pkmn.name, pkmn);
        }
        calcIdenticalStats();
        setupInfoTable();
        addTextareaEvents(document.querySelector("[data-tab='free'] textarea"), createFromTextarea);
        addTextareaEvents(document.querySelector("[data-tab='mine'] textarea"), loadOwned);
    });
}
//# sourceMappingURL=emblems.js.map