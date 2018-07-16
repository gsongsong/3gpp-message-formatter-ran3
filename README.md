# 3GPP Message Formatter for RAN3

It formats application protocol messages into tables

## Dependencies

```sh
npm install cheerio @gsongsong/xlsx
```

## Installation

```sh
npm i third-gen-message-formatter-ran3
```

## Usage

- Save as a 3GPP specification document in a web page format (*.htm, *.html)
   - Make sure that a web page is encoded in UTF-8

### Package

```js
var format = require('third-gen-message-formatter-ran3');
var workbook = format(<config_file_name>);
// var workbook = format('config');
```

### Command Line

```sh
node formatter <input_file>
# node formatter 38473-f11.htm
```

## Limitations

Currently, you need to handle manually some message/IE types which refer other specification documents

## Contact

Bug/Issue reporting: https://github.com/gsongsong/3gpp-message-formatter-ran3/issues