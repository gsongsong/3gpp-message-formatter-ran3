# 3GPP Message Formatter for RAN3

It formats application protocol messages into tables

## Dependencies

```sh
npm install cheerio
git clone https://github.com/gsongsong/js-xlsx
npm link js-xlsx
```

## Usage

- Save as a 3GPP specification document in a web page format (*.htm, *.html)
   - Make sure that a web page is encoded in UTF-8

### Package

```js
var format = require('./3gpp-message-formatter');
var workbook = format(<config_file_name>);
// var workbook = format('config');
```

### Command Line

```sh
node formatter <input_file>
# node formatter 38473-f11.htm
```

## Limitations

Current supported specification documents: RAN3 Application Protocol (36.4x3, 38.4x3 AP series)

Currently, you need to handle manually some message/IE types which refer other specification documents

## Contact

Bug/Issue reporting: https://github.com/gsongsong/3gpp-message-formatter-ran3/issues