/*
* @Author: Luis Perez
* @Date:   2016-08-01 15:39:03
* @Last Modified by:   Luis Perez
* @Last Modified time: 2016-08-07 10:28:16
*/

'use strict';

var _ = require("lodash")
  , async = require("async")
  , debug = require('debug')('scripts:crawler:app')
  , fs = require("fs")
  , json2csv = require("json2csv")
  , path = require("path")
  , Table = require("easy-table");

var argv = require('yargs')
  .usage("Usage: $0 -d [domain] -c [crawlers] -n [num] -m [num] -s [num] -o [file]")
  .help("h")
  .describe("c", "Method to use for the search. This should be a comma separated list.")
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
  .alias("c", "method")
  .number("n")
  .number("m")
  .demand(["d"])
  .default({
    n: 10,
    m: 1,
    b: true,
    s: 0,
    c: "googleSearch"
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
  /**
   * Loads the user provided input for the methods to use.
   * @param  {String} methodsString The comma-separated lists of methods to use.
   * @return {Array}               A list of successfully loaded modules.
   */
  loadMethods: function(methodsString){
    var methods = methodsString.split(",");
    var modules = _.filter(_.map(methods, function(method){
      try {
        return require(path.join(dependencies.base, "lib", method))(dependencies);
      } catch(err){
        console.log("Error: Method", method, "does not exists.");
        debug(err);
        return null;
      }
    }), function(module){
      return module != null;
    });

    return modules;
  },

  /**
   * Takes an array of result hashes generated by each method
   * and merges them into one final object.
   * @param  {Array} results An array of hash sets.
   * @return {object}         An object with the HashSet and a column map for printing..
   */
  mergeResults: function(results){
    // the results object is more interesting

    debug("Merging result sets!", results);
    var fn = _.partial(_.extendWith, {}, _, function(objVal, srcVal, key){
      // Create the merged key->column name maps
      if (key == "__method"){
        return null;
      }

      if (!objVal) return srcVal;
      if (!srcVal) return objVal;
      return _.extend({}, [objVal, srcVal]);
    });

    var newHashSet = fn.apply(fn, results);
    delete(newHashSet["__method"]);

    return {
      __columnMap: _.reduce(results, function(cum, set){
        var prefix = (results.length > 1) ? set.__method.prefix() : "";

        return _.extend(cum, _.transform(set.__method.keysToColumnMapping(), function(acc, val, key){
          return acc[key] = prefix + val;
        }));
      }, {}),
      hashSet: newHashSet
    };
  },

  /**
   * Saves to file and prettifies the results set.
   * @param  {object} res The object has two keys: hashSet and __columnMap
   * @return {void}
   */
  prettyPrintResults: function(result){
    // Write out as a csv if data
    var res = result.hashSet;
    var values = _.sortBy(_.values(res), function(el){
      return 1 * el.ranking;
    });

    debug("Sorted results", values);

    if (values.length > 0) {
      var t = new Table;

      _.forEach(values, function(row){
        _.forEach(row, function(val, key){
          debug("Cell", val, result.__columnMap[key]);
          t.cell(result.__columnMap[key], val);
        });
        t.newRow();
      });

      // Let's set the results!
      console.log(t.toString());

      if (argv.o) {
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

// Main entry point.
if (!argv.c){
  console.log("Invalid modules inputs");
  process.exit(1);
}

var methods = _.map(helpers.loadMethods(argv.c), function(method){
  return function(callback){
    method.run(function(err, res){
      if (err){
        return callback(err);
      }
      return callback(err, _.set(res, "__method", method));
    });
  };
});

async.parallel(methods, function(err, results){
  if (err){
    return console.log("Failed.", err);
  }

  var finalOutput = helpers.mergeResults(results);

  debug("Merged set", finalOutput);

  helpers.prettyPrintResults(finalOutput);
});