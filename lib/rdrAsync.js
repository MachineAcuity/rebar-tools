//

const fsWithCallbacks = require('fs')
const path = require('path')

//

const fs = fsWithCallbacks.promises

//

const File = function(name) {
  this.name = name
  this.size = 0
  this.hidden = false

  if (name.substr(0, 1) === '.') {
    this.hidden = true
  }

  return this
}

const Directory = function(dirpath) {
  this.name = ''
  this.dirpath = path.resolve(dirpath)
  this.files = []
  this.length = 0
  this.hidden = false

  var dirArray = dirpath.split('/')
  this.name = dirArray[dirArray.length - 1]

  if (this.name.substr(0, 1) === '.') {
    this.hidden = true
  }

  return this
}

async function rdrAsync(inputDir, skipFile) {
  const dir = new Directory(inputDir)

  const dirContent = await fs.readdir(inputDir)
  for (let fileName of dirContent) {
    // Skip files according to passed function, or MacOS specific files
    if (fileName === '.DS_Store' || (skipFile && skipFile(fileName))) continue

    const stat = await fs.stat(inputDir + '/' + fileName)

    let fileOrDirToAdd

    if (stat.isFile()) {
      var file = new File(fileName)
      file.size = stat.size
      file.mtime = stat.mtime

      fileOrDirToAdd = file
    } else if (stat.isDirectory()) {
      const subDir = await rdrAsync(inputDir + '/' + fileName, skipFile)
      fileOrDirToAdd = subDir
    } else throw new Error('Neither file nor directory')

    dir.length += 1
    dir.files.push(fileOrDirToAdd)
  }

  return dir
}
module.exports.rdrAsync = rdrAsync
