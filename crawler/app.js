/*
* @Author: Luis Perez
* @Date:   2016-08-01 15:39:03
* @Last Modified by:   Luis Perez
* @Last Modified time: 2016-08-05 15:19:34
*/

'use strict';

var _ = require("lodash")
  , debug = require('debug')('scripts:crawler:app')
  , fs = require("fs")
  , json2csv = require("json2csv")
  , table = require("text-table");

var argv = require('yargs')
  .usage("Usage: $0 -d [domain] -n [num] -m [num] -s [num] -o [file]")
  .help("h")
  .describe("m", "Method to use for the search. This should be a comma separated lists.")
  .describe("n", "The number of search results per request (default 10). [1,..,100].")
  .describe("m", "The maximum number of requests to make to the Google API. (default 1) [1..].")
  .describe("s", "The result number from which to start")
  .describe("d", "The host domain to search for subdomains.")
  .describe("b", "Flag to specify if randomized interval should be used between requests. (default true)")
  .describe("o", "The output csv file for writing results. If not specified, outputs are written to stdout.")
  .alias("n", "num_results")
  .alias("m", "max_requests")
  .alias("d", "domain")
  .alias("o", "output")
  .alias("h", "help")
  .alias("s", "start")
  .number("n")
  .number("m")
  .demand(["d"])
  .default({
    n: 10,
    m: 1,
    b: true,
    s: 0
  })
  .argv;

// When we require setting up some asynchronous services.
var dependencies = {
  argv: argv,
  base: __dirname,
  constants: require("./config/constants")
}

// Determine which crawler method we've decided to use.
// TODO(nautilik): Need to make sure this function is generic.
// It needs to work with self-describing hashset.
var helpers = {
  prettyPrintResults: function(res){
    // Write out as a csv if data
    var values = _.sortBy(_.values(res), function(el){
      return -1 * el.ranking;
    });

    if (values.length > 0) {
      if (!argv.o){
        // truncate values so we can pretty print a little better
        var prettyOut = _.map(values, function(val){
          var name = val.name
            , URL = val.url.substring(0, CONST.outOptions.urlLength)
            , ranking = val.ranking
            , count = val.count;
          return [ranking, name, count, URL];
        });
        console.log(table(_.concat(
          [["Ranking", "Company", "Times Encountered", "URL"]],
          prettyOut)));
      }
      else{
        var csv = json2csv({ data: _.values(res) });
        fs.writeFile(argv.o, csv, function(err) {
          if (err) {
            console.log("failed to save file ", err);
          }
        });
      }
    }
  }
}