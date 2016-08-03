/*
* @Author: Edward & Luis
* @Date:   2016-08-01 15:39:03
* @Last Modified by:   Luis Perez
* @Last Modified time: 2016-08-02 13:59:28
*/

'use strict';

var _ = require("lodash")
  , debug = require('debug')('scripts:crawler')
  , fs = require("fs")
  , htmlparser = require("htmlparser")
  , json2csv = require("json2csv")
  , request = require("request");

var CONST = {
  element: "tag",
  type: "cite",
  heuristics: {
    minValidHTMLLength: 5000
  },
  searchParams: {
    uri: "https://www.google.com/search",
    method: "GET"
  },
  latency: {
    mean: 500,
    variance: 500
  }
}

var argv = require('yargs')
  .usage("Usage: $0 -d [domain] -n [num] -m [num] -o [file]")
  .help("h")
  .describe("n", "The number of search results per request (default 10). [1,..,100].")
  .describe("m", "The maximum number of requests to make to the Google API. (default 1) [1..].")
  .describe("d", "The host domain to search for subdomains.")
  .describe("b", "Flag to specify if randomized interval should be used between requests. (default true)")
  .describe("o", "The output csv file for writing results.")
  .alias("n", "num_results")
  .alias("m", "max_requests")
  .alias("d", "domain")
  .alias("o", "output")
  .alias("h", "help")
  .number("n")
  .number("m")
  .demand(["d", "o"])
  .default({
    n: 10,
    m: 1,
    b: true
  })
  .argv;

var utils = {
  /**
   * Given rawHTML, creates a manageable DOM object using htmlparser library.
   * @param  {string} rawHTML The input raw HTML.
   * @return {object}         Output DOM element.
   */
  createDOM: function(rawHTML){
    var handler = new htmlparser.DefaultHandler(function(error, dom){
      debug("Creating DOM from rawHTML...")
      if (error) {
        debug("Failed. The error is ", error);
        return;
      }
      return dom;
    });

    var parser = new htmlparser.Parser(handler);
    parser.parseComplete(rawHTML);
    return handler.dom;
  },


// Call the main program!
recursiveCallback(0, {}, function(res){
  // Write out as a csv if data
  var values = _.values(res);
  if (values.length > 0) {
    var csv = json2csv({ data: _.values(res) });
    fs.writeFile(argv.o, csv, function(err) {
      if (err) {
        console.log("failed to save file ", err);
      }
    });
  }
});
