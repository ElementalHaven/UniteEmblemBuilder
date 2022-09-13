class Pokemon {
    constructor() {
        this.colors = [];
    }
}
class Effect {
}
class ResultingEffect extends Effect {
}
class ComboEffect extends Effect {
}
class Emblem {
}
class Filter {
}
const MIN_MON_BITS = 7;
const BITS_PER_CHAR = 6;
const BIT_CHAR_MASK = (1 << BITS_PER_CHAR) - 1;
class B64Convert {
    constructor(value) {
        this.bitCount = 0;
        this.bitValue = 0;
        this.strValue = value || "";
    }
    static parseChar(char) {
        let cp = char.charCodeAt(0);
        if (cp == 43)
            return 63;
        if (cp == 45)
            return 62;
        if (cp > 64 && cp < 91)
            return cp - 39;
        if (cp > 96 && cp < 123)
            return cp - 97;
        if (cp > 47 && cp < 58)
            return cp + 4;
        return 0;
    }
    static toChar(val) {
        let cp = 97;
        if (val < 26)
            cp = val + 97;
        else if (val < 52)
            cp = 39 + val;
        else if (val < 62)
            cp = val - 4;
        else if (val == 62)
            cp = 45;
        else if (val == 63)
            cp = 43;
        return String.fromCharCode(cp);
    }
    readBits(count) {
        while (this.bitCount < count) {
            if (this.strValue.length) {
                let newBits = B64Convert.parseChar(this.strValue[0]);
                this.strValue = this.strValue.substring(1);
                this.bitValue |= newBits << this.bitCount;
                this.bitCount += BITS_PER_CHAR;
            }
            else {
                this.bitCount = count;
            }
        }
        const mask = (1 << count) - 1;
        let out = this.bitValue & mask;
        this.bitValue >>>= count;
        this.bitCount -= count;
        return out;
    }
    encodeBits(pad = false) {
        while (true) {
            let hasEnough = this.bitCount >= BITS_PER_CHAR;
            let shouldPad = pad && this.bitValue;
            if (!hasEnough && !shouldPad)
                break;
            if (!hasEnough) {
                this.bitCount = BITS_PER_CHAR;
            }
            this.strValue += B64Convert.toChar(this.bitValue & BIT_CHAR_MASK);
            this.bitValue >>>= BITS_PER_CHAR;
            this.bitCount -= BITS_PER_CHAR;
        }
    }
    writeBits(value, count) {
        this.bitValue |= value << this.bitCount;
        this.bitCount += count;
        if (value)
            this.encodeBits();
    }
    endWrite() {
        if (this.bitValue) {
            this.encodeBits(true);
        }
        return this.strValue;
    }
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
    }
];
var activeEmblems;
var userEmblems;
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
    [0.3, 0.4, 0.5]
];
const ownershipFlags = 0b11000;
var filterFlags = 0b11111;
var filters = [new Filter(), new Filter()];
var shareCode = null;
const likelyPopularIds = [
    59, 22, 68, 65, 3, 19, 16, 71, 94, 15, 78, 45, 49
];
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
function applyFlatEffect(statName, grade, effects, multiplier = 1) {
    var _a;
    let val = (_a = effects.get(statName)) !== null && _a !== void 0 ? _a : 0;
    let change = statRates[statNames.indexOf(statName)][grade] * multiplier;
    val = (val * 10 + change * 10) / 10;
    effects.set(statName, val);
}
function calculateResults() {
    var _a;
    let colorCounts = new Map();
    let effects = new Map();
    for (let i = 0; i < activeEmblems.length; i++) {
        let emblem = activeEmblems[i];
        let pokemon = pkmnByName.get(emblem.pokemonName);
        applyFlatEffect(pokemon.posStat, emblem.grade, effects, emblem.count);
        applyFlatEffect(pokemon.negStat, emblem.grade, effects, -emblem.count);
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
    limit !== null && limit !== void 0 ? limit : (limit = 7500);
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
    if (window.localStorage) {
        window.localStorage.setItem("ueb_owned", input.value);
    }
    let lines = input.value.split('\n');
    userEmblems = emblemsFromText(lines);
    let rows = document.querySelector("[data-tab='info'] table").tBodies[0].rows;
    const idx = rows[0].cells.length - 1;
    for (let row of rows) {
        let count = (_b = (_a = getOwnedEmblem(row.cells[0])) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0;
        row.cells[idx].innerText = count ? count.toString() : "";
    }
    let flags = filterFlags & ownershipFlags;
    if (flags && flags != ownershipFlags) {
        filterTable();
    }
}
function createFromTextarea(input) {
    const tab = input.parentElement;
    let output = tab.querySelector(".output");
    while (output.firstElementChild) {
        output.firstElementChild.remove();
    }
    let lines = input.value.split('\n');
    activeEmblems = emblemsFromText(lines, maxEmblems);
    shareCode = createShareCode();
    tab.querySelector("input").value = shareCode.length == 0 ? "" :
        "https://elementalhaven.github.io/UniteEmblemBuilder/?" + shareCode;
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
function convertLegactyShareCode(code) {
    let values = [];
    let bits = MIN_MON_BITS;
    let convert = new B64Convert(code);
    for (let i = 0; i < 10; i++) {
        let tier = convert.readBits(1);
        if (tier)
            tier += (convert.readBits(1));
        let monId = convert.readBits(7);
        if (!monId)
            break;
        if (monId > 99) {
            monId -= 100;
            tier = (monId & 1) + 1;
            monId = likelyPopularIds[monId >> 1];
        }
        while (monId > (1 << bits) - 1)
            bits++;
        values.push(0x1000 | (tier << 10) | monId);
    }
    return createShareCodeImpl(values, bits);
}
function createShareCode() {
    let values = [];
    let bits = MIN_MON_BITS;
    for (let emblem of activeEmblems) {
        const monId = pkmnList.indexOf(pkmnByName.get(emblem.pokemonName)) + 1;
        while (monId > (1 << bits) - 1)
            bits++;
        values.push(monId | (emblem.grade << 10) | (emblem.count << 12));
    }
    return createShareCodeImpl(values, bits);
}
function createShareCodeImpl(values, bits) {
    let convert = new B64Convert();
    convert.writeBits(bits - MIN_MON_BITS, 2);
    for (let value of values) {
        let b1 = value & 0xC00 ? 1 : 0;
        for (let i = value >> 12; i > 0; i--) {
            convert.writeBits(b1, 1);
            if (b1)
                convert.writeBits((value >> 11) & 1, 1);
            convert.writeBits(value & 1023, bits);
        }
    }
    return convert.endWrite();
}
function parseShareCode(code) {
    let rows = "";
    let convert = new B64Convert(code);
    const bitsPerMon = MIN_MON_BITS + convert.readBits(2);
    for (let i = 0; i < 10; i++) {
        let tier = convert.readBits(1);
        if (tier)
            tier += (convert.readBits(1));
        let monId = convert.readBits(bitsPerMon);
        if (!monId)
            break;
        let name = pkmnList[monId - 1].name;
        if (rows)
            rows += '\n';
        rows += tierNames[tier] + ' ' + name;
    }
    return rows;
}
function setActiveTab(tab, updateHash) {
    var _a, _b, _c, _d;
    (_b = (_a = document.querySelector(".tab-list > .active")) === null || _a === void 0 ? void 0 : _a.classList) === null || _b === void 0 ? void 0 : _b.remove("active");
    (_d = (_c = document.querySelector(".tab-content > .active")) === null || _c === void 0 ? void 0 : _c.classList) === null || _d === void 0 ? void 0 : _d.remove("active");
    let sel = document.querySelectorAll(`[data-tab="${tab}"]`);
    if (!sel.length) {
        shareCode = convertLegactyShareCode(tab);
        sel = document.querySelectorAll('[data-tab="free"]');
    }
    sel.forEach(t => t.classList.add("active"));
    if (updateHash)
        document.location.hash = tab;
}
function getStatValue(stat, emblem, grade) {
    if (emblem.negStat === stat)
        return -grade;
    if (emblem.posStat === stat)
        return grade;
    return 0;
}
function formatStat(stat, val) {
    let dec = (stat.includes("Attack") || stat.includes("Critical") || stat.includes("Cooldown")) ? 1 : 0;
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
            if (pokemon.posStat === filter.value) {
                present = true;
                pos = true;
            }
            else if (pokemon.negStat === filter.value) {
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
        for (let tier = 0; tier < tierNames.length; tier++) {
            let row = tbl.tBodies[0].insertRow();
            let cell = row.insertCell();
            cell.innerText = pokemon.name;
            cell.classList.add(tierNames[tier]);
            for (let idx in statNames) {
                const stat = statNames[idx];
                cell = row.insertCell();
                let val = getStatValue(stat, pokemon, statRates[idx][tier]);
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
function calcIdenticalStats() {
    const count = pkmnList.length;
    for (let i = 0; i < count; i++) {
        let pokemon = pkmnList[i];
        pokemon.sameStats = [];
        for (let j = 0; j < i; j++) {
            let other = pkmnList[j];
            if (pokemon.posStat == other.posStat
                && pokemon.negStat == other.negStat) {
                pokemon.sameStats.push(other.name);
                other.sameStats.push(pokemon.name);
            }
        }
    }
}
function setup() {
    setActiveTab((window.location.hash || "#free").substring(1), false);
    if (window.location.search)
        shareCode = window.location.search.substring(1);
    document.querySelectorAll(".tab-list > *").forEach(t => t.addEventListener("click", ev => setActiveTab(t.dataset.tab, true)));
    const freeTab = document.querySelector(".tab-content [data-tab='free']");
    const freeArea = freeTab.querySelector("textarea");
    const freeInp = freeTab.querySelector("input");
    freeInp.addEventListener("keypress", ev => {
        if (ev.key == "Enter") {
            let txt = freeInp.value;
            let idx = txt.indexOf('?') + 1;
            if (idx < txt.length) {
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
        for (let pkmn of pkmnList) {
            pkmnByName.set(pkmn.name, pkmn);
        }
        calcIdenticalStats();
        setupInfoTable();
        if (shareCode) {
            freeArea.value = parseShareCode(shareCode);
        }
        addTextareaEvents(freeArea, createFromTextarea);
        const myArea = document.querySelector("[data-tab='mine'] textarea");
        if (!myArea.value && window.localStorage) {
            let txt = window.localStorage.getItem("ueb_owned");
            if (txt) {
                myArea.value = txt;
            }
        }
        addTextareaEvents(myArea, loadOwned);
    });
}
//# sourceMappingURL=emblems.js.map