var fs = require('fs');
var path = require('path');
var cheerio = require('cheerio');

module.exports = exports = format;

function format(configFilename) {
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
        if (tdTopLeft.text().match(/IE\/Group\s+Name/g) == null) {
            return true;
        }
        let sectionNumberName = config.shift().match(/(\d+(\.\d+)*)\s(.*)/);
        let sectionNumber = sectionNumberName[1];
        let sectionName = sectionNumberName[3];
        let header = [];
        $(trFirst).find('td').each(function (index, td) {
            header.push($(td).text().trim());
        });
        let content = [];
        depthMax = 0;
        trs.each(function (index, tr) {
            if (index == 0) {
                return true;
            }
            let row = {};
            $(tr).children('td').each(function (index, td) {
                let text = $(td).text().trim().replace(/\n/g, '');
                if (index == 0) {
                    let matchBracket = $(td).text().match(/>/g);
                    depth = matchBracket ? matchBracket.length : 0;
                    depthMax = Math.max(depthMax, depth);
                    if (depth) {
                        text = text.replace(/^>+/, '');
                    }
                }
                row[header[index]] = text;
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

if (require.main == module) {
    if (process.argv.length >= 3) {
        console.log(JSON.stringify(format(process.argv[2]), null, 2));
    } else {
        console.log('Usage: node formatter <file_name>');
        console.log('  ex : node formatter 38473-f10.htm');
    }
}