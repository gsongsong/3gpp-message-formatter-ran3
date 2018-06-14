# 3GPP Message Formatter

It formats application protocol messages into tables

## Dependencies

```sh
npm install cheerio xlsx
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

### <a id='config-example'>Examples of Configuration File</a>

**Key rule**: Make sure that the number of and the order of (section number, section name) pairs and those of tables are the same

```
38473-f11.htm
9.2.1.1	RESET
9.2.1.2	RESET ACKNOWLEDGE
9.2.1.3	ERROR INDICATION
(and more)
```

#### Options

`Asterisk (*)` at the end of line prevents a given message/IE from being added to workbook (i.e., no worksheet for a given message/IE will be created)

```
38473-f11.htm
9.2.1.1	RESET
...
9.3.1.4	gNB-CU UE F1AP ID *
(and more)
```

`end` keyword **at the end of a configuration file** will immediately halt a parsing process and will generate a workbook

```
36413-f10.htm
9.1.3.1	E-RAB SETUP REQUEST
9.1.3.2	E-RAB SETUP RESPONSE
...
9.2.1.1	Message Type *
(and more)
end
```

Be careful to use `end`:

   - All content above `end` must follow the **key rule**
   - No content after `end`

## Limitations

Current supported specification documents: RAN3 Application Protocol (36.4xx, 38.4xx AP series)

Currently, you need to handle manually some message/IE types which refer other specification documents

## Contact

Bug/Issue reporting: https://github.com/gsongsong/3gpp-message-formatter/issues