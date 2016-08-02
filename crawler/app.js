/*
* @Author: Edward & Luis
* @Date:   2016-08-01 15:39:03
* @Last Modified by:   Luis Perez
* @Last Modified time: 2016-08-01 20:55:35
*/

'use strict';

var _ = require("lodash")
  , request = require("request")
  , htmlparser = require("htmlparser")
  , debug = require('debug')('scripts:crawler');

var CONST = {
  element: "tag",
  type: "cite",
  searchParams: {
    uri: "https://www.google.com/search",
    method: "GET"
  }
}

var argv = require('yargs')
  .usage("Usage: $0 -h zendesk.com -n 10 -m 1")
  .help("h")
  .demand(["h"])
  .describe("n", "The number of search results per request. [1,..,100]")
  .describe("m", "The maximum number of requests to make to the Google API. [1..]")
  .describe("h", "The host domain to search for subdomains")
  .alias("n", "num_results")
  .alias("m", "max_requests")
  .alias("h", "host")
  .number("n")
  .number("m")
  .default({
    n: 10,
    m: 1
  })
  .argv;

console.log(argv);
process.exit();

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

  /**
   * Given an unput URL extracts the subdomain.
   * @param  {string} url Input site URL.
   * @return {string}     Subdomain from website.
   */
  getCompany: function(url) {

    debug("Extracting company from...", url);

    var array = url.split(".");
    var companyName;

    if (array.length == 3) {
        var someVariable = array[0];
        if (someVariable.includes("/")){
          var internalArray = someVariable.split("//");
          companyName = internalArray[1];
        }
        else {
          companyName = someVariable;
        }
    } else if (array.length == 4) {
        companyName = array[1];
    }

    if (companyName == "www" || companyName == undefined){
        companyName = "zendesk";
    }

    debug("Extracted company name: ", companyName);

    return companyName;
  },

  /**
   * Converts DOM into a HashSet counting the unique subdomains as well as their
   * relative popularity as ranked by Google.
   * @param  {object} DOM     htmlparse DOM object from Google Search Results.
   * @param  {object} hashSet Initial HashSet associating unique companies to
   * popularity.
   * @return {object}         HashSet
   */
  extractCompanyNames: function(DOM, hashSet){
    if (!DOM) {
      return hashSet;
    }

    _.forEach(DOM, function(obj){
      // Assuming cite tag only has one child, which is a text node.
      if (obj && obj.type == CONST.element && obj.name == CONST.type
        && obj.children.length > 0){
        var company = utils.getCompany(obj.children[0].raw);
        hashSet[company] = (hashSet[company]) ? hashSet[company] + 1: 1;
      }

      // recursively call on the children
      hashSet = utils.extractCompanyNames(obj.children, hashSet);
    });

    return hashSet;
  },

  /**
   * Get's Google Search results for *.zendesk subdomain query beginning from
   * start
   * @param  {int}      start     The result number from which to return results
   * @param  {function} [varname] Function passed results containing extracted
   * companies hash.
   */
  queryGoogleFromStart: function(start, next){

    debug("Preparing to request Google Search...");

    request({
      uri: CONST.searchParams.uri,
      method: CONST.searchParams.method,
      qs: {
        start: start,
        q: "site:" + argv.h,
        num: argv.n > 0 ? argv.n : 10
      }
    }, function(err, res, body){
      var res = {};
      if (err){
        debug("Error requesting Google results. Error: ", err);
      }
      var dom = utils.createDOM(body);

      debug("Extracting comapny names from ", dom);

      var res = utils.extractCompanyNames(dom, {});

      debug("Finished extraction...");

      next(res);
    });
  }
}

function recursiveCallback(start, results){
  debug("Start page: ", start);

  if(start >= argv.n * argv.m){
    console.log(results);
  }

  utils.queryGoogleFromStart(start, _.partial(recursiveCallback, start + argv.n));
}

recursiveCallback(0, {});
