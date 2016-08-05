# Crawler
(designed by Luis Perez)

Crawler searches the depths of the web for information on our competitors. Run the `--help` command for more information.

# Development

To begin development, no further steps are necessary. Modify the source code and execute `node app.js [COMMANDS]` where `[COMANDS]` is as described by the output of the `--help` flag.

## Directory Structure

Crawler has the ability to use different `methods` for Crawling the web. The code for each method is contained within the `lib\[METHOD]\` subdirectory. The main app takes as input multiple arguments -- however, the method to be used is specified by the `--method` flag, which consists of a comma separated list of methods.

Ex. `node app.js --methods googleSearch,googleAPI`

Note that each method name in the comma-separated lists must directly map to a `[METHOD]` subdirectory, as this is how the methods are imported.

If a new method needs to be added, it can be done as easily as creating a new `[METHOD]` subdirectory with the desired name. In the `index.js` file, the package should do something like the following:

```javascript
module.exports = function(dependencies){
  // DO SOME WORK
  var x = ...

  // Return a single exposed API.
  // The exposed API should be contain the key `run` which is a
  // function that takes as input a callback for dealing with
  // the resulting hashSet. Note that th hashSet passed
  // to the callback should, at
  // minimum, have the shaped outlined below.
  // If the same site is created from multiple methods and
  // multiple methods are used, the hashSets are merged. Any
  // other keys are pre-pended with the results the function
  // under `prefix'.
  return {
    run: function(callback) {
      // DO SOME WORK
      callback({
        site1: {
          name: site1,
          ...
          },
        site2: {
          ...
        }
        ...
      });
    },

    // Returns a mapping from keys in the hashset objects to
    // column names. Note for keys from multiple hashSets
    // that are unique, a warning is raised and the column
    // specified by the final method is used.
    keysToColumnMapping: function(){
      return {
        name: 'Company Name',
        ...
      };
    },

    // Return the prefix to be pre-pended if this module
    // is run alongisde others. Modules which return the
    // same prefix are incompatible, and an error will
    // be raised to the user in this case.
    // Therefore, make sure the prefix is unique.
    prefix: function() {
      return "test";
    }
  };
}
```


*Note*: not all command-line parameters are applicable to each method. If the parameters are not applicable, then any inputs are simply ignored.

## Development Goals and TODOs:

We now some future development goals for this library.

  - Add `bingSearch` and `bingAPI` search methods.
  - Add verification on the parameters; if a parameter is passed in that is not required by a method, then warn the user. If a required parameter for a method is missing, then fail early and provide a detailed error to the user.