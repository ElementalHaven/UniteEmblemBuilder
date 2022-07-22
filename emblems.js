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
const maxEmblems = 10;
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
function applyFlatEffect(effect, effects) {
    var _a;
    let val = (_a = effects.get(effect.stat)) !== null && _a !== void 0 ? _a : 0;
    effects.set(effect.stat, val + effect.amount);
}
function calculateResults() {
    var _a;
    let colorCounts = new Map();
    let effects = new Map();
    for (let i = 0; i < activeEmblems.length; i++) {
        let emblem = activeEmblems[i];
        let pokemon = pkmnByName.get(emblem.pokemonName);
        let grade = pokemon.grades[emblem.grade];
        applyFlatEffect(grade.posEffect, effects);
        applyFlatEffect(grade.negEffect, effects);
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
function emblemsFromText(lines) {
    let emblems = [];
    for (let line of lines) {
        line = line.trim().toLowerCase();
        if (!line.length)
            continue;
        let parts = line.split(/[ \t]+/);
        let tier = 0;
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
        if (name) {
            emblems.push({
                pokemonName: name,
                grade: tier
            });
            if (emblems.length >= 10)
                break;
        }
    }
    return emblems;
}
function createFromTextfield(input) {
    let output = document.getElementById("test-output");
    // remove old results
    while (output.firstElementChild) {
        output.firstElementChild.remove();
    }
    let lines = input.value.split('\n');
    activeEmblems = emblemsFromText(lines);
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
function setup() {
    let input = document.getElementById("test-input");
    input.addEventListener("keydown", () => createFromTextfield(input));
    input.addEventListener("keyup", () => createFromTextfield(input));
    input.addEventListener("paste", () => createFromTextfield(input));
    fetch("emblems.json").then(r => r.json()).then(json => {
        pkmnList = json;
        for (let pkmn of pkmnList) {
            pkmnByName.set(pkmn.name, pkmn);
        }
        createFromTextfield(input);
    });
}
//# sourceMappingURL=emblems.js.map