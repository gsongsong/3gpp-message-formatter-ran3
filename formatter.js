var fs = require('fs');
var path = require('path');
var cheerio = require('cheerio');
var xlsx = require('xlsx');

module.exports = exports = format;

function format(configFilename) {
    var parseResult = parse(configFilename);
    expand(parseResult);
    return toWorkbook(parseResult);
}

var reReferenceNumber = /\b[1-9A-Z]\d*(\.[1-9]\d*)*(\.[1-9]\d*\w*)\b/;
var reReferenceNumberName = /\b([1-9A-Z]\d*(\.[1-9]\d*)*(\.[1-9]\d*\w*))\b\s+(.*)/;

function parse(configFilename) {
    var configFileDir = path.parse(configFilename)['dir'];
    var definitions = {};
    var headersGlobal = [];
    var headersUpper = [];
    // TODO: handle newline more elegantly
    var config = fs.readFileSync(configFilename, 'utf8').split('\n')
                    .map(function (elem) {
                        return elem.trim();
                    });
    var htmlFilename = path.resolve(__dirname,configFileDir, config.shift());
    var $ = cheerio.load(fs.readFileSync(htmlFilename, 'utf8'));
    var tbodies = $('table');
    tbodies.each(function (index, tbody) {
        let trs = $(tbody).find('tr');
        let trFirst = trs.first();
        let tdTopLeft = normalizeWhitespaces(trFirst.find('td').first()
                                                    .text());
        // NOTE: In cheerio DOM, newline is not converted into whitespace
        if (tdTopLeft.match(/IE\/Group Name/i)) {
            if (!config.length) {
                throw tocTableMismatch;
            }
            let line = config.shift();
            if (!line) {
                throw tocTableMismatch;
            }
            if (line == 'end') {
                return false;
            }
            let sectionNumberNameExport = line.match(reReferenceNumberName);
            let sectionNumber = sectionNumberNameExport[1];
            let sectionName = sectionNumberNameExport[4];
            let doNotExport = false;
            if (sectionName.endsWith('*')) {
                doNotExport = true;
                sectionName = sectionName.substring(0, sectionName.length - 1)
                                        .trim();
            }
            let headers = [];
            $(trFirst).find('td').each(function (index, td) {
                let header = normalizeWhitespaces($(td).text());
                let i = headersUpper.indexOf(header.toUpperCase());
                if (i != -1) {
                    header = headersGlobal[i];
                } else {
                    headersGlobal.push(header);
                    headersUpper.push(header.toUpperCase());
                }
                headers.push(header);
            });
            let content = [];
            depthMax = 0;
            trs.each(function (index, tr) {
                if (index == 0) {
                    return true;
                }
                let row = {};
                $(tr).children('td').each(function (index, td) {
                    let text = $(td).html();
                    text = text.replace(/<sup>(.*?)<\/sup>/g, '^($1)');
                    text = normalizeWhitespaces($(text).text());
                    if (index == 0) {
                        let matchBracket = $(td).text().match(/>/g);
                        depth = matchBracket ? matchBracket.length : 0;
                        depthMax = Math.max(depthMax, depth);
                        if (depth) {
                            text = text.replace(/^>+/, '');
                        }
                    }
                    row[headers[index]] = text ? text : null;
                });
                row.depth = depth;
                content.push(row);
            });
            definitions[sectionNumber] = {
                name: sectionName,
                header: headers,
                content: content,
                depthMax: depthMax,
                doNotExport: doNotExport,
            };
            // console.log(sectionNumber, 
            //             JSON.stringify(definitions[sectionNumber], null, 2));
        } else if (tdTopLeft.match(/Range bound/i)) {
            if (!('Range bound' in definitions)) {
                definitions['Range bound'] = {};
            }
            let rangeBounds = definitions['Range bound'];
            trs.each(function (index, tr) {
                if (index == 0) {
                    return true;
                }
                let tds = $(tr).children('td');
                let name = normalizeWhitespaces($(tds[0]).text());
                let explanation = normalizeWhitespaces($(tds[1]).text());
                if (name in rangeBounds) {
                    return true;
                }
                rangeBounds[name] = explanation;
            });
        } else if (tdTopLeft.match(/cause/i)) {
            if (!('Causes' in definitions)) {
                definitions['Causes'] = {};
            }
            let causesAll = definitions['Causes'];
            let causeType = normalizeWhitespaces(tdTopLeft);
            if (!(causeType in causesAll)) {
                causesAll[causeType] = {};
            }
            causes = causesAll[causeType];
            trs.each(function (index, tr) {
                if (index == 0) {
                    return true;
                }
                let tds = $(tr).children('td');
                let name = normalizeWhitespaces($(tds[0]).text());
                let meaning = normalizeWhitespaces($(tds[1]).text());
                if (name in causes) {
                    return true;
                }
                causes[name] = meaning;
            });
        }
    });
    if (config.filter(function (item) { return !!item && item != 'end'; }).length) {
        throw tocTableMismatch;
    }
    return {definitions: definitions,
            headersGlobal: headersGlobal,
            headersUpper: headersUpper};
}

