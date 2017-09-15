//

const fs = require('fs')
const path = require('path')

const mkdirSync = function (dirPath) {
  try {
    fs.mkdirSync(dirPath)
  } catch (err) {
    if (err.code !== 'EEXIST') throw err
  }
}

function createGeneralPaths(){

  mkdirSync(path.resolve('./cut-version'))
  mkdirSync(path.resolve('./ansible'))
  mkdirSync(path.resolve('./gantry'))
  mkdirSync(path.resolve('./gantry/source'))
  mkdirSync(path.resolve('./gantry/run'))
}

module.exports.createGeneralPaths = createGeneralPaths
