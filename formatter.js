var fs = require('fs');
var path = require('path');
var $ = require('cheerio');
var xlsx = require('@gsongsong/xlsx');

module.exports = exports = format;

function format(html) {
    var definitions = parse(html);
    expand(definitions);
    return toWorkbook(definitions);
}

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

function parse(html) {
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
            if (idxCell == 0) {
                let matchBracket = tdText.match(/^>+/);
                if (matchBracket) {
                    rowContent['depth'] = matchBracket[0].length;
                    depthMax = Math.max(depthMax, rowContent['depth']);
                    tdText = tdText.replace(/^>+/, '');
                }
            }
            rowContent['content'].push(tdText);
        });
        content.push(rowContent);
        if (tableType == 'invalid') {
            return false;
        }
    });
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

function expand(definitions) {
    for (let key in definitions) {
        let sectionNumber = key;
        let definition = definitions[sectionNumber];
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
                if (!referenceMatch) {
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

function toWorkbook(definitions) {
    var workbook = xlsx.utils.book_new();
    workbook['Styles'] = {};
    let style = workbook['Styles'];
    style['Fills'] = [{patternType: 'none'},
                        {patternType: 'gray125'},
                        {patternType: 'solid', fgColor: {theme: 0},
                            bgColor: {indexed: 64}}];
    style['Borders'] = [{},
                        {top: {style: 'thin'}},
                        {left: {style: 'thin'}},
                        {top: {style: 'thin'}, left: {style: 'thin'}}];
    style['CellXf'] = [{numFmtId: 0, fontId: 0, fillId: 0, borderId: 0,
                        xfId: 0},
                        {numFmtId: 0, fontId: 0, fillId: 2, borderId: 1,
                        xfId: 0, applyBorder: true},
                        {numFmtId: 0, fontId: 0, fillId: 2, borderId: 2,
                        xfId: 0, applyBorder: true},
                        {numFmtId: 0, fontId: 0, fillId: 2, borderId: 3,
                        xfId: 0, applyBorder: true}];
    for (let key in definitions) {
        let sectionNumber = key;
        let definition = definitions[sectionNumber];
        let name = definition['name'];
        let depthMax = definition['depthMax'] || 0;
        let worksheet_data = [];
        let styles = {};
        let rowNum = 1;
        worksheet_data.push([name]);
        rowNum++;
        worksheet_data.push([null]);
        rowNum++;
        for (let content of definition['content']) {
            if (!content) {
                worksheet_data.push([null]);
                rowNum++;
                continue;
            }
            let depth = content['depth'];
            let row = [];
            let k = 0;
            for (let elem of content['content']) {
                row.push(elem);
                if (!k) {
                    styles[cellAddress(rowNum, depth + 1)] = 3;
                } else {
                    styles[cellAddress(rowNum, depthMax + k + 1)] = 1;
                }
                k++;
            }
            for (let i = 0; i < depth; i++) {
                row.splice(0, 0, null);
                styles[cellAddress(rowNum, i + 1)] = 2;
            }
            for (let i = 0; i < depthMax - depth; i++) {
                row.splice(depth + 1, 0, null);
                styles[cellAddress(rowNum, depth + 1 + i + 1)] = 1;
            }
            worksheet_data.push(row);
            rowNum++;
        }
        if ('auxiliary' in definition) {
            for (let auxiliary of definition['auxiliary']) {
                worksheet_data.push([null]);
                for (let content of auxiliary) {
                    let row = [];
                    for (let elem of content['content']) {
                        row.push(elem);
                    }
                    for (let i = 0; i < depthMax; i++) {
                        row.splice(1, 0, null);
                    }
                    worksheet_data.push(row);
                }
            }
        }
        let worksheet = xlsx.utils.aoa_to_sheet(worksheet_data);
        worksheet['!cols'] = [];
        for (let i = 0; i < depthMax; i ++) {
            worksheet['!cols'].push({wch: 3});
        }
        for (let cell in styles) {
            if (!(cell in worksheet)) {
                worksheet[cell] = {};
            }
            worksheet[cell]['s'] = styles[cell];
        }
        let sheetname = `${sectionNumber} ${name || ''}`.substring(0, 30)
                            .replace(/[\\\/?*\[\]]/g, '_');
        xlsx.utils.book_append_sheet(workbook, worksheet, sheetname);
    }
    return workbook;
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
            continue;
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

function cellAddress(r, c) {
    let address = base26(c) + r;
    return address;
}

// 1: A, 2: B, ..., 27: AA
function base26(num) {
    var c = [];
    while (num) {
        let r = num % 26;
        c.splice(0, 0, String.fromCharCode('A'.charCodeAt(0) + r - 1));
        num = (num - r) / 26;
    }
    return c.join('');
}

if (require.main == module) {
    if (process.argv.length >= 3) {
        let filename = path.parse(process.argv[2]);
        let html = fs.readFileSync(path.resolve(process.cwd(), filename['dir'],
                                                filename['base']),
                                    'utf8');
        xlsx.writeFile(format(html), `${filename['name']}.xlsx`);
    } else {
        console.log('Usage: node formatter <file_name>');
        console.log('  ex : node formatter 38473-f11.htm');
    }
}