function expand(parseResult) {
    var definitions = parseResult['definitions'];
    var headersGlobal = parseResult['headersGlobal'];
    var headersUpper = parseResult['headersUpper'];
    for (let key in definitions) {
        if (key == 'Range bound' || key == 'Causes') {
            continue;
        }
        let sectionNumber = key;
        let definition = definitions[sectionNumber];
        let content = definition['content'];
        let unexpandedFieldExists;
        do {
            unexpandedFieldExists = false;
            for (let i = content.length - 1; i >= 0; i--) {
                let item = content[i];
                let depth = item['depth'];
                let reference = item[headerName('IE type and reference',
                                                headersGlobal, headersUpper)];
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
                let contentToInsert = JSON.parse(JSON.stringify(
                    definitions[referenceNumber]['content']));
                if (contentToInsert.length == 1) {
                    mergeDefinition(content, i, contentToInsert,
                                    headersGlobal, headersUpper);
                } else {
                    let expandAsIs = true;
                    if (hasOneRoot(contentToInsert) &&
                        item[headerName('IE/Group Name',
                                                headersGlobal, headersUpper)] ==
                        contentToInsert[0][headerName('IE/Group Name',
                                                headersGlobal, headersUpper)]) {
                        expandAsIs = false;
                        mergeDefinition(content, i, [contentToInsert[0]],
                                        headersGlobal, headersUpper);
                        contentToInsert.splice(0, 1);
                    }
                    content.splice(i + 1, 0, ...contentToInsert);
                    for (let j = 0; j < contentToInsert.length; j++) {
                        content[i + j  +1]['depth'] += depth + expandAsIs;
                        definition['depthMax'] =
                            Math.max(definition['depthMax'],
                                        content[i + j + 1]['depth']);
                    }
                    item[headerName('IE type and reference',
                                    headersGlobal, headersUpper)] = null;
                }
            }
        } while (unexpandedFieldExists);
    }
}

function toWorkbook(parseResult) {
    var definitions = parseResult['definitions'];
    var workbook = xlsx.utils.book_new();
    for (let key in definitions) {
        if (key == 'Range bound') {
            let rangeBounds = definitions[key];
            let worksheet_data =[];
            worksheet_data.push(['Range bound', 'Explanation']);
            for (let name in rangeBounds) {
                worksheet_data.push([name, rangeBounds[name]]);
            }
            let worksheet = xlsx.utils.aoa_to_sheet(worksheet_data);
            xlsx.utils.book_append_sheet(workbook, worksheet, 'Range bound');
        } else if (key == 'Causes') {
            let causesAll = definitions[key];
            let worksheet_data = [];
            for (let causeType in causesAll) {
                worksheet_data.push([causeType, 'Meaning']);
                let causes = causesAll[causeType];
                for (let name in causes) {
                    worksheet_data.push([name, causes[name]]);
                }
                worksheet_data.push([null]);
            }
            let worksheet = xlsx.utils.aoa_to_sheet(worksheet_data);
            xlsx.utils.book_append_sheet(workbook, worksheet, 'Causes');
        } else {
            let sectionNumber = key;
            let definition = definitions[sectionNumber];
            if (definition['doNotExport']) {
                continue;
            }
            let name = definition['name'];
            let depthMax = definition['depthMax'];
            let worksheet_data = [];
            worksheet_data.push([name]);
            worksheet_data.push([null]);
            let header = [];
            for (let item of definition['header']) {
                header.push(item);
            }
            for (let i = 0; i < depthMax; i++) {
                header.splice(1, 0, null);
            }
            worksheet_data.push(header);
            for (let item of definition['content']) {
                let row = [];
                for (let key in item) {
                    if (key == 'depth') {
                        continue;
                    }
                    row.push(item[key]);
                }
                for (let i = 0; i < depthMax - item['depth']; i++) {
                    row.splice(1, 0, null);
                }
                for (let i = 0; i < item['depth']; i++) {
                    row.splice(0, 0, null);
                }
                worksheet_data.push(row);
            }
            let worksheet = xlsx.utils.aoa_to_sheet(worksheet_data);
            let sheetname = `${sectionNumber} ${name}`.substring(0, 30)
                                .replace(/[\\\/?*\[\]]/g, '_');
            xlsx.utils.book_append_sheet(workbook, worksheet, sheetname);
        }
    }
    return workbook;
}

function normalizeWhitespaces(string) {
    return string.trim().replace(/\s+/g, ' ');
}

function headerName(name, headersGlobal, headersUpper) {
    return headersGlobal[headersUpper.indexOf(name.toUpperCase())];
}

function hasOneRoot(content) {
    return content.filter(function (item) {
                            return item['depth'] == 0;
                        }).length == 1;
}

function mergeDefinition(content, i, contentToInsert,
                            headersGlobal, headersUpper) {
    var item = content[i];
    var headerTypeName = headerName('IE/Group Name',
                                    headersGlobal, headersUpper);
    var headerPresence = headerName('Presence', headersGlobal, headersUpper);
    var headerTypeRef = headerName('IE type and reference',
                                    headersGlobal, headersUpper);
    for (let key in item) {
        if (headerName(key, headersGlobal, headersUpper) == headerTypeName) {
            continue;
        }
        if (headerName(key, headersGlobal, headersUpper) == headerPresence) {
            continue;
        }
        if (key == 'depth') {
            continue;
        }
        if (headerName(key, headersGlobal, headersUpper) == headerTypeRef ||
            (!item[headerName(key, headersGlobal, headersUpper)])) {
                item[headerName(key, headersGlobal, headersUpper)] =
                    contentToInsert[0][headerName(key,
                                                headersGlobal, headersUpper)];
            }
    }
}

var tocTableMismatch = `Number of messages/IEs in config file and number of tables in specification document mismatch!
    1. Check whether there are missing or unintended items in config file
    2. Check whether there are missing (uncompleted) tables in specification document file`;

if (require.main == module) {
    if (process.argv.length >= 4) {
        xlsx.writeFile(format(process.argv[2]), process.argv[3]);
    } else {
        console.log('Usage: node formatter <config_file_name> <outfile_name>');
        console.log('  ex : node formatter config.example 38473-f11.xlsx');
    }
}