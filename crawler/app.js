/*
* @Author: Luis Perez
* @Date:   2016-08-01 15:39:03
* @Last Modified by:   Luis Perez
* @Last Modified time: 2016-08-03 19:14:22
*/

'use strict';

var _ = require("lodash")
  , debug = require('debug')('scripts:crawler')
  , fs = require("fs")
  , htmlparser = require("htmlparser")
  , json2csv = require("json2csv")
  , request = require("request")
  , table = require("text-table")
  , url = require("url");

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
  },
  outOptions: {
    urlLength: 30
  }
}

var argv = require('yargs')
  .usage("Usage: $0 -d [domain] -n [num] -m [num] -o [file]")
  .help("h")
  .describe("n", "The number of search results per request (default 10). [1,..,100].")
  .describe("m", "The maximum number of requests to make to the Google API. (default 1) [1..].")
  .describe("d", "The host domain to search for subdomains.")
  .describe("b", "Flag to specify if randomized interval should be used between requests. (default true)")
  .describe("o", "The output csv file for writing results. If not specified, outputs are written to stdout.")
  .alias("n", "num_results")
  .alias("m", "max_requests")
  .alias("d", "domain")
  .alias("o", "output")
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
  getCompany: function(urlString) {

    debug("Extracting company from...", urlString);
    var host = url.parse(urlString).host;

    // successful parsing
    if(host) {
      var domains = host.split(".");

      // drop the top level domain and suffix
      var companyName = _.slice(domains, 0, domains.length - 2).join(".");
      debug("Extracted company name: ", companyName);

      return companyName;
    }

    // URL does not begin with https//, so we take subdomain
    return urlString.split(".")[0];
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
   * Determines in the raw HTML is a bot page. Uses heuristics.
   * @param  {String}  Raw HTML for the page.
   * @return {Bool}
   */
  isBotURL: function(rawHTML){
    return rawHTML && rawHTML.length < CONST.heuristics.minValidHTMLLength;
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
    console.log("Preparing to request Google Search...", start);
    debug(URI);

    request(URI, function(err, res, body){
      var results = {};
      if (err){
        debug("Error requesting Google results. Error: ", err);
      }
      debug("Returned request ", body);

      if(!utils.isBotURL(body)){
        var dom = utils.createDOM(body);

        debug("Extracting company names from ", dom);

        var results = utils.extractCompanyNames(dom, {});

        debug("Finished extraction...");

        return next(results);
      }
      console.log("Hit a bot test page. Please visit: ", res.request.uri.href);
      next(null);
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
  var rand = (argv.b) ?
    Math.round(Math.random() * CONST.latency.variance) + CONST.latency.mean : 0;
  console.log("Setting timeout to ", rand, "ms");
  setTimeout(function(){
    utils.queryGoogleFromStart(req_num * argv.n, function(res) {
      // Bubble up, error occurred, salvage results!
      if(!res){
        return callback(results);
      }
      // bump ranking of new results by length of old results
      var currRanking = _.size(results);
      var bumpedRes = _.transform(res, function(acc, val, key){
        acc[key] = _.extend(val, { ranking: val.ranking + currRanking });
      }, {});
      recursiveCallback(req_num + 1, _.mergeWith(results, bumpedRes, function(objVal, srcVal){
        if (!objVal) return srcVal;
        if (!srcVal) return objVal;
        return _.extend(objVal, {
          count: objVal.count + srcVal.count,
          ranking: _.min([objVal.ranking, srcVal.ranking])
        });
      }), callback);
    })
  }, rand);
}

// Call the main program!
recursiveCallback(0, {}, function(res){
  // Write out as a csv if data
  var values = _.sortBy(_.values(res), function(el){
    return -1 * el.ranking;
  });

  if (values.length > 0) {
    if (!argv.o){
      // truncate values so we can pretty print a little better
      var prettyOut = _.map(values, function(val){
        var name = val.name
          , url = val.url.substring(0, CONST.outOptions.urlLength)
          , ranking = val.ranking
          , count = val.count;
        return [ranking, name, count, url];
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
});
