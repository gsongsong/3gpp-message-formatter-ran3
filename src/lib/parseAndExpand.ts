var $ = require('cheerio');

var reTagHeader = /h[1-6]/g;
var reTagHeaderAlternative = /^\b([1-9A-Z]\d*(\.[1-9]\d*)*(\.[1-9]\d*\w*))\b\s+(.*)\s*?/;
var reTagTable = /table/g
var reReferenceNumber = /\b[1-9A-Z]\d*(\.[1-9]\d*)*(\.[1-9]\d*\w*)\b/;
var reReferenceNumberName = /\b([1-9A-Z]\d*(\.[1-9]\d*)*(\.[1-9]\d*\w*))\b\s+(.*)/;
var reIEGroupName = /IE.*Group.*Name/gi;
var reRangeBound = /Range.*bound/gi;
var reCondition = /Condition/gi;
var reCause = /Cause/gi;

var reForSeparateSheets = [reCause];

export function parse(html) {
    let definitions = {};
    let lastHeader = null;
    let deque = [$(html)];
    while (deque.length) {
        let root = deque.pop();
        let idxToInsert = deque.length;
        if (root['type'] == 'tag') {
            if (root['name'].match(reTagHeader)) {
                lastHeader = normalizeWhitespaces($(root).text());
                continue;
            }
            if ($(root).text().match(reTagHeaderAlternative)) {
                lastHeader = normalizeWhitespaces($(root).text());
                continue;
            }
            if (root['name'].match(reTagTable)) {
                let rows = [];
                $(root).children().each(function(idxChild, tableChild) {
                    if (tableChild['type'] == 'tag') {
                        switch (tableChild['name']) {
                            case 'thead':
                            case 'tbody':
                            case 'tfoot':
                                $(tableChild).children('tr').each(
                                    function(idxRow, tr) {
                                        rows.push(tr);
                                    });
                                break;
                            case 'tr':
                                rows.push(tableChild);
                                break;
                        }
                    }
                });
                tableToJson(definitions, rows, lastHeader);
                continue;
            }
        }
        $(root).children().each(function(idxRoot, child) {
            deque.splice(idxToInsert, 0, child);
        });
    }
    return definitions;
}

export function expand(messageIEname, definitions, raw = false) {
    for (let key in definitions) {
        let sectionNumber = key;
        let definition = definitions[sectionNumber];
        if (messageIEname != '__all' && messageIEname != definition['name']) {
                continue;
        }
        if (definition['separate']) {
            continue;
        }
        let content = definition['content'];
        let unexpandedFieldExists;
        do {
            unexpandedFieldExists = false;
            for (let i = content.length - 1; i >= 0; i--) {
                let item = content[i]['content'];
                let depth = content[i]['depth'];
                let reference = item[3];
                if (!reference) {
                    continue;
                }
                let referenceMatch = reference.match(reReferenceNumber);
                if (!referenceMatch || raw) {
                    continue;
                }
                let referenceNumber = referenceMatch[0];
                if (!(referenceNumber in definitions)) {
                    continue;
                }
                unexpandedFieldExists = true;
                // Deep copy excluding header
                let dereferenced = definitions[referenceNumber];
                let contentToInsert = JSON.parse(JSON.stringify(
                                            dereferenced['content'].slice(1)));
                if (contentToInsert.length == 1) {
                    mergeDefinition(content, i, contentToInsert[0]);
                } else {
                    let expandAsIs = true;
                    if (hasOneRoot(contentToInsert) &&
                            item[0] == contentToInsert[0]['content'][0]) {
                        expandAsIs = false;
                        mergeDefinition(content, i, contentToInsert[0]);
                        contentToInsert.splice(0, 1);
                    }
                    for (let j = 0; j < contentToInsert.length; j++) {
                        content.splice(i + j + 1, 0, contentToInsert[j]);
                        let numFill = content[i]['content'].length - 
                                        content[i + j + 1]['content'].length;
                        for (let k = 0; k < numFill; k++) {
                            content[i + j + 1]['content'].push(null);
                        }
                        content[i + j + 1]['depth'] += depth + expandAsIs;
                        definition['depthMax'] =
                            Math.max(definition['depthMax'],
                                        content[i + j + 1]['depth']);
                    }
                    item[3] = null;
                }
                mergeAuxiliary(definition, dereferenced);
            }
        } while (unexpandedFieldExists);
    }
}

