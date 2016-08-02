/*
* @Author: Edward & Luis
* @Date:   2016-08-01 15:39:03
* @Last Modified by:   Luis Perez
* @Last Modified time: 2016-08-01 23:31:28
*/

'use strict';

var _ = require("lodash")
  , debug = require('debug')('scripts:crawler')
  , fs = require("fs")
  , htmlparser = require("htmlparser"),
  , json2csv = require("json2csv")
  , request = require("request")

var CONST = {
  element: "tag",
  type: "cite",
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
  .usage("Usage: $0 -d [domain] -n [num] -m [num]")
  .help("h")
  .describe("n", "The number of search results per request. [1,..,100].")
  .describe("m", "The maximum number of requests to make to the Google API. [1..].")
  .describe("d", "The host domain to search for subdomains.")
  .describe("b", "Flag to specify if randomized interval should be used between requests.")
  .alias("n", "num_results")
  .alias("m", "max_requests")
  .alias("d", "domain")
  .alias("h", "help")
  .number("n")
  .number("m")
  .demand(["d"])
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
        var url = obj.children[0].raw;
        var company = utils.getCompany(url);
        if (hashSet[company]){
          hashSet[company].count = hashSet[company].count + 1;
        }
        else {
          hashSet[company] = {
            name: company,
            url: url,
            count: 1,
            ranking: _.size(hashSet)
          };
        }
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
    var URI = {
      uri: CONST.searchParams.uri,
      method: CONST.searchParams.method,
      qs: {
        start: start,
        q: "site:" + argv.d,
        num: argv.n > 0 ? argv.n : 10
      }
    };
    console.log("Preparing to request Google Search...")
    debug(URI);

    request(URI, function(err, res, body){
      var res = {};
      if (err){
        debug("Error requesting Google results. Error: ", err);
      }
      debug("Returned request ", body);

      var dom = utils.createDOM(body);

      debug("Extracting company names from ", dom);

      var res = utils.extractCompanyNames(dom, {});

      debug("Finished extraction...");

      next(res);
    });
  }
}

/**
 * Recursively and asynchronously sends out Google requests.
 * @param  {int}   req_num     The current request number.
 * @param  {object}   results  The results calculated thusfar.
 * @param  {Function} callback Called with final results.
 * @return {bool}            True on success.
 */
function recursiveCallback(req_num, results, callback){
  debug("req_num page: ", req_num);

  if(req_num >= argv.m){
    callback(results);
    return true;
  }

  // Set a random wait time if specified by the user to attempt to bypass Google's
  // bot detection.
  var rand = (argv.b) ? 0 : Math.round(Math.random() * CONST.latency.variance) + CONST.latency.mean;
  setTimeout(function(){
    utils.queryGoogleFromStart(req_num * argv.n, function(res) {
      recursiveCallback(req_num + 1, _.mergeWith(results, res, function(objVal, srcVal){
        if (!objVal) return srcVal;
        if (!srcVal) return objVal;
        return {
          count: objVal.count + srcVal.count,
          ranking: _.min(objVal.ranking, srcVal.ranking)
        };
      }), callback);
    })
  }, rand);
}

recursiveCallback(0, {}, function(res){
  // Let's process the final results!
  console.log(JSON.stringify(res, null, 2));

  // Write out as a csv
  var csv = json2csv({ data: _.values(res) });
  fs.writeFile('out.csv', csv, function(err) {
    if (err) throw err;
    console.log('file saved!');
  });
});
