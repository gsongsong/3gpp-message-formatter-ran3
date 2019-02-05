"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var xlsx = require('excel4node');
var fillWhite = {
    type: 'pattern',
    patternType: 'solid',
    fgColor: 'FFFFFF'
};
var borderTop = { top: { style: 'thin' } };
var borderLeft = { left: { style: 'thin' } };
var borderTopLeft = { top: { style: 'thin' }, left: { style: 'thin' } };
var borderAll = {
    top: { style: 'thin' },
    bottom: { style: 'thin' },
    left: { style: 'thin' },
    right: { style: 'thin' }
};
function toWorkbook(messageIEname, definitions) {
    var workbook = new xlsx.Workbook();
    for (let key in definitions) {
        let sectionNumber = key;
        let definition = definitions[sectionNumber];
        let name = definition['name'];
        if (messageIEname != '__all' && messageIEname != name) {
            continue;
        }
        let sheetname = `${sectionNumber} ${name || ''}`.substring(0, 30)
            .replace(/[\\\/?*\[\]]/g, '_');
        let ws = workbook.addWorksheet(sheetname, {
            outline: {
                summaryBelow: false
            }
        });
        let depthMax = definition['depthMax'] || 0;
        for (let i = 0; i < depthMax; i++) {
            ws.column(i + 1).setWidth(3);
        }
        ws.column(depthMax + 1).setWidth(30);
        let rowNum = 1;
        ws.cell(rowNum, 1).string(`${name}`);
        rowNum += 2;
        for (let content of definition['content']) {
            if (!content) {
                rowNum++;
                continue;
            }
            let depth = content['depth'];
            let k = 0;
            for (let elem of content['content']) {
                let col = (k ? depthMax + k : depth) + 1;
                ws.cell(rowNum, col).string(`${elem !== null ? elem : ''}`).style({
                    fill: fillWhite,
                    border: k ? borderTop : borderTopLeft
                });
                k++;
            }
            for (let i = 0; i < depth; i++) {
                ws.cell(rowNum, i + 1).style({
                    fill: fillWhite,
                    border: borderLeft
                });
            }
            for (let i = 0; i < depthMax - depth; i++) {
                ws.cell(rowNum, depth + i + 2).style({
                    fill: fillWhite,
                    border: borderTop
                });
            }
            if (depth >= 1) {
                if (ws.row(rowNum).outlineLevel === null) {
                    ws.row(rowNum).group(Math.min(depth, 7));
                }
            }
            rowNum++;
        }
        if ('auxiliary' in definition) {
            for (let auxiliary of definition['auxiliary']) {
                rowNum++;
                for (let content of auxiliary) {
                    let col = 1;
                    for (let elem of content['content']) {
                        if (col == 1 && depthMax > 1) {
                            ws.cell(rowNum, col, rowNum, col + depthMax, true)
                                .string(`${elem !== null ? elem : ''}`)
                                .style({
                                fill: fillWhite,
                                border: borderAll
                            });
                        }
                        else {
                            ws.cell(rowNum, col).string(`${elem !== null ? elem : ''}`)
                                .style({
                                fill: fillWhite,
                                border: borderAll
                            });
                        }
                        col += depthMax + 1;
                    }
                    rowNum++;
                }
            }
        }
    }
    return workbook;
}
exports.toWorkbook = toWorkbook;
