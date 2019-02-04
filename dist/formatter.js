var fs = require('fs');
var path = require('path');
var ArgumentParser = require('argparse').ArgumentParser;
var parseAndExpand = require('./lib/parseAndExpand');
var toWorkbook = require('./lib/formatXlsx').toWorkbook;
var parse = parseAndExpand.parse;
var expand = parseAndExpand.expand;
exports.parse = parse;
exports.expand = expand;
exports.toWorkbook = toWorkbook;
exports.format = format;
function format(messageIEname, definitions, raw = false) {
    expand(messageIEname, definitions, raw);
    return toWorkbook(messageIEname, definitions);
}
if (require.main == module) {
    let argParser = new ArgumentParser({ addHelp: true, debug: true });
    argParser.addArgument('specFile', { help: 'Specification file name' });
    argParser.addArgument('messageIEname', { nargs: '*', defaultValue: '__all',
        help: 'Message or IE name' });
    argParser.addArgument(['-r', '--raw'], { help: 'Do not expand sub IEs',
        action: 'storeTrue' });
    let args = {};
    try {
        args = argParser.parseArgs();
    }
    catch (e) {
        argParser.printHelp();
        process.exit();
    }
    let filename = path.parse(args.specFile);
    let html = fs.readFileSync(path.resolve(process.cwd(), filename['dir'], filename['base']), 'utf8');
    let definitions = parse(html);
    let outputFilenameArr = [];
    if (args.messageIEname != '__all') {
        outputFilenameArr.push(args.messageIEname);
    }
    outputFilenameArr.push(filename['name']);
    if (args.raw) {
        outputFilenameArr.push('raw');
    }
    let formatted = format(args.messageIEname, definitions, args.raw);
    if (formatted) {
        formatted.write(`${outputFilenameArr.join('-')}.xlsx`);
    }
}