function tableToJson(definitions, rows, header) {
    if (!header) {
        return;
    }
    let matchResult = header.match(reReferenceNumberName);
    if (!matchResult) {
        return;
    }
    let sectionNumber = matchResult[1];
    let sectionName = matchResult[4];
    let content = [];
    let depthMin = Infinity;
    let depthMax = 0;
    let tableType = 'definition';
    $(rows).each(function(idxRow, row) {
        let rowContent = {content: [], depth: 0};
        $(row).children('td').each(function(idxCell, td) {
            let tdText = normalizeWhitespaces($(td).html());
            tdText = tdText.replace(/<sup>(.*?)<\/sup>/g, '^($1)');
            tdText = normalizeWhitespaces($(tdText).text());
            if (idxRow == 0 && idxCell == 0) {
                if (tdText.match(reIEGroupName)) {
                } else {
                    for (let re of reForSeparateSheets) {
                        if (tdText.match(re)) {
                            tableType = 'separate';
                            sectionName = re.toString();
                            break;
                        }
                    }
                    if (tableType == 'separate') {
                    } else if(tdText.match(reRangeBound) ||
                                tdText.match(reCondition)) {
                        tableType = 'auxiliary'
                    } else {
                        tableType = 'invalid';
                        return false;
                    }
                }
            }
            if (idxCell == 0 && idxRow > 0) {
                let matchBracket = tdText.match(/^>+/);
                if (matchBracket) {
                    rowContent['depth'] = matchBracket[0].length;
                    depthMin = Math.min(depthMin, rowContent['depth']);
                    depthMax = Math.max(depthMax, rowContent['depth']);
                    tdText = tdText.replace(/^>+/, '');
                } else {
                    depthMin = 0;
                }
            }
            rowContent['content'].push(tdText);
        });
        content.push(rowContent);
        if (tableType == 'invalid') {
            return false;
        }
    });
    depthMax -= depthMin;
    for (let rowContent of content) {
        rowContent['depth'] -= depthMin;
    }
    if (tableType == 'definition') {
        definitions[sectionNumber] = {
            name: sectionName,
            content: content,
            depthMax: depthMax,
        }
    } else if (tableType == 'separate') {
        if (!(sectionName in definitions)) {
            definitions[sectionName] = {
                content: content,
                separate: true,
            }
            definitions[sectionName]['content'].push(null);
        } else {
            for (let elem of content) {
                definitions[sectionName]['content'].push(elem);
            }
            definitions[sectionName]['content'].push(null);
        }
    } else if (tableType == 'auxiliary') {
        if (sectionNumber in definitions) {
            let definition = definitions[sectionNumber];
            if (!('auxiliary' in definition)) {
                definition['auxiliary'] = [content];
            } else {
                definition['auxiliary'].push(content);
            }
        } else {
            throw 'Definition does not exist';
        }
    } else {
        return;
    }
}

function normalizeWhitespaces(string) {
    return string.trim().replace(/\s+/g, ' ');
}

function hasOneRoot(content) {
    return content.filter(function (item) {
                            return item['depth'] == 0;
                        }).length == 1;
}

function mergeDefinition(content, i, contentToInsert) {
    var item = content[i]['content'];
    for (let i = 0 ; i < item.length; i++) {
        // Do not overwrite IE/Group Name and Presence
        if (i == 0 || i == 1) {
            continue;
        }
        if (i >= contentToInsert['content'].length) {
            break;
        }
        let subContent = contentToInsert['content'][i];
        if (!subContent) {
            if (i != 3) {
                // Index 3 is IE type and reference
                // Without this check, reference number will not be removed
                // And infinite loop may happen
                continue;
            }
        }
        if (i == 4) {
            item[i] += '\n\n' + subContent;
        } else {
            item[i] = subContent;
        }
    }
}

function mergeAuxiliary(definition, dereferenced) {
    if (!('auxiliary' in dereferenced)) {
        return;
    }
    let auxDereferenced = dereferenced['auxiliary'];
    if (!('auxiliary' in definition)) {
        definition['auxiliary'] = JSON.parse(JSON.stringify(
                                        dereferenced['auxiliary']));
        return;
    }
    let auxsInDefinitions = definition['auxiliary'];
    for (let auxiliary of auxDereferenced) {
        let skipAux = false;
        for (let re of reForSeparateSheets) {
            if (auxiliary[0]['content'][0].match(re)) {
                skipAux = true;
                break;
            }
        }
        if (skipAux) {
            continue;
        }
        let idxAux = null;
        for (let i = 0; i < auxsInDefinitions.length; i++) {
            if (auxiliary[0]['content'][0] ==
                    auxsInDefinitions[i][0]['content'][0]) {
                idxAux = i;
                break;
            }
        }
        if (idxAux == null) {
            auxsInDefinitions.push(JSON.parse(JSON.stringify(auxiliary)));
        } else {
            let auxContent = auxsInDefinitions[idxAux];
            for (let i = 1; i < auxiliary.length; i++) {
                let idxRow = null;
                for (let j = 1; j < auxContent.length; j++) {
                    if (auxiliary[i]['content'][0] ==
                            auxContent[j]['content'][0]) {
                        idxRow = j;
                        break;
                    }
                }
                if (idxRow != null) {
                    continue;
                }
                auxContent.push(JSON.parse(JSON.stringify(auxiliary[i])));
            }
        }
    }
}
