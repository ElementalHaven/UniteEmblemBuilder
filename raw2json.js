function convert(inFilename) {
    return fetch(inFilename).then(r => r.text()).then(txt => raw2json(txt));
}
// I forgot about the Nidorans. Have to use UTF8
function identifyExtendedChars(str) {
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code > 127) {
            console.warn("String contains non-ascii character at index "
                + i + ": " + str[i]);
        }
    }
}
// Check to make sure that each Pokemon has exactly 3 grades
function verifyGradeCounts(list) {
    for (let pokemon of list) {
        const gradeCount = pokemon.grades.length;
        const name = pokemon.name;
        if (gradeCount != 3) {
            console.warn(`${name} has ${gradeCount} grades. Expected 3.`);
            continue;
        }
    }
}
function effectWarning(name, pos) {
    console.warn(name + " has multiple " + (pos ? "positive" : "negative")
        + " effects. Expected only one of both positive and negative");
}
function raw2json(rawText) {
    let lines = rawText.split(/\r?\n/g);
    let results = [];
    let pokemon;
    let grade;
    let lastProp;
    for (let line of lines) {
        // consider trimming string here if there's issues
        if (line.length == 0)
            continue;
        // not tracking upgrade success rate for each Pokemon
        // it lies outside the scope of this program
        // also, I'm pretty sure it's a constant 100% and 40%
        if (line.startsWith("==")) { // start new pokemon
            pokemon = new Pokemon();
            let start = line.indexOf(' ') + 1;
            let end = line.indexOf('=', start);
            pokemon.name = line.substring(start, end);
            results.push(pokemon);
            grade = null;
        }
        else if (line.startsWith("--")) { // start new grade
            grade = new Grade();
            pokemon.grades.push(grade);
        }
        else if (grade) { // grade property
            let idx = line.indexOf(':');
            let prop, val;
            if (idx == -1) {
                prop = lastProp;
                val = line.trim();
            }
            else {
                prop = line.substring(0, idx);
                val = line.substring(idx + 1).trim();
                lastProp = prop;
            }
            switch (prop) {
                case "Color":
                    if (!pokemon.colors.includes(val)) {
                        pokemon.colors.push(val);
                    }
                    break;
                case "Grade":
                    // not handling unless I suspect something is out of order
                    break;
                case "Effect Pokemon":
                    idx = val.lastIndexOf(' ');
                    let effect = {
                        stat: val.substring(0, idx),
                        amount: parseFloat(val.substring(idx + 1))
                    };
                    //grade.effects.push(effect);
                    if (effect.amount > 0) {
                        if (grade.posEffect) {
                            effectWarning(pokemon.name, true);
                        }
                        grade.posEffect = effect;
                    }
                    else {
                        if (grade.negEffect) {
                            effectWarning(pokemon.name, false);
                        }
                        grade.negEffect = effect;
                    }
                    break;
            }
        }
    }
    verifyGradeCounts(results);
    return results;
}
//# sourceMappingURL=raw2json.js.map