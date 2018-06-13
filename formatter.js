var fs = require('fs');
var path = require('path');
var cheerio = require('cheerio');
var xlsx = require('xlsx');

module.exports = exports = format;

function format(configFilename) {
    var definitions = parse(configFilename);
    expand(definitions);
    return toWorkbook(definitions);
}

function parse(configFilename) {
    var definitions = {};
    // TODO: handle newline more elegantly
    var config = fs.readFileSync(configFilename, 'utf8').split('\n')
                    .map(function (elem) {
                        return elem.trim();
                    });
    var htmlFilename = config.shift();
    var $ = cheerio.load(fs.readFileSync(htmlFilename, 'utf8'));
    var tbodies = $('table');
    tbodies.each(function (index, tbody) {
        let trs = $(tbody).find('tr');
        let trFirst = trs.first();
        let tdTopLeft = trFirst.find('td').first();
        // NOTE: In cheerio DOM, newline is not converted into whitespace
        if (!normalizeWhitespaces(tdTopLeft.text()).match('IE/Group Name')) {
            return true;
        }
        let sectionNumberName = config.shift().match(/(\d+(\.\d+)*)\s(.*)/);
        let sectionNumber = sectionNumberName[1];
        let sectionName = sectionNumberName[3];
        let header = [];
        $(trFirst).find('td').each(function (index, td) {
            header.push(normalizeWhitespaces($(td).text()));
        });
        let content = [];
        depthMax = 0;
        trs.each(function (index, tr) {
            if (index == 0) {
                return true;
            }
            let row = {};
            $(tr).children('td').each(function (index, td) {
                let text = normalizeWhitespaces($(td).text());
                if (index == 0) {
                    let matchBracket = $(td).text().match(/>/g);
                    depth = matchBracket ? matchBracket.length : 0;
                    depthMax = Math.max(depthMax, depth);
                    if (depth) {
                        text = text.replace(/^>+/, '');
                    }
                }
                row[header[index]] = text ? text : null;
            });
            row.depth = depth;
            content.push(row);
        });
        definitions[sectionNumber] = {
            name: sectionName,
            header: header,
            content: content,
            depthMax: depthMax,
        };
    });
    return definitions;
}

function expand(definitions) {
    var reReference = /[1-9]\d*(\.[1-9]\d*)+/;
    for (let sectionNumber in definitions) {
        let definition = definitions[sectionNumber];
        let content = definition['content'];
        let unexpandedFieldExists;
        do {
            unexpandedFieldExists = false;
            for (let i = content.length - 1; i >= 0; i--) {
                let item = content[i];
                let depth = item['depth'];
                let reference = item['IE type and reference'];
                if (!reference) {
                    continue;
                }
                let referenceMatch = reference.match(reReference);
                if (!referenceMatch) {
                    continue;
                }
                let referenceNumber = referenceMatch[0];
                unexpandedFieldExists = true;
                let contentToInsert = JSON.parse(JSON.stringify(
                    definitions[referenceNumber]['content']));
                content.splice(i, 1, ...contentToInsert);
                for (let j = 0; j < contentToInsert.length; j++) {
                    content[i + j]['depth'] += depth;
                    definition['depthMax'] = Math.max(definition['depthMax'],
                                                      content[i + j]['depth']);
                }
            }
        } while (unexpandedFieldExists);
    }
}

function toWorkbook(definitions) {
    var workbook = xlsx.utils.book_new();
    for (let sectionNumber in definitions) {
        let definition = definitions[sectionNumber];
        let name = definition['name'];
        let depthMax = definition['depthMax'];
        let worksheet_data = [];
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
        xlsx.utils.book_append_sheet(workbook, worksheet,
            `${(`${sectionNumber} ${name}`).substring(0, 30)}`);
    }
    return workbook;
}

function normalizeWhitespaces(string) {
    return string.trim().replace(/\n/g, '').replace(/\s{2,}/g, ' ');
}

if (require.main == module) {
    if (process.argv.length >= 4) {
        xlsx.writeFile(format(process.argv[2]), process.argv[3]);
    } else {
        console.log('Usage: node formatter <config_file_name> <outfile_name>');
        console.log('  ex : node formatter config.example 38473-f11.xlsx');
    }
}