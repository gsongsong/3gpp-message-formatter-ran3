# 3GPP Message Formatter

It formats application protocol messages into tables

## Dependencies

```sh
npm install cheerio
```

## Usage

- Save as a 3GPP specification document in a web page format (*.htm, *.html)
- Make sure that a web page is encoded in UTF-8

### Package

```js
var format = require('./3gpp-message-formatter');
```

### Module

```js
var format = require('./formatter');
```

### Command Line

```sh
node formatter <file_name>
# node formatter 38473-f11.htm
```