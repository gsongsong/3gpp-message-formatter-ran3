var xlsx = require('@gsongsong/xlsx');
var addr = xlsx.utils.encode_cell;
var cell = xlsx.utils.decode_cell;

exports.toWorkbook = toWorkbook;

var fillWhite = {patternType: 'solid', fgColor: {rgb: 'FFFFFFFF'}}
var borderTop = {top: {style: 'thin'}};
var borderLeft = {left: {style: 'thin'}};
var borderTopLeft = {top: {style: 'thin'}, left: {style: 'thin'}};

function toWorkbook(messageIEname, definitions) {
    var workbook = xlsx.utils.book_new();
    for (let key in definitions) {
        let sectionNumber = key;
        let definition = definitions[sectionNumber];
        let name = definition['name'];
        if (messageIEname != '__all' && messageIEname != name) {
            continue;
        }
        let depthMax = definition['depthMax'] || 0;
        let worksheet_data = [];
        let styles = {};
        let rowNum = 0;
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
                    styles[addr({c: depth, r: rowNum})] = {fill: fillWhite,
                                                           border: borderTopLeft};
                } else {
                    styles[addr({c: depthMax + k, r: rowNum})] = {fill: fillWhite,
                                                                  border: borderTop};
                }
                k++;
            }
            for (let i = 0; i < depth; i++) {
                row.splice(0, 0, null);
                styles[addr({c: i, r: rowNum})] = {fill: fillWhite,
                                                   border: borderLeft};
            }
            for (let i = 0; i < depthMax - depth; i++) {
                row.splice(depth + 1, 0, null);
                styles[addr({c: depth + i + 1, r: rowNum})] = {fill: fillWhite,
                                                               border: borderTop};
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
        }
        for (let address in styles) {
            if ('fill' in styles[address]) {
                xlsx.utils.set_fill(workbook, worksheet, cell(address), styles[address]['fill']);
            }
            if ('border' in styles[address]) {
                xlsx.utils.set_border(workbook, worksheet, cell(address), styles[address]['border']);
            }
        }
        let sheetname = `${sectionNumber} ${name || ''}`.substring(0, 30)
                            .replace(/[\\\/?*\[\]]/g, '_');
        xlsx.utils.book_append_sheet(workbook, worksheet, sheetname);
    }
    return workbook;
}
