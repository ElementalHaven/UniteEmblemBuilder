//#region classes
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
//#endregion
//#region global variables
var pkmnList;
const pkmnByName = new Map();
const combos = [
    {
        color: "Green",
        startCount: 2,
        stat: "Sp. Attack",
        amount: 1
    },
    /*{
        color: "Yellow",
        startCount: 3,
        stat: "",
        amount:
    },*/
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
//#endregion
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
        return effect;
    }
}
function applyFlatEffect(effect, effects, multiplier = 1) {
    var _a;
    let val = (_a = effects.get(effect.stat)) !== null && _a !== void 0 ? _a : 0;
    effects.set(effect.stat, val + effect.amount * multiplier);
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
    // only add non-zero values
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
    // combos
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
    // rudimentary gender checking
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
    // TODO add emoji support
    if (parts.includes("bronze"))
        tier = 0;
    else if (parts.includes("silver"))
        tier = 1;
    else if (parts.includes("gold"))
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
        // already covers NaN
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
    limit !== null && limit !== void 0 ? limit : (limit = 2970); // 3 tiers * 99 pokemon * 10 slots
    let emblems = [];
    let count = 0;
    for (let line of lines) {
        let emblem = parseEmblem(line);
        if (!emblem)
            continue;
        if (emblem.count + count > limit) {
            emblem.count = limit - count;
        }
        emblems.push(emblem);
        count += emblem.count;
        if (count >= limit)
            break;
    }
    return emblems;
}
function createFromTextfield(input) {
    let output = document.querySelector("[data-tab='free'] .output");
    // remove old results
    while (output.firstElementChild) {
        output.firstElementChild.remove();
    }
    let lines = input.value.split('\n');
    activeEmblems = emblemsFromText(lines, 10);
    const effects = calculateResults();
    // add new results
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
// created for the whole minute the stat list was generated dynamically
// that code was removed to control the order of the stat list
function addUnique(obj, array) {
    if (obj != null && !array.includes(obj))
        array.push(obj);
}
function createTH(text) {
    let cell = document.createElement("th");
    cell.innerText = text;
    return cell;
}
function setupInfoTable() {
    let tbl = document.querySelector("[data-tab='info'] table");
    // set up header
    for (let stat of statNames) {
        // FIXME also need sorting buttons
        tbl.tHead.rows[0].append(createTH(stat));
    }
    tbl.tHead.rows[0].append(createTH("Color 1"));
    tbl.tHead.rows[0].append(createTH("Color 2"));
    tbl.tHead.rows[0].append(createTH("Owned"));
    // rows for each pokemon
    for (let pokemon of pkmnList) {
        for (let tier in pokemon.grades) {
            let grade = pokemon.grades[tier];
            let row = tbl.tBodies[0].insertRow();
            // name & grade
            let cell = row.insertCell();
            cell.innerText = pokemon.name;
            cell.classList.add(tierNames[tier]);
            // stats
            for (let stat of statNames) {
                cell = row.insertCell();
                let val = getStatValue(stat, grade);
                if (val) {
                    let dec = 0;
                    if (stat.includes("Attack") || stat.includes("Critical")) {
                        dec = 1;
                    }
                    cell.innerText = val.toFixed(dec);
                    cell.classList.add("stat");
                    cell.classList.add(val > 0 ? "good" : "bad");
                }
            }
            // colors
            row.insertCell().innerText = pokemon.colors[0];
            cell = row.insertCell();
            if (pokemon.colors.length > 1)
                cell.innerText = pokemon.colors[1];
            // owned
            row.insertCell();
        }
    }
}
function setup() {
    // need falsy rather than nullsy
    setActiveTab((document.location.hash || "#free").substring(1), false);
    let input = document.querySelector("[data-tab='free'] textarea");
    input.addEventListener("keydown", () => createFromTextfield(input));
    input.addEventListener("keyup", () => createFromTextfield(input));
    input.addEventListener("paste", () => createFromTextfield(input));
    document.querySelectorAll(".tab-list > *").forEach(t => t.addEventListener("click", ev => setActiveTab(t.dataset.tab, true)));
    fetch("emblems.json").then(r => r.json()).then(json => {
        pkmnList = json;
        for (let pkmn of pkmnList) {
            pkmnByName.set(pkmn.name, pkmn);
        }
        setupInfoTable();
        createFromTextfield(input);
    });
}
//# sourceMappingURL=emblems.js.map