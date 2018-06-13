# 3GPP Message Formatter

It formats application protocol messages into tables

## Dependencies

```sh
npm install cheerio
```

## Usage

- Save as a 3GPP specification document in a web page format (*.htm, *.html)
   - Make sure that a web page is encoded in UTF-8
- Create a configuration file as [Example of Configuration File](#config-example)

### Package

```js
var format = require('./3gpp-message-formatter');
var workbook = format(<config_file_name>);
// var workbook = format('config');
```

### Module

```js
var format = require('./formatter');
var workbook = format(<file_name>);
// var workbook = format('config');
```

### Command Line

```sh
node formatter <config_file_name> <outfile_name>
# node formatter config.example 38473-f11.xlsx
```

### <a id='config-example'>Example of Configuration File</a>

Make sure that the number of and the order of (section number, section name) pairs and those of tables are the same

```
38473-f11.htm
9.2.1.1	RESET
9.2.1.2	RESET ACKNOWLEDGE
9.2.1.3	ERROR INDICATION
9.2.1.4	F1 SETUP REQUEST
9.2.1.5	F1 SETUP RESPONSE
9.2.1.6	F1 SETUP FAILURE
(and more)
```