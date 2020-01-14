//

const chalk = require('chalk')
const { spawn } = require('child_process')

//

async function executeExternal(command, params, options) {
  console.log(
    chalk.bold.green(command) + ' ' + chalk.bold.blue(params.join(' ')),
  )

  await new Promise((resolve, reject) => {
    const child = spawn(command, params, options ? options : {})
    var self = this

    child.stdout.on('data', data => {
      process.stdout.write(data.toString())
    })

    child.stderr.on('data', data => {
      process.stderr.write(data.toString())
    })

    child.on('close', code => {
      if (code != 0) {
        reject('Error code ' + code + ' from: ' + command + params.join(' '))
      } else resolve()
    })
  })
}

//

module.exports = executeExternal
